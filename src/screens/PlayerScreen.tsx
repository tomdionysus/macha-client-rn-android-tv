import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import {
  describePlaybackSession,
  offeredModes,
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
import { Focusable } from '../components/Focusable';
import { PlayerOptions, OPTIONS_SCOPE } from './player/PlayerOptions';
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
import { volumePercent } from '../player/volume';
import { useMacha } from '../app/MachaProvider';
import { PlayerIcon, type PlayerIconName } from '../components/PlayerIcons';
import { tvFocus } from '../hooks/tvFocus';
import { attachPlaybackHost } from '../app/usePlaybackRuntime';
import { usePlaybackFacts } from '../app/usePlaybackFacts';
import { qualityPreferenceStore } from '../state/qualityPreference';
import { px, colour, disabledOpacity, font, pageGutter, radius, rem, type } from '../styles/theme';
import {
  compactEpisodeLabel,
  errorText,
  formatPlaybackTime,
  playbackNoticeText,
  streamLines as streamLinesText,
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
  const volume = usePlayerVolume(runtime, useMacha().volume);
  /**
   * The modes this set can play the file on screen, from core's
   * `offeredModes` (Tom, 2026-09-25: offer only what the device plays, with
   * a setting to offer everything). Per file, because a switch of version
   * changes what the device can do with it.
   */
  const facts = usePlaybackFacts(media.id);
  const playingMediaId = playback?.session?.mediaId;
  const modesOffered = useMemo(() => {
    const file = facts?.files.find((candidate) => candidate.mediaId === playingMediaId);
    if (!facts || !file) return undefined;
    return offeredModes(file.profile, facts.capabilities, {
      operations: file.operations,
      offerAll: qualityPreferenceStore().get().offerAll ?? false,
    });
  }, [facts, playingMediaId]);
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
   * **The panel pins the chrome.** Measured on `.133`, 2026-09-23: with the
   * options panel open, a keypress re-armed the hide timer, the chrome hid,
   * and the next press brought it back — pushing the chrome's focus scope
   * *above* the panel's, so the D-pad moved along the transport row while
   * the panel was on screen. Not arming the timer while the panel is open
   * means the chrome never re-stacks over it.
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
   * Any button brings the controls back.
   *
   * While the chrome is hidden every focusable is out of scope, so the focus
   * registry has no candidate and would swallow the press. Waking on the
   * command itself is what makes the first press of a direction feel like it
   * did something, which is the behaviour the web client gets from its chrome
   * never leaving the DOM.
   */
  /**
   * Any press brings the chrome back — and left or right also seeks.
   *
   * **Tom, 2026-09-19: a tap on the D-pad with the bar hidden should raise it,
   * land on the progress control, and make the move, all at once.** The bar
   * appearing and then having to be steered to is two presses for one
   * intention, and on a remote the viewer's thumb is already on the key that
   * means "back a bit".
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
    optionsOpenRef.current = optionsOpen;
    if (optionsOpen && hideTimer.current) clearTimeout(hideTimer.current);
    // Closing the panel hands the chrome back to its ordinary timer.
    if (!optionsOpen) showChrome();
  }, [optionsOpen, showChrome]);

  /**
   * Back unwinds what is on screen, one layer per press, before it leaves.
   *
   * Tom's rule, given on the set (2026-09-20): **if the controls are up, Back
   * puts them away; the next Back leaves the film.** A television remote has
   * one Back and three things it could mean here, and the viewer's own reading
   * is positional — whatever is covering the picture goes first, and only a
   * press against a clean picture means "I have finished watching".
   *
   * The ladder is panel, chrome, player. It replaces a handler that consumed
   * Back only while the options panel was open and otherwise let the app-level
   * handler tear the session down — so a viewer who pressed Info, read the
   * stream lines and pressed Back lost the film instead of the overlay.
   *
   * Registered here rather than folded into the app-level handler because
   * `BackHandler` invokes listeners in reverse registration order, and this
   * screen mounts after the root — so this runs first and can consume the
   * press. Returning `false` on the last rung is what hands the press back to
   * the app, which writes the resume point and stops the session.
   *
   * Always registered, because the ladder now has a rung for the ordinary
   * case. The hide is the chrome's own, timer and all: leaving the auto-hide
   * timer running would have it fire against a chrome already gone.
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
  const seekByHeldKeyRef = useRef(seekByHeldKey);
  seekByHeldKeyRef.current = seekByHeldKey;

  /**
   * What the node says it is doing to each stream — **core's description, not
   * ours**.
   *
   * This built its own lines until Tom read the two control bars side by side
   * (2026-09-19) and they did not match. They could not: core ships
   * `describePlaybackSession` and the web client calls it, while this assembled
   * something similar from `instruction` — mode with a `(no facts)` suffix,
   * `video …`, `audio …`, and no subtitle line at all. Same intent, different
   * words, and reimplementing what core already ships is the one thing
   * `AGENTS.md` says not to do.
   *
   * The arrangement is the web client's too: carriage and the node that served
   * it on one line as `CONTAINER : endpoint`, because "what was I served, and
   * by whom" is a single question, and either half is omitted rather than
   * defaulted when absent — this is the one place a container the client asked
   * for and did not get can show, and a default would read as an answer.
   */
  const streamStatus = describePlaybackSession(playback?.session, event?.streamOrigin);

  /**
   * The session the node issued, shown only with Diagnostics on.
   *
   * **Because there is no other way to learn it.** Reproducing a reaped
   * session means deleting it out from under a paused client — the web
   * client's recipe, and the only way to do it without waiting out the node's
   * thirty-minute `session_idle` — and that needs the id. The node will not
   * give it — today: `GET /api/v1/playback/sessions` is not a route and
   * `/playback/status` reports a count and no ids. The server's
   * sessions-as-a-resource change (planned 2026-09-21, not yet shipped) adds
   * that list route, which makes the id findable from a laptop; the line
   * stays anyway, because reading it off the screen is still the only way
   * that needs no laptop. The id is in the stream
   * URL, which this client logs to the failure trail, which only renders once
   * playback has already failed — by which time the session under test is
   * gone.
   *
   * Read once per render rather than subscribed to: the setting is changed on
   * the Settings screen, which cannot be reached without leaving the player.
   */
  const diagnostics = failureTrailEnabled();

  /**
   * The trail as it fills, not as a failure screen recites it.
   *
   * **This is the diagnostic `TODO/ACTIVE.md` §1.0 ends on.** The first
   * failover on hardware (2026-09-20) recovered with nothing visible: no
   * failure screen, and therefore no trail, at exactly the moment the trail
   * was the evidence. Which channel carried that recovery — a terminal error
   * classified as `not-found`, or a stall that reached core as degradation and
   * promoted a standby elsewhere — is unsettled, and the whole `not-found`
   * contract on this platform turns on it. Both channels already write
   * warnings: this client logs `stalled`, `terminal-failure-classified` and
   * `standby-promoted`, and core's coordinator logs `source-reaped`,
   * `session-reaped-regenerating`, `source-degradation-evidence` and
   * `alternate-promoted-on-degradation`. The trail filters warnings and errors
   * from every scope, so it already holds the answer. Nothing could read it.
   *
   * The web client does not have this and does not need it: it renders the
   * trail only under a failure because a browser keeps the same buffer
   * reachable from a console, and its Android build bridges it to logcat. A
   * release build here writes no console at all — `diagnostics/playbackLog.ts`
   * turns it off outside `__DEV__` because the bridge costs real CPU on this
   * panel — and a television has neither a console nor, over a link the set's
   * own notes call the unreliable half, a dependable `adb`. On screen is the
   * only place this can be read.
   *
   * **Polled rather than subscribed or rendered.** Core's diagnostics buffer
   * offers `snapshot()` and no subscription, and the obvious alternative —
   * reading it on every render, which the player already does four times a
   * second from `timeUpdate` — fails on exactly the case it is for: a stall
   * stops the time updates, so the renders stop with them and the screen
   * freezes on the last reading taken before the thing worth seeing. A timer
   * keeps reading when the picture does not.
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

  // Composed here since core's cut: the description is data, and its `video`
  // and `audio` are objects that would throw inside a `<Text>`.
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
          <Text style={styles.fatalMessage}>{fatal?.headline ?? errorText(playback.fatalError)}</Text>
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

      {chromeVisible || playback?.fatalError ? (
        <View style={styles.chrome}>
          {/* `.player-titlebar` */}
          <View style={styles.titlebar}>
            <View style={styles.titleCopy}>
              <Text style={styles.title} numberOfLines={1}>
                {media.title}
              </Text>
              {media.kind === 'episode' && compactEpisodeLabel(media) ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {compactEpisodeLabel(media)}
                </Text>
              ) : null}
            </View>
            <View style={styles.streamStatus}>
              {playback?.notice ? (
                <Text style={styles.streamLine}>{playbackNoticeText(playback.notice)}</Text>
              ) : playback?.preparingSource ? (
                // The one moment the client is moving between nodes, and
                // "which node" is the only question worth asking about it. The
                // endpoint shown is the one currently held — the node being
                // replaced during a failover — so watching this line through a
                // failover shows how far round the cluster it has got.
                <Text style={styles.streamLine}>
                  {streamStatus?.endpoint
                    ? `Preparing new stream on ${streamStatus.endpoint}…`
                    : 'Preparing new stream…'}
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
            `.player-options` sits **inside the chrome, above the scrubber** on
            the web client — a block of rows, not a pane. It was a 42%-wide
            side panel here until Tom called it off the set; the same groups in
            the same order, but in the wrong shape and in the wrong place.
          */}
          {optionsOpen && playback?.session ? (
            <PlayerOptions
              session={playback.session}
              pendingPreferences={playback.pendingPreferences}
              instruction={playback.instruction}
              versions={playback.versions}
              offeredModes={modesOffered}
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
              * **Previous and next episode, on every episode** (Tom,
              * 2026-09-23, business P0) — whether it was started from
              * Continue Watching or from its season. Always drawn, and greyed
              * out when there is no neighbour or core has not answered yet,
              * so the row never changes shape under the viewer's thumb. A
              * greyed button takes no focus, so the D-pad steps over it.
              *
              * Placed outside rewind/forward, the order media controls take
              * everywhere: the web client's music bar reads previous, play,
              * next.
              */}
            {isEpisode ? (
              <ChromeButton
                icon="previous"
                disabled={!episodeNav?.previous}
                onSelect={() => episodeNav?.previous && onPlayEpisode?.(episodeNav.previous)}
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
                disabled={!episodeNav?.next}
                onSelect={() => episodeNav?.next && onPlayEpisode?.(episodeNav.next)}
              />
            ) : null}
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
   * content — titles, faces, subtitles — is centre and lower. Half the width
   * so a long detail truncates rather than drawing a band across the frame,
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
