import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import {
  formatPlaybackTime,
  type MediaSummary,
  type PlaybackCoordinatorSnapshot,
  type PlaybackRuntime,
} from '@machafoundation/core';
import { VideoView } from 'expo-video';
import {
  accelerateSeek,
  type SeekDirection,
  type SeekHold,
} from './player/seekAcceleration';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { Focusable } from '../components/Focusable';
import { PlayerOptions, OPTIONS_SCOPE } from './player/PlayerOptions';
import { playbackFailureTrail } from './player/failureTrail';
import { failureTrailEnabled } from '../diagnostics/failureTrailSetting';
import { usePlayerVolume } from '../hooks/usePlayerVolume';
import { volumePercent } from '../player/volume';
import { useMacha } from '../app/MachaProvider';
import { PlayerIcon, type PlayerIconName } from '../components/PlayerIcons';
import { tvFocus } from '../hooks/tvFocus';
import { attachPlaybackHost } from '../app/usePlaybackRuntime';
import { colour, font, pageGutter, radius, rem, type } from '../styles/theme';

/**
 * How long the chrome stays up after the last button press.
 *
 * A presentation choice, not a protocol one, and unrelated to any server or
 * network deadline: it is long enough to read the stream-status line — the
 * container, the node and the per-stream transforms — and short enough not to
 * sit over the picture. Nothing in core reads it.
 */
const CHROME_HIDE_MS = 4_000;

/**
 * How long a scrub preview waits before it is committed as a seek.
 *
 * Calibrated against the D-pad's own auto-repeat rather than the network: a
 * held direction on this remote repeats at roughly 60–100 ms, so 400 ms is
 * comfortably longer than the gap between repeats and a long hold therefore
 * costs one seek however far it travelled. The web client gets this for free
 * from key-up, which a TV event stream does not give us.
 */
const SCRUB_COMMIT_MS = 400;

/** The focus scope name; while the chrome is up nothing behind it is reachable. */
const CHROME_SCOPE = 'player-chrome';


export function PlayerScreen({
  media,
  runtime,
  onClose,
}: {
  media: MediaSummary;
  runtime: PlaybackRuntime;
  onClose: () => void;
}): React.JSX.Element {
  const [playback, setPlayback] = useState<PlaybackCoordinatorSnapshot | undefined>(() =>
    runtime.getPlaybackSnapshot(),
  );
  const [chromeVisible, setChromeVisible] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const volume = usePlayerVolume(runtime, useMacha().volume);
  const [scrubPosition, setScrubPosition] = useState<number | undefined>();
  /**
   * Read at the moment a failure lands, not subscribed to.
   *
   * Keyed on the failure itself so it is snapshotted once per failure rather
   * than on every render — the buffer keeps filling while the overlay is up
   * (a retry, a second node refusing), and a trail that reshuffled underneath
   * someone reading it would be worse than no trail.
   */
  const trail = useMemo(
    () => (playback?.fatalError && failureTrailEnabled() ? playbackFailureTrail() : []),
    [playback?.fatalError],
  );
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hostToken = useRef({}).current;

  useEffect(() => runtime.subscribePlayback(setPlayback), [runtime]);

  // Binding the surface is `attach`, not `play` — it must not create a session.
  useEffect(() => attachPlaybackHost(runtime, hostToken), [runtime, hostToken]);

  // Presentation only. Core carries no surface handle, so the platform holds
  // it; the runtime constructor has already created the player by the time
  // this screen can mount.
  //
  // Held in state and resubscribed rather than read once: promoting a warm
  // standby swaps in a different `VideoPlayer`, and a captured instance would
  // leave this rendering the player that was just released.
  const [video, setVideo] = useState(() => androidTvPlatform.videoPlayer());
  useEffect(() => androidTvPlatform.subscribePlayerChange(setVideo), []);
  // Runs after commit, so by here `VideoView` holds the promoted player and the
  // one it replaced can be destroyed. Doing this in the swap itself would
  // release a player still attached to a live surface.
  useEffect(() => androidTvPlatform.releaseRetiredPlayer(), [video]);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, []);

  useEffect(() => {
    showChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, [showChrome]);

  /**
   * Any button brings the controls back.
   *
   * While the chrome is hidden every focusable is out of scope, so the focus
   * registry has no candidate and would swallow the press. Waking on the
   * command itself is what makes the first press of a direction feel like it
   * did something, which is the behaviour the web client gets from its chrome
   * never leaving the DOM.
   */
  useEffect(() => tvFocus.onCommand(() => showChrome()), [showChrome]);

  // While the chrome is up it owns the D-pad entirely, mirroring the web
  // client scoping its candidate query to `.player-chrome.visible`.
  useEffect(() => {
    if (!chromeVisible) {
      tvFocus.popScope(CHROME_SCOPE);
      return undefined;
    }
    tvFocus.pushScope(CHROME_SCOPE);
    return () => tvFocus.popScope(CHROME_SCOPE);
  }, [chromeVisible]);

  // The options panel takes the D-pad outright while it is open, so the
  // transport behind it cannot be reached by pressing through the panel.
  useEffect(() => {
    if (!optionsOpen) return undefined;
    tvFocus.pushScope(OPTIONS_SCOPE);
    return () => tvFocus.popScope(OPTIONS_SCOPE);
  }, [optionsOpen]);

  // The panel holds the chrome open under it: letting the auto-hide run would
  // unmount the scope the viewer is currently navigating.
  useEffect(() => {
    if (optionsOpen && hideTimer.current) clearTimeout(hideTimer.current);
  }, [optionsOpen]);

  /**
   * Back closes the panel before it closes the player.
   *
   * Registered here rather than folded into the app-level handler because
   * `BackHandler` invokes listeners in reverse registration order, and this
   * screen mounts after the root — so this runs first and can consume the press
   * while the panel is open. Without it, Back would close the whole player out
   * from under a viewer who only meant to dismiss the options.
   */
  useEffect(() => {
    if (!optionsOpen) return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setOptionsOpen(false);
      return true;
    });
    return () => subscription.remove();
  }, [optionsOpen]);

  const event = playback?.event;
  const duration = event?.durationMs ?? media.durationMs ?? 0;
  /**
   * What the scrubber shows: the viewer's own preview, then **core's intent**.
   *
   * Not `event.positionMs`. A seek is dispatched and the player goes on
   * reporting the old position until it has actually moved, so falling back to
   * what it reports snapped the bar back to where the viewer started and then
   * jumped forward when the seek landed — reported from the set by Tom,
   * 2026-09-19, as flicking back before seeking.
   *
   * `intent.positionMs` is the position core is holding the transport at, and
   * core keeps holding it until the player is tracking again — that is what
   * `seekIntentActive` is for. So the bar moves once, to where the viewer asked
   * to be, and stays there. This is what the web client renders
   * (`PlayerScreen.tsx:687`), read there rather than inferred, and matching it
   * is the requirement.
   */
  const position = scrubPosition ?? Math.min(duration || Number.MAX_SAFE_INTEGER, playback?.intent.positionMs ?? 0);
  const paused = playback?.intent.paused ?? false;
  const buffered = event?.bufferedRangesMs?.[0]?.endMs ?? 0;

  const commitScrub = useCallback(
    (target: number) => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
      commitTimer.current = setTimeout(() => {
        runtime.seek(target);
        setScrubPosition(undefined);
      }, SCRUB_COMMIT_MS);
    },
    [runtime],
  );

  /**
   * The accelerating "finder", ported from the web client.
   *
   * A remote has no scrub wheel and a fixed ten seconds is wrong at both ends:
   * tedious across a film, and an overshoot when you are hunting a moment. The
   * ladder climbs on **time held** rather than on how many auto-repeat events
   * the platform happened to send, so the two clients feel the same however
   * fast this remote repeats. See `seekAcceleration.ts`.
   */
  const seekHold = useRef<SeekHold | undefined>(undefined);

  const seekByHeldKey = useCallback(
    (direction: SeekDirection) => {
      const { hold, deltaMs } = accelerateSeek(seekHold.current, direction, Date.now());
      seekHold.current = hold;
      nudgeRef.current(deltaMs);
    },
    [],
  );

  const nudge = useCallback(
    (deltaMs: number) => {
      const base = scrubPosition ?? playback?.intent.positionMs ?? 0;
      const next = Math.max(0, Math.min(duration || Number.MAX_SAFE_INTEGER, base + deltaMs));
      setScrubPosition(next);
      showChrome();
      commitScrub(next);
    },
    [scrubPosition, playback?.intent.positionMs, duration, showChrome, commitScrub],
  );

  // `seekByHeldKey` is stable so the ladder is not rebuilt on every position
  // report; it reaches the latest `nudge` through this rather than by taking a
  // dependency on it.
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;

  const streamStatus = useMemo(() => {
    const instruction = playback?.instruction;
    const session = playback?.session;
    if (!instruction && !session) return [];

    const lines: string[] = [];
    const container = instruction?.servedContainer ?? instruction?.container;
    const endpoint = event?.streamOrigin?.replace(/^https?:\/\//, '');
    // Either half is omitted rather than defaulted when absent: this is the one
    // place a container the client asked for and did not get can show, and a
    // default would read as an answer.
    if (container || endpoint) lines.push([container, endpoint].filter(Boolean).join(' : '));
    if (instruction) {
      lines.push(`${instruction.mode}${instruction.withoutFacts ? ' (no facts)' : ''}`);
      if (instruction.video) lines.push(`video ${instruction.video}`);
      if (instruction.audio) lines.push(`audio ${instruction.audio}`);
    }
    return lines;
  }, [playback?.instruction, playback?.session, event?.streamOrigin]);

  const playedPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <View style={styles.page}>
      {/* `.player-host` — the video surface, behind everything. */}
      {video ? (
        <VideoView
          player={video}
          style={styles.host}
          // The chrome in this file is the only chrome. expo-video's own
          // controls are pointer-shaped and would take D-pad focus away from
          // the focus scorer, which is the one thing this client must own.
          nativeControls={false}
          contentFit="contain"
        />
      ) : (
        <View style={styles.host} />
      )}

      {playback?.fatalError ? (
        <View style={styles.fatalError}>
          <Text style={styles.fatalTitle}>Playback failed</Text>
          <Text style={styles.fatalMessage}>{playback.fatalError.message}</Text>
          {trail.map((entry) => (
            <View key={`${entry.atMs}-${entry.event}`} style={styles.trailRow}>
              <Text style={styles.trailTime}>{(entry.atMs / 1_000).toFixed(1)}s</Text>
              <Text
                style={[styles.trailEvent, entry.level === 'error' && styles.trailError]}
                numberOfLines={1}
              >
                {entry.event}
              </Text>
              {entry.detail ? (
                <Text style={styles.trailDetail} numberOfLines={1}>
                  {entry.detail}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {optionsOpen && playback?.session ? (
        <PlayerOptions
          session={playback.session}
          pendingPreferences={playback.pendingPreferences}
          instruction={playback.instruction}
          onApply={(update) => {
            runtime.update(update);
            showChrome();
          }}
        />
      ) : null}

      {chromeVisible || playback?.fatalError ? (
        <View style={styles.chrome}>
          {/* `.player-titlebar` */}
          <View style={styles.titlebar}>
            <View style={styles.titleCopy}>
              <Text style={styles.title} numberOfLines={1}>
                {media.title}
              </Text>
              {media.subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {media.subtitle}
                </Text>
              ) : null}
            </View>
            <View style={styles.streamStatus}>
              {playback?.notice ? (
                <Text style={styles.streamLine}>{playback.notice}</Text>
              ) : playback?.preparingSource ? (
                // The one moment the client is moving between nodes, and
                // "which node" is the only question worth asking about it.
                <Text style={styles.streamLine}>Preparing new stream…</Text>
              ) : (
                streamStatus.map((line) => (
                  <Text key={line} style={styles.streamLine}>
                    {line}
                  </Text>
                ))
              )}
            </View>
          </View>

          {/* `.player-scrubber-row { grid-template-columns: 4.5rem 1fr 4.5rem }` */}
          <View style={styles.scrubberRow}>
            <Text style={styles.timeLabel}>{formatPlaybackTime(position)}</Text>
            <Focusable
              ring={false}
              scope={CHROME_SCOPE}
              style={styles.scrubberShell}
              ownsDirection={(direction) => direction === 'left' || direction === 'right'}
              onDirection={(direction) => seekByHeldKey(direction === 'left' ? -1 : 1)}
            >
              {({ focused }) => (
                <View style={styles.scrubberVisual}>
                  <View style={[styles.scrubberBuffered, { width: `${bufferedPercent}%` }]} />
                  <View style={[styles.scrubberPlayed, { width: `${playedPercent}%` }]} />
                  <View
                    style={[
                      styles.scrubberThumb,
                      { left: `${playedPercent}%` },
                      focused && styles.scrubberThumbFocused,
                    ]}
                  />
                </View>
              )}
            </Focusable>
            <Text style={[styles.timeLabel, styles.timeLabelEnd]}>{formatPlaybackTime(duration)}</Text>
          </View>

          {/* `.player-button-row` */}
          <View style={styles.buttonRow}>
            <ChromeButton icon="restart" onSelect={() => { runtime.seek(0); showChrome(); }} />
            {/*
              * The buttons keep a fixed step. They are pressed, not held — the
              * ladder belongs to the scrubber, which is where a viewer hunting
              * a moment actually holds a key down.
              */}
            <ChromeButton icon="rewind" onSelect={() => { runtime.seekBy(-10_000); showChrome(); }} />
            <ChromeButton
              icon={paused ? 'play' : 'pause'}
              defaultFocus
              onSelect={() => { runtime.setPaused(!paused); showChrome(); }}
            />
            <ChromeButton icon="forward" onSelect={() => { runtime.seekBy(10_000); showChrome(); }} />
            {/*
              * **No volume control here** (Tom, 2026-09-19). A television's own
              * remote has volume keys and they drive the set's output stage,
              * which is the one a viewer reaches for; an app-level level in the
              * transport row is a second, invisible multiplier underneath it,
              * and two volumes that disagree is worse than one.
              *
              * `VolumeStore` and `usePlayerVolume` stay wired — core's
              * `setVolume` still applies a remembered level, and a promoted
              * standby still comes up at it. What is gone is the control, not
              * the state. See `TODO/ACTIVE.md` §4.2.
              */}
            {playback?.session ? (
              <ChromeButton icon="options" onSelect={() => setOptionsOpen(true)} />
            ) : null}
            <ChromeButton icon="close" onSelect={onClose} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** `.player-button-row button { width/height: 3.25rem; border-radius: 50% }` */
function ChromeButton({
  icon,
  onSelect,
  defaultFocus,
}: {
  icon: PlayerIconName;
  onSelect: () => void;
  defaultFocus?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      scope={CHROME_SCOPE}
      defaultFocus={defaultFocus}
      onSelect={onSelect}
      style={styles.chromeButton}
      focusedStyle={styles.chromeButtonFocused}
    >
      <PlayerIcon name={icon} />
    </Focusable>
  );
}

const BUTTON = rem(3.25);

const styles = StyleSheet.create({
  // `.player-page { background: #050506 }` + `.player-presentation-full { inset: 0 }`
  page: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#050506',
  },
  // `.player-host { position: absolute; inset: 0; background: black }`
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  // `.player-chrome { left/right/bottom: 0; padding: 1.35rem 3vw 1.25rem; background: #0505069c }`
  chrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: rem(1.35),
    paddingBottom: rem(1.25),
    paddingHorizontal: pageGutter,
    backgroundColor: '#0505069c',
  },
  // `.player-titlebar { display: flex; align-items: end; justify-content: space-between; gap: 2rem; margin-bottom: 1.3rem }`
  titlebar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: rem(2),
    marginBottom: rem(1.3),
  },
  titleCopy: {
    flexShrink: 1,
  },
  // `.player-titlebar strong { font-size: clamp(1.3rem,2.2vw,2rem); color: #dedee2 }`
  title: {
    fontSize: type.playerTitle,
    color: colour.heading,
    fontWeight: font.weightMedium,
  },
  // `.player-titlebar span { margin-top: .2rem; color: #c8c8cb }`
  subtitle: {
    marginTop: rem(0.2),
    color: '#c8c8cb',
    fontSize: type.body,
  },
  // `.player-stream-status { justify-items: end; gap: .18rem; color: #9b9ba3; text-align: right }`
  streamStatus: {
    alignItems: 'flex-end',
    gap: rem(0.18),
  },
  streamLine: {
    color: '#9b9ba3',
    fontSize: type.small,
    textAlign: 'right',
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(1),
  },
  // `.player-scrubber-row span { font-size: .82rem; font-variant-numeric: tabular-nums }`
  timeLabel: {
    width: rem(4.5),
    color: '#c8c8cb',
    fontSize: type.small,
    fontVariant: ['tabular-nums'],
  },
  timeLabelEnd: {
    textAlign: 'right',
  },
  // `.player-scrubber-shell { height: 1.1rem }`
  scrubberShell: {
    flex: 1,
    height: rem(1.1),
    justifyContent: 'center',
  },
  // `.player-scrubber-visual { height: 4px; border-radius: 99px; background: #e7e7ea }`
  scrubberVisual: {
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colour.scrubberTrack,
    justifyContent: 'center',
  },
  // `.player-scrubber-buffered { background: #d7a3af }`
  scrubberBuffered: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colour.scrubberBuffered,
  },
  // `.player-scrubber-played { background: #620014; opacity: .84 }`
  scrubberPlayed: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colour.scrubberPlayed,
    opacity: 0.84,
  },
  // `.player-scrubber::-webkit-slider-thumb { width/height: 14px; border-radius: 50%; background: var(--red-400) }`
  scrubberThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#ffffffa8',
    backgroundColor: colour.red400,
  },
  scrubberThumbFocused: {
    borderColor: colour.text,
    transform: [{ scale: 1.25 }],
  },
  // `.player-button-row { justify-content: center; gap: .7rem; margin-top: 1.25rem }`
  /** Sits in the button row but is wider, because it carries a readable level. */
  volumeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.4),
    paddingHorizontal: rem(0.7),
    height: rem(3.25),
    borderRadius: radius.pill,
    backgroundColor: colour.surface2,
  },
  volumeControlFocused: {
    backgroundColor: colour.accent,
  },
  volumeLevel: {
    color: colour.text,
    fontSize: type.small,
    minWidth: rem(2.6),
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: rem(0.7),
    marginTop: rem(1.25),
  },
  // `.player-button-row button { width/height: 3.25rem; border: 1px solid #48484f; border-radius: 50%; background: #080809d6 }`
  chromeButton: {
    width: BUTTON,
    height: BUTTON,
    borderRadius: BUTTON / 2,
    borderWidth: 1,
    borderColor: '#48484f',
    backgroundColor: '#080809d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `:hover/:focus-visible { background: #160004e8; border-color: #620014 }`
  chromeButtonFocused: {
    backgroundColor: '#160004e8',
    borderColor: '#620014',
  },
  // `.player-fatal-error { top: 42%; border-radius: .7rem; background: #09090be8 }`
  fatalError: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    top: '38%',
    gap: rem(0.45),
    paddingVertical: rem(1.1),
    paddingHorizontal: rem(1.25),
    borderWidth: 1,
    borderColor: '#ffffff16',
    borderRadius: rem(0.7),
    backgroundColor: '#09090be8',
    alignItems: 'center',
  },
  fatalTitle: {
    color: colour.heading,
    fontSize: rem(1.05),
    fontWeight: font.weightSemibold,
  },
  fatalMessage: {
    color: colour.error,
    textAlign: 'center',
  },
  /**
   * One trail entry.
   *
   * Left-aligned and full width against the centred message above it: these
   * are read as a column of times, and centring them would make the eye
   * re-find the start of every line.
   */
  trailRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    alignItems: 'baseline',
    gap: rem(0.5),
  },
  trailTime: {
    width: rem(3.2),
    textAlign: 'right',
    color: '#7a7a83',
    fontSize: type.small,
    fontVariant: ['tabular-nums'],
  },
  trailEvent: {
    color: '#c8c8cb',
    fontSize: type.small,
  },
  trailError: {
    color: colour.error,
  },
  // Takes the remaining width and truncates, so one long line cannot push the
  // older entries — usually the causal ones — off the bottom of the overlay.
  trailDetail: {
    flexShrink: 1,
    color: '#7a7a83',
    fontSize: type.small,
  },
});
