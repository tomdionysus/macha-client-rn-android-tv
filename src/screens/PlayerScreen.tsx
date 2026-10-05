import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import {
  describePlaybackSession,
  playbackFailureCode,
  TOO_SLOW_TO_PLAY_CODE,
  type Episode,
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
import { Button } from '../components/Button';
import { Focusable } from '../components/Focusable';
import { PlayerOptions, OPTIONS_SCOPE } from './player/PlayerOptions';
import { BufferingOverlay } from './player/BufferingOverlay';
import { bufferingDelayMs, showsBuffering, startWaitNotice } from './player/bufferingIndicator';
import { nodeName } from './player/nodeName';
import { useElapsedMs } from '../hooks/useElapsedMs';
import { AudioPresentation } from './player/AudioPresentation';
import {
  LIVE_DETAIL_CHARS,
  LIVE_TRAIL_ENTRIES,
  playbackFailureTrail,
  trailSignature,
  type PlaybackFailureTrailEntry,
} from './player/failureTrail';
import { failureTrailEnabled } from '../diagnostics/failureTrailSetting';
import { failureCopy } from './player/failureCopy';
import { playbackLog } from '../diagnostics/playbackLog';
import { usePlayerVolume } from '../hooks/usePlayerVolume';
import { useMacha } from '../app/MachaProvider';
import { AvailabilityMarker } from '../components/AvailabilityMarker';
import { availableToPlay } from '@machafoundation/core';
import { PlayerIcon, type PlayerIconName } from '../components/PlayerIcons';
import { tvFocus } from '../hooks/tvFocus';
import { attachPlaybackHost } from '../app/usePlaybackRuntime';
import { px, colour, disabledOpacity, font, pageGutter, radius, rem, type } from '../styles/theme';
import {
  episodeLabel,
  errorText,
  formatPlaybackTime,
  playbackNoticeText,
  preparingStreamText,
  startProgressText,
  streamLines as streamLinesText,
  tooSlowToPlayText,
} from '../text/viewerText';
import type { EpisodeNavigation } from '../app/useEpisodeNeighbours';

/** Chrome auto-hide after the last press. Asserted: long enough to read the stream status. */
const CHROME_HIDE_MS = 4_000;

/**
 * Delay before a scrub preview commits as a seek. Calibrated against the
 * D-pad's auto-repeat (roughly 60–100 ms), so a long hold costs one seek.
 */
const SCRUB_COMMIT_MS = 400;

/** Live-trail poll interval. Asserted: cheap against a 200-entry ring, and only paid with Diagnostics on. */
const LIVE_TRAIL_POLL_MS = 1_000;

/** The scrubber, by name, so a cold left or right press can land on it. */
const SCRUBBER_FOCUS_ID = 'player-scrubber';
const PLAY_PAUSE_FOCUS_ID = 'player-play-pause';

/** The focus scope name; while the chrome is up nothing behind it is reachable. */
const CHROME_SCOPE = 'player-chrome';

/** Scope for the failure's buttons, which outlive the chrome's auto-hide. */
const FAILURE_SCOPE = 'player-failure';


export function PlayerScreen({
  media,
  runtime,
  onClose,
  episodeNav,
  onPlayEpisode,
  returnedFromExit = 0,
}: {
  media: MediaSummary;
  runtime: PlaybackRuntime;
  onClose: () => void;
  /** The episodes either side, for an episode. Ignored for anything else. */
  episodeNav?: EpisodeNavigation;
  onPlayEpisode?: (episode: Episode) => void;
  /** Counts returns from a standby that closed this playback; each shows the chrome on Play. */
  returnedFromExit?: number;
}): React.JSX.Element {
  const [playback, setPlayback] = useState<PlaybackCoordinatorSnapshot | undefined>(() =>
    runtime.getPlaybackSnapshot(),
  );
  const isEpisode = media.kind === 'episode';
  const [chromeVisible, setChromeVisible] = useState(true);
  /** For the command subscription, which is made once. */
  const chromeVisibleRef = useRef(chromeVisible);
  chromeVisibleRef.current = chromeVisible;
  const [optionsOpen, setOptionsOpen] = useState(false);
  usePlayerVolume(runtime, useMacha().volume);
  // Core says `starting` without saying since when, so the wait is counted here.
  const starting = playback?.starting ?? false;
  const startWaitMs = useElapsedMs(starting);
  const [scrubPosition, setScrubPosition] = useState<number | undefined>();
  /** Snapshotted once per failure, so the trail does not reshuffle under a reader. */
  const trail = useMemo(
    () => (playback?.fatalError && failureTrailEnabled() ? playbackFailureTrail() : []),
    [playback?.fatalError],
  );
  /**
   * Decided once per failure. The code is logged here because only the
   * coordinator's assembled error carries the whole chain. See `failureCopy`.
   */
  const fatal = useMemo(
    () => (playback?.fatalError ? failureCopy(playback.fatalError) : undefined),
    [playback?.fatalError],
  );
  useEffect(() => {
    if (fatal?.code) playbackLog.warn('fatal-error-code', { code: fatal.code });
  }, [fatal]);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hostToken = useRef({}).current;

  useEffect(() => runtime.subscribePlayback(setPlayback), [runtime]);

  // Binding the surface is `attach`, not `play` — it must not create a session.
  useEffect(() => attachPlaybackHost(runtime, hostToken), [runtime, hostToken]);

  // Core carries no surface handle, so the platform holds it. Resubscribed
  // because promoting a standby swaps in a different `VideoPlayer`.
  const [video, setVideo] = useState(() => androidTvPlatform.videoPlayer());
  useEffect(() => androidTvPlatform.subscribePlayerChange(setVideo), []);
  // After commit `VideoView` holds the promoted player, so the retired one can
  // be released; any earlier it is still attached to a live surface.
  useEffect(() => androidTvPlatform.releaseRetiredPlayer(), [video]);

  /**
   * For `showChrome`, which is stable. The hide timer is not armed while the
   * options panel is open: re-showing the chrome would push its scope above
   * the panel's.
   */
  const optionsOpenRef = useRef(false);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (optionsOpenRef.current) return;
    hideTimer.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, []);

  /** Hide now and clear the timer, so it cannot fire against a chrome since re-shown. */
  const hideChrome = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = undefined;
    setChromeVisible(false);
  }, []);

  useEffect(() => {
    showChrome();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, [showChrome]);

  /**
   * Any press re-shows the chrome; with it hidden, left or right also seeks
   * through the scrubber's ladder. The chrome is unmounted while hidden, so
   * focus moves to the scrubber in the effect below, once it is registered.
   */
  const focusScrubberOnShow = useRef(false);

  useEffect(
    () =>
      tvFocus.onCommand((command) => {
        const hidden = !chromeVisibleRef.current;
        showChrome();
        if (!hidden) return;
        if (command !== 'left' && command !== 'right') return;
        focusScrubberOnShow.current = true;
        seekByHeldKeyRef.current(command === 'left' ? -1 : 1);
      }),
    [showChrome],
  );

  useEffect(() => {
    if (!chromeVisible || !focusScrubberOnShow.current) return;
    focusScrubberOnShow.current = false;
    tvFocus.select(SCRUBBER_FOCUS_ID);
  }, [chromeVisible]);


  // Selected before the chrome mounts: a control registering into the
  // selection takes it.
  useEffect(() => {
    if (returnedFromExit === 0) return;
    showChrome();
    tvFocus.select(PLAY_PAUSE_FOCUS_ID);
  }, [returnedFromExit, showChrome]);

  // The options panel takes the D-pad while open.
  useEffect(() => {
    if (!optionsOpen) return undefined;
    tvFocus.pushScope(OPTIONS_SCOPE);
    return () => tvFocus.popScope(OPTIONS_SCOPE);
  }, [optionsOpen]);

  /** The too-slow overlay takes the D-pad while it is up. */
  const tooSlow = Boolean(playback?.fatalError) && playbackFailureCode(playback?.fatalError) === TOO_SLOW_TO_PLAY_CODE;
  useEffect(() => {
    if (!tooSlow) return undefined;
    tvFocus.pushScope(FAILURE_SCOPE);
    return () => tvFocus.popScope(FAILURE_SCOPE);
  }, [tooSlow]);

  // The chrome owns the D-pad while up (the web client scopes to
  // `.player-chrome.visible`), except under the failure's buttons, where its
  // scope would stack above theirs.
  useEffect(() => {
    if (!chromeVisible || tooSlow) {
      tvFocus.popScope(CHROME_SCOPE);
      return undefined;
    }
    tvFocus.pushScope(CHROME_SCOPE);
    return () => tvFocus.popScope(CHROME_SCOPE);
  }, [chromeVisible, tooSlow]);

  // The panel holds the chrome open: auto-hide would unmount the scope in use.
  useEffect(() => {
    optionsOpenRef.current = optionsOpen;
    if (optionsOpen && hideTimer.current) clearTimeout(hideTimer.current);
    // Closing the panel hands the chrome back to its ordinary timer.
    if (!optionsOpen) showChrome();
  }, [optionsOpen, showChrome]);

  /**
   * Back unwinds one layer per press: panel, chrome, then player. Registered
   * here because `BackHandler` calls listeners in reverse registration order
   * and this screen mounts after the root; returning `false` hands the press
   * to the app, which writes the resume point and stops the session.
   */
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (optionsOpen) {
        setOptionsOpen(false);
        return true;
      }
      if (chromeVisibleRef.current) {
        hideChrome();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [optionsOpen, hideChrome]);

  const event = playback?.event;
  const duration = event?.durationMs ?? media.durationMs ?? 0;
  /**
   * The scrub preview, else core's intent, as in the web client's
   * `PlayerScreen.tsx`. Not `event.positionMs`, which reports the old position
   * until the player has moved, so the bar would snap back.
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
   * Accelerating seek, ported from the web client: the ladder climbs on time
   * held, not on auto-repeat count. See `seekAcceleration.ts`.
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

  // `seekByHeldKey` stays stable and reaches the latest `nudge` through this ref.
  const nudgeRef = useRef(nudge);
  nudgeRef.current = nudge;
  const seekByHeldKeyRef = useRef(seekByHeldKey);
  seekByHeldKeyRef.current = seekByHeldKey;

  // Core's `describePlaybackSession`, as the web client uses it. The endpoint
  // becomes the node's name (`nodeName`), never the whole URL; absent parts are
  // omitted, not defaulted.
  const described = describePlaybackSession(playback?.session, event?.streamOrigin);
  const streamStatus = described && { ...described, endpoint: nodeName(described.endpoint, described.endpointName) };

  /**
   * The session id shows only with Diagnostics on: the node lists no session
   * ids, and reproducing a reaped session needs one. Read per render; the
   * setting cannot change without leaving the player.
   */
  const diagnostics = failureTrailEnabled();

  /**
   * The trail as it fills: a failover that recovers shows no failure screen,
   * and a release build writes no console. Polled because core's buffer has
   * `snapshot()` and no subscription, and a stall stops renders.
   */
  const [liveTrail, setLiveTrail] = useState<PlaybackFailureTrailEntry[]>([]);
  useEffect(() => {
    if (!diagnostics) {
      setLiveTrail([]);
      return;
    }
    let signature = '';
    const read = () => {
      const next = playbackFailureTrail(undefined, LIVE_DETAIL_CHARS, 'info').slice(-LIVE_TRAIL_ENTRIES);
      const nextSignature = trailSignature(next);
      if (nextSignature === signature) return;
      signature = nextSignature;
      setLiveTrail(next);
    };
    read();
    const timer = setInterval(read, LIVE_TRAIL_POLL_MS);
    return () => clearInterval(timer);
  }, [diagnostics]);

  // Composed here: the description is data, and its `video` and `audio` are
  // objects that would throw inside a `<Text>`.
  const streamLines = useMemo(() => {
    const worded = streamLinesText(streamStatus);
    return [
      [worded.container, streamStatus?.endpoint].filter(Boolean).join(' : '),
      worded.video,
      worded.audio,
      worded.subtitle,
    ].filter((line): line is string => Boolean(line));
  }, [streamStatus]);

  const playedPercent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const bufferedPercent = duration > 0 ? Math.min(100, (buffered / duration) * 100) : 0;

  return (
    <View style={styles.page}>
      {/* `.player-host` — the video surface, behind everything. */}
      {video ? (
        <VideoView
          player={video}
          style={styles.host}
          // expo-video's controls are pointer-shaped and would take D-pad focus.
          nativeControls={false}
          contentFit="contain"
        />
      ) : (
        <View style={styles.host} />
      )}

      {/* `.audio-player` */}
      {media.kind === 'track' ? <AudioPresentation track={media} /> : null}

      {playback?.fatalError ? (
        <View style={styles.fatalError}>
          <Text style={styles.fatalTitle}>Playback failed</Text>
          <Text style={styles.fatalMessage}>
            {tooSlow
              ? tooSlowToPlayText(playback.instruction?.quality, playback.session?.transform)
              : (fatal?.headline ?? errorText(playback.fatalError))}
          </Text>
          {tooSlow ? (
            // The web client's two buttons (`PlayerScreen.tsx`, `tooSlow`); the list needs a session.
            <View style={styles.fatalActions}>
              <Button label="Try again" scope={FAILURE_SCOPE} defaultFocus onSelect={() => void runtime.retry()} />
              {playback.session ? (
                <Button label="Choose another quality" scope={FAILURE_SCOPE} onSelect={() => setOptionsOpen(true)} />
              ) : null}
            </View>
          ) : null}
          {fatal?.detail ? <Text style={styles.fatalCode}>{fatal.detail}</Text> : null}
          {fatal?.code ? <Text style={styles.fatalCode}>{fatal.code}</Text> : null}
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

      {/* Not tied to the chrome: a failover arrives long after the last press. */}
      {diagnostics && !playback?.fatalError && liveTrail.length > 0 ? (
        <View style={styles.liveTrail}>
          {liveTrail.map((entry) => (
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

      {/* The spinner, outside the chrome's gate so it outlives the chrome. */}
      {showsBuffering(playback) ? (
        <BufferingOverlay
          delayMs={bufferingDelayMs(starting)}
          note={startWaitNotice(
            starting,
            startWaitMs,
            playback?.startProgress?.kind === 'start'
              ? startProgressText(playback.startProgress, streamStatus?.endpoint)
              : undefined,
          )}
        />
      ) : null}

      {chromeVisible || playback?.fatalError ? (
        <View style={styles.chrome}>
          {/* `.player-titlebar` */}
          <View style={styles.titlebar}>
            <View style={styles.titleCopy}>
              <View style={styles.titleRow}>
                <AvailabilityMarker media={media} />
                <Text style={styles.title} numberOfLines={1}>
                  {media.title}
                </Text>
              </View>
              {media.kind === 'episode' && episodeLabel(media) ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {episodeLabel(media)}
                </Text>
              ) : null}
            </View>
            <View style={styles.streamStatus}>
              {playback?.notice ? (
                <Text style={styles.streamLine}>{playbackNoticeText(playback.notice, playback.instruction?.quality)}</Text>
              ) : playback?.preparingSource ? (
                // The endpoint is the one currently held (the node being replaced
                // during a failover), or the stage a node reports.
                <Text style={styles.streamLine}>
                  {preparingStreamText(playback.startProgress, streamStatus?.endpoint)}
                </Text>
              ) : (
                <>
                  {streamLines.map((line) => (
                    <Text key={line} style={styles.streamLine}>
                      {line}
                    </Text>
                  ))}
                  {diagnostics && playback?.session ? (
                    <Text style={styles.streamLine} numberOfLines={1}>
                      session {playback.session.sessionId}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          </View>

          {/* `.player-options`: inside the chrome, above the scrubber. */}
          {optionsOpen && playback?.session ? (
            <PlayerOptions
              session={playback.session}
              pendingPreferences={playback.pendingPreferences}
              instruction={playback.instruction}
              versions={playback.versions}
              // Core's `offeredModes` for the playing file, which follows
              // failover and file switches: only what this set plays, unless
              // the setting to offer everything is on.
              offeredModes={playback.modes}
              onApply={(update) => {
                runtime.update(update);
                showChrome();
              }}
              onPlayVersion={(step) => {
                void runtime.playVersion(step);
                showChrome();
              }}
              onDismiss={() => {
                setOptionsOpen(false);
                showChrome();
              }}
            />
          ) : null}

          {/* `.player-scrubber-row { grid-template-columns: 4.5rem 1fr 4.5rem }` */}
          <View style={styles.scrubberRow}>
            <Text style={styles.timeLabel}>{formatPlaybackTime(position)}</Text>
            <Focusable
              ring={false}
              focusId={SCRUBBER_FOCUS_ID}
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
            {/* Always drawn, and disabled without a playable neighbour, so the row keeps its shape. */}
            {isEpisode ? (
              <ChromeButton
                icon="previous"
                disabled={!episodeNav?.previous || !availableToPlay(episodeNav.previous)}
                onSelect={() => episodeNav?.previous && availableToPlay(episodeNav.previous) && onPlayEpisode?.(episodeNav.previous)}
              />
            ) : null}
            {/* Fixed steps: the ladder belongs to the scrubber. */}
            <ChromeButton icon="rewind" onSelect={() => { runtime.seekBy(-10_000); showChrome(); }} />
            <ChromeButton
              icon={paused ? 'play' : 'pause'}
              focusId={PLAY_PAUSE_FOCUS_ID}
              defaultFocus
              onSelect={() => { runtime.setPaused(!paused); showChrome(); }}
            />
            <ChromeButton icon="forward" onSelect={() => { runtime.seekBy(10_000); showChrome(); }} />
            {isEpisode ? (
              <ChromeButton
                icon="next"
                disabled={!episodeNav?.next || !availableToPlay(episodeNav.next)}
                onSelect={() => episodeNav?.next && availableToPlay(episodeNav.next) && onPlayEpisode?.(episodeNav.next)}
              />
            ) : null}
            {/*
              * No volume control: the remote's keys drive the set's output stage.
              * `usePlayerVolume` still applies a remembered level.
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
  focusId,
  defaultFocus,
  disabled,
}: {
  icon: PlayerIconName;
  onSelect: () => void;
  focusId?: string;
  defaultFocus?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      scope={CHROME_SCOPE}
      focusId={focusId}
      defaultFocus={defaultFocus}
      disabled={disabled}
      onSelect={onSelect}
      style={[styles.chromeButton, disabled && styles.chromeButtonDisabled]}
      focusedStyle={styles.chromeButtonFocused}
    >
      <PlayerIcon name={icon} />
    </Focusable>
  );
}

const BUTTON = rem(3.25);

const styles = StyleSheet.create({
  // `.player-button-row button:disabled { opacity: .35 }`
  chromeButtonDisabled: {
    opacity: disabledOpacity.playerButton,
  },
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.6),
  },
  title: {
    flexShrink: 1,
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
    height: px(4),
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
    width: px(14),
    height: px(14),
    marginLeft: -7,
    borderRadius: px(7),
    borderWidth: 1,
    borderColor: '#ffffffa8',
    backgroundColor: colour.red400,
  },
  scrubberThumbFocused: {
    borderColor: colour.text,
    transform: [{ scale: 1.25 }],
  },
  // `.player-button-row { justify-content: center; gap: .7rem; margin-top: 1.25rem }`
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
  /** The failure's buttons in a row, spaced as the web's `.secondary-button`s sit. */
  fatalActions: {
    flexDirection: 'row',
    gap: rem(0.6),
    marginTop: rem(0.6),
  },
  /** The server's code, as small print. */
  fatalCode: {
    color: '#7a7a83',
    fontSize: type.small,
    fontVariant: ['tabular-nums'],
  },
  /** Top-left, clear of the bottom-anchored chrome; narrow so a long detail truncates. */
  liveTrail: {
    position: 'absolute',
    left: pageGutter,
    top: rem(1),
    maxWidth: '72%',
    gap: rem(0.15),
    paddingVertical: rem(0.4),
    paddingHorizontal: rem(0.6),
    borderRadius: rem(0.4),
    backgroundColor: '#09090bb8',
  },
  /** Left-aligned and full width: read as a column of times. */
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
  // Truncates, so one long line cannot push older entries off the overlay.
  trailDetail: {
    flexShrink: 1,
    color: '#7a7a83',
    fontSize: type.small,
  },
});
