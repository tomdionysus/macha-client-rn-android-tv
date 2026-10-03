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

/**
 * How often the live trail re-reads the diagnostics buffer.
 *
 * A second is far below the rate at which a failover produces lines and far
 * above the cost of reading a 200-entry ring buffer, and it is only paid with
 * Diagnostics on.
 */
const LIVE_TRAIL_POLL_MS = 1_000;

/** The scrubber, by name, so a cold left or right press can land on it. */
const SCRUBBER_FOCUS_ID = 'player-scrubber';

/** The focus scope name; while the chrome is up nothing behind it is reachable. */
const CHROME_SCOPE = 'player-chrome';

/**
 * The failure's own buttons (Try again, Choose another quality). A scope of
 * their own, because the failure overlay outlives the chrome's four-second
 * hide: in the chrome's scope they would drop out of reach while still on
 * screen.
 */
const FAILURE_SCOPE = 'player-failure';


export function PlayerScreen({
  media,
  runtime,
  onClose,
  episodeNav,
  onPlayEpisode,
}: {
  media: MediaSummary;
  runtime: PlaybackRuntime;
  onClose: () => void;
  /** The episodes either side, for an episode. Ignored for anything else. */
  episodeNav?: EpisodeNavigation;
  onPlayEpisode?: (episode: Episode) => void;
}): React.JSX.Element {
  const [playback, setPlayback] = useState<PlaybackCoordinatorSnapshot | undefined>(() =>
    runtime.getPlaybackSnapshot(),
  );
  const isEpisode = media.kind === 'episode';
  const [chromeVisible, setChromeVisible] = useState(true);
  /**
   * Read by the command subscription, which is made once and must not be torn
   * down and rebuilt every time the chrome hides — that is the moment its
   * events matter most.
   */
  const chromeVisibleRef = useRef(chromeVisible);
  chromeVisibleRef.current = chromeVisible;
  const [optionsOpen, setOptionsOpen] = useState(false);
  usePlayerVolume(runtime, useMacha().volume);
  // How long this start has been going on, for the spinner's note. Counted
  // here because core says `starting` without saying since when.
  const starting = playback?.starting ?? false;
  const startWaitMs = useElapsedMs(starting);
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
  /**
   * What the overlay says, decided once per failure.
   *
   * The server's code goes on the trail as well as into the small print,
   * because the trail is the only record that outlives the overlay — and it
   * is logged here rather than by the adapter because only the coordinator's
   * assembled error carries the whole chain. See `failureCopy`.
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

  /**
   * Read by `showChrome`, which is stable and so cannot see the state.
   *
   * **The panel pins the chrome.** If the hide timer ran while the options
   * panel was open, the next press would re-show the chrome and push its focus
   * scope *above* the panel's, handing the D-pad to the transport row behind
   * the panel. Not arming the timer while the panel is open prevents that.
   */
  const optionsOpenRef = useRef(false);

  const showChrome = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (optionsOpenRef.current) return;
    hideTimer.current = setTimeout(() => setChromeVisible(false), CHROME_HIDE_MS);
  }, []);

  /**
   * Put the chrome away now, as the auto-hide would have done later.
   *
   * The timer is cleared with it: a Back that hid the chrome and left the
   * timer armed would fire a `setChromeVisible(false)` against a chrome the
   * viewer had already brought back with the next press.
   */
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
   * Any press brings the chrome back, and left or right also seeks.
   *
   * While the chrome is hidden every focusable is out of scope, so the focus
   * registry has no candidate and would swallow the press; waking on the
   * command itself is what the web client gets from its chrome never leaving
   * the DOM. A left or right with the bar hidden raises it, lands on the
   * progress control and makes the move, all in one press.
   *
   * The seek runs through the same ladder as a press on the focused scrubber,
   * so holding from cold accelerates exactly as holding on it does — it is one
   * hold either way, and only the first press of it is special.
   *
   * Focus cannot be moved here: the chrome is unmounted while hidden, so the
   * scrubber is not registered yet. The flag is spent by the effect below,
   * once it exists.
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


  // The options panel takes the D-pad outright while it is open, so the
  // transport behind it cannot be reached by pressing through the panel.
  useEffect(() => {
    if (!optionsOpen) return undefined;
    tvFocus.pushScope(OPTIONS_SCOPE);
    return () => tvFocus.popScope(OPTIONS_SCOPE);
  }, [optionsOpen]);

  /**
   * A quality the viewer chose that no node converts at real speed stops with
   * a stated reason and a Try again. The overlay takes the D-pad while it is
   * up, as the panel does.
   */
  const tooSlow = Boolean(playback?.fatalError) && playbackFailureCode(playback?.fatalError) === TOO_SLOW_TO_PLAY_CODE;
  useEffect(() => {
    if (!tooSlow) return undefined;
    tvFocus.pushScope(FAILURE_SCOPE);
    return () => tvFocus.popScope(FAILURE_SCOPE);
  }, [tooSlow]);

  // While the chrome is up it owns the D-pad entirely, mirroring the web
  // client scoping its candidate query to `.player-chrome.visible` — except
  // over the failure's buttons: any press re-shows the chrome, and pushing its
  // scope then would stack it above them, as with the panel above.
  useEffect(() => {
    if (!chromeVisible || tooSlow) {
      tvFocus.popScope(CHROME_SCOPE);
      return undefined;
    }
    tvFocus.pushScope(CHROME_SCOPE);
    return () => tvFocus.popScope(CHROME_SCOPE);
  }, [chromeVisible, tooSlow]);

  // The panel holds the chrome open under it: letting the auto-hide run would
  // unmount the scope the viewer is currently navigating.
  useEffect(() => {
    optionsOpenRef.current = optionsOpen;
    if (optionsOpen && hideTimer.current) clearTimeout(hideTimer.current);
    // Closing the panel hands the chrome back to its ordinary timer.
    if (!optionsOpen) showChrome();
  }, [optionsOpen, showChrome]);

  /**
   * Back unwinds what is on screen, one layer per press, before it leaves.
   *
   * **If the controls are up, Back puts them away; the next Back leaves the
   * film.** Whatever is covering the picture goes first, and only a press
   * against a clean picture means "I have finished watching". The ladder is
   * panel, chrome, player.
   *
   * Registered here rather than folded into the app-level handler because
   * `BackHandler` invokes listeners in reverse registration order, and this
   * screen mounts after the root — so this runs first and can consume the
   * press. Returning `false` on the last rung hands the press back to the app,
   * which writes the resume point and stops the session.
   *
   * The hide is the chrome's own, timer and all: leaving the auto-hide timer
   * running would have it fire against a chrome already gone.
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
   * What the scrubber shows: the viewer's own preview, then **core's intent**.
   *
   * Not `event.positionMs`: after a seek is dispatched the player goes on
   * reporting the old position until it has actually moved, so the bar would
   * snap back to where the viewer started and then jump forward.
   *
   * `intent.positionMs` is the position core is holding the transport at, and
   * core keeps holding it until the player is tracking again — that is what
   * `seekIntentActive` is for. So the bar moves once, to where the viewer asked
   * to be, and stays there. This matches what the web client's
   * `PlayerScreen.tsx` renders.
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
  const seekByHeldKeyRef = useRef(seekByHeldKey);
  seekByHeldKeyRef.current = seekByHeldKey;

  /**
   * What the node says it is doing to each stream — **core's description
   * (`describePlaybackSession`), as the web client uses it**, so the two
   * control bars read alike.
   *
   * The arrangement is the web client's too: carriage and the node that served
   * it on one line as `CONTAINER : endpoint`, because "what was I served, and
   * by whom" is a single question, and either half is omitted rather than
   * defaulted when absent — this is the one place a container the client asked
   * for and did not get can show, and a default would read as an answer.
   */
  // The node by the cluster's name for it, else its host, never the whole URL
  // (`nodeName`), here where the description is built, so every line that
  // reads `endpoint` gets the name.
  const described = describePlaybackSession(playback?.session, event?.streamOrigin);
  const streamStatus = described && { ...described, endpoint: nodeName(described.endpoint, described.endpointName) };

  /**
   * The session the node issued, shown only with Diagnostics on.
   *
   * Reproducing a reaped session means deleting it out from under a paused
   * client, without waiting out the node's thirty-minute `session_idle`, and
   * that needs the id. The node lists no session ids
   * (`/playback/status` reports only a count), and the failure trail that
   * carries the stream URL renders only after playback has failed, by which
   * time the session under test is gone. Reading it off the screen needs no
   * laptop.
   *
   * Read once per render rather than subscribed to: the setting is changed on
   * the Settings screen, which cannot be reached without leaving the player.
   */
  const diagnostics = failureTrailEnabled();

  /**
   * The trail as it fills, not as a failure screen recites it.
   *
   * A failover that recovers shows no failure screen, and therefore no trail,
   * so this is the only way to see which path carried it. Both paths write
   * warnings: this client logs `stalled`, `terminal-failure-classified` and
   * `standby-promoted`, and core's coordinator logs `source-reaped`,
   * `session-reaped-regenerating`, `source-degradation-evidence` and
   * `alternate-promoted-on-degradation`. The trail filters warnings and errors
   * from every scope.
   *
   * The web client renders the trail only under a failure because a browser
   * keeps the same buffer reachable from a console. A release build here
   * writes no console at all (`diagnostics/playbackLog.ts` turns it off
   * outside `__DEV__`), so on screen is the only place this can be read.
   *
   * **Polled rather than subscribed or rendered.** Core's diagnostics buffer
   * offers `snapshot()` and no subscription, and reading it on every render
   * fails on exactly the case it is for: a stall stops the time updates, so the
   * renders stop with them. A timer keeps reading when the picture does not.
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
          // The chrome in this file is the only chrome. expo-video's own
          // controls are pointer-shaped and would take D-pad focus away from
          // the focus scorer, which is the one thing this client must own.
          nativeControls={false}
          contentFit="contain"
        />
      ) : (
        <View style={styles.host} />
      )}

      {/* `.audio-player` — a track has no picture, so its artwork and what it is. */}
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
            // The web client's two buttons (`PlayerScreen.tsx`, `tooSlow`).
            // The list is offered only while there is a session to change.
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

      {/*
        The same lines as the failure overlay, while there is no failure.

        Deliberately **not tied to the chrome**, which hides four seconds after
        the last press: a failover arrives minutes after anyone last touched
        the remote, and a diagnostic that is only up while somebody is pressing
        buttons would miss every one. It is up whenever Diagnostics is on, and
        Diagnostics is off for everybody who is watching a film.
      */}
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
                // The one moment the client is moving between nodes, and
                // "which node" is the only question worth asking about it. The
                // endpoint shown is the one currently held — the node being
                // replaced during a failover — so watching this line through a
                // failover shows how far round the cluster it has got. A node
                // that reports a change's progress names the stage instead,
                // while the current picture plays on.
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

          {/*
            `.player-options` sits **inside the chrome, above the scrubber**, as
            on the web client: a block of rows, not a side pane.
          */}
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
            {/*
              * **Previous and next episode, on every episode**, whether it was
              * started from Continue Watching or from its season. Always
              * drawn, and greyed out when there is no neighbour, it is
              * unavailable, or core has not answered yet, so the row never changes shape under the
              * viewer's thumb. A greyed button takes no focus, so the D-pad
              * steps over it.
              *
              * Placed outside rewind/forward, the order media controls take
              * everywhere: the web client's music bar reads previous, play,
              * next.
              */}
            {isEpisode ? (
              <ChromeButton
                icon="previous"
                disabled={!episodeNav?.previous || !availableToPlay(episodeNav.previous)}
                onSelect={() => episodeNav?.previous && availableToPlay(episodeNav.previous) && onPlayEpisode?.(episodeNav.previous)}
              />
            ) : null}
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
            {isEpisode ? (
              <ChromeButton
                icon="next"
                disabled={!episodeNav?.next || !availableToPlay(episodeNav.next)}
                onSelect={() => episodeNav?.next && availableToPlay(episodeNav.next) && onPlayEpisode?.(episodeNav.next)}
              />
            ) : null}
            {/*
              * **No volume control here.** The remote's volume keys drive the
              * set's output stage; an app-level level would be a second,
              * invisible multiplier underneath it.
              *
              * `VolumeStore` and `usePlayerVolume` stay wired: core's
              * `setVolume` still applies a remembered level, and a promoted
              * standby comes up at it.
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
  disabled,
}: {
  icon: PlayerIconName;
  onSelect: () => void;
  defaultFocus?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      scope={CHROME_SCOPE}
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
  /** The server's code, as small print: for whoever is debugging, never the viewer's line. */
  fatalCode: {
    color: '#7a7a83',
    fontSize: type.small,
    fontVariant: ['tabular-nums'],
  },
  /**
   * The live trail, at the top of the screen and out of the chrome's way.
   *
   * Top-left because the chrome is bottom-anchored and the picture's own
   * content — titles, faces, subtitles — is centre and lower. Narrower than
   * the screen so a long detail truncates rather than drawing a band across the frame,
   * and a background dark enough to read against a bright scene without
   * blacking out what is behind it.
   */
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
