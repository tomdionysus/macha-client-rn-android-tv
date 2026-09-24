import { createVideoPlayer, type BufferOptions, type VideoPlayer, type VideoSource } from 'expo-video';
import {
  ENDPOINT_TRANSPORT_ALLOWANCE_MS,
  generationAttemptBudgetMs,
  machaHost,
  MediaStallWatchdog,
  MediaStartWatchdog,
  PlaybackSourceError,
  playbackFailureKindForStatus,
  preflightHlsSource,
  probeHlsReadiness,
  replacementLeadTimeMs,
  type PlaybackEvent,
  type PlaybackHost,
  type PlaybackFailureKind,
  type PlaybackSource,
  type PlaybackTimeRange,
  type PlaybackTransition,
  type Player,
  type MediaWatchdogEnvironment,
} from '@machafoundation/core';
import { createWatchdogEnvironment } from './watchdogEnvironment';
import { awaitFirstFragment } from './readiness';
import { firstFragmentTimeoutMs } from './timingBudgets';
import { playbackLog } from '../diagnostics/playbackLog';
import { decoderFailureKind } from './playerErrorKind';

/**
 * Buffer ahead the way the web client does.
 *
 * **Tom, 2026-09-19: the client must buffer ahead, as the web client does, and
 * in the same way.** That client configures hls.js with `maxBufferLength: 60`
 * (`WebHlsPolicy.webHlsBufferConfig`, read there rather than remembered);
 * `expo-video` defaults Android to **20**. Three times less cover, in exactly
 * the quantity everything about failover is decided on: the runway is what core
 * defers a replacement behind, and it is what this adapter spends classifying a
 * failure. Their measurements talk about sixty seconds in hand because they
 * have sixty seconds in hand.
 *
 * **The byte ceiling is deliberately not copied.** Theirs is 128 MB, set on a
 * desktop browser; this set is `armeabi-v7a` with no arm64, and an allocation
 * failure mid-film is a worse outcome than a shorter buffer. `0` leaves the
 * ceiling to the platform, which is the same intent expressed against different
 * hardware — and `prioritizeTimeOverSizeThreshold` stays at its default so the
 * size ceiling still wins, rather than the sixty seconds being held against a
 * 4K HEVC bitrate on a 32-bit device. **What forward buffer is actually reached
 * on a high-bitrate title is unmeasured**, and is the thing to read off the set
 * (`TODO/ACTIVE.md` §1.7's sitting).
 */
const BUFFER_OPTIONS: BufferOptions = {
  preferredForwardBufferDuration: 60,
  maxBufferBytes: 0,
};

/**
 * Core's `Player`, implemented over `expo-video`.
 *
 * **Why this exists alongside `ExoPlayerAdapter`.** The native module in
 * `modules/macha-player` is a complete Media3 player that has never been run.
 * `expo-video` is also Media3 underneath, so it reaches the same hardware
 * decoders and can direct-play E-AC-3 — which is the whole premise of this
 * project — and it is proven working in the phone client. Tom's decision on
 * 2026-09-10 was to get a picture on the screen with the proven component and
 * settle the 5.1 measurement first, then revisit. `ExoPlayerAdapter` stays in
 * the tree, unused, for that revisit.
 *
 * **What is knowingly given up while this is the player**, so none of it is
 * rediscovered as a bug:
 *
 * - **Byte-level source control.** `expo-video` builds its
 *   `OkHttpDataSource.Factory` internally (`utils/DataSourceUtils.kt`) with no
 *   injection point, so there is no per-request control and no HTTP status on
 *   what the player's own loader hits. `addDirectSourceAlternative` is not
 *   implemented for that reason — deliberately, not by oversight.
 *
 *   **This does not cost seamless failover**, which an earlier version of this
 *   paragraph claimed: handover does not live in the transport. `VideoView`'s
 *   player setter holds the shutter open for a pre-warmed player, so a second
 *   `VideoPlayer` can be primed and promoted — which is what `preflightSource`
 *   and `promoteStandby` below do.
 * - **Audio focus ducking.** `expo-video`'s `AudioFocusManager` halves
 *   `player.volume` on a transient duck and restores from its own
 *   `userVolume`, rather than keeping ducking as a separate multiplier.
 *
 * **What is *not* given up:** capability detection still comes from
 * `MediaCodecList` through `MachaPlayer.capabilities()`. That native reader is
 * independent of the native player, so the set still direct-plays everything
 * the panel can decode rather than falling back to a hardcoded list.
 */
export class ExpoVideoAdapter implements Player {
  private listeners = new Set<(event: PlaybackEvent) => void>();
  private failureListeners = new Set<(error: Error) => void>();
  private degradationListeners = new Set<(error: Error) => void>();
  private subscriptions: { remove(): void }[] = [];
  private released = false;
  private ended = false;
  private seeking = false;

  /**
   * The surface `PlayerScreen` renders. Presentation only; never policy.
   *
   * **Not stable across a promotion.** A warm standby is a second
   * `VideoPlayer`, and promoting it swaps which instance is active, so anything
   * rendering this must follow `subscribePlayerChange` rather than capture it
   * once. `expo-video` supports the swap deliberately — `VideoView`'s setter
   * checks `hasSentFirstFrameForCurrentMediaItem` on the incoming player.
   */
  get video(): VideoPlayer {
    return this.active;
  }

  private active: VideoPlayer;
  private playerListeners = new Set<(player: VideoPlayer) => void>();

  /**
   * A source primed and buffering, ready to take over.
   *
   * Keyed by URL because that is all core gives us to recognise *which* source
   * this is: promotion arrives as an ordinary `play()` carrying the one we were
   * asked to preflight, with no separate hook. Since core 0.14.0 the
   * `transition` argument says whether the swap may be hidden, which is a
   * different question from which source it is — both have to agree before the
   * standby is cut to. See `promoteStandby`.
   */
  private standby?: { url: string; player: VideoPlayer };

  /** Last volume core asked for, so a promoted standby comes up at it. */
  private volume = 1;

  /**
   * The cover the element last reported, in media time, and when it said so.
   *
   * Kept from the event stream rather than read when it is wanted, because it
   * is wanted exactly when the player has failed — and a player in its error
   * state may report nothing about a buffer it is still holding. Core reads its
   * own `elementRunwayMs()` off the last event for the same reason, so this is
   * that quantity rather than an approximation of it: core's runway is the
   * element's plus a host read-ahead's, and there is no read-ahead here.
   *
   * **The instant matters as much as the figure.** A last known value does not
   * decay and the buffer it describes does, so a stale sample over-reports
   * cover by however long it has been standing — which is the dangerous
   * direction for anything spending that cover, because it grants a budget that
   * no longer exists. Found by the core session while reading this for a
   * different question; it has the same exposure at its own deferral decision.
   * The monotonic clock, because this is a duration.
   */
  private lastForwardBufferMs = 0;

  private lastForwardBufferAt?: number;

  /**
   * Whether the viewer wants this playing.
   *
   * **Not `!this.video.playing`**, which is the mistake the web client names:
   * between a play request and the element actually running, the player is
   * still not playing while the viewer is very much waiting — and that window
   * is exactly when a node refusing the stream must be judged rather than
   * excused.
   */
  private wantsPlayback = false;

  /** The source the active player is on, for re-asking a node after a park. */
  private activeSource?: PlaybackSource;

  /**
   * A terminal error raised while nobody was waiting for a picture.
   *
   * Every judgement this adapter makes is "is this node failing the person
   * watching", and while playback is paused there is nobody to fail. A node
   * that dies during a pause has hurt no one yet, and reporting it tears down a
   * generation nothing is using: core fails over, the viewer comes back to a
   * failure screen naming a node they never asked for, and the session they
   * were actually on is gone. The web client measured exactly that — a pause
   * ending on `Playback failed` two minutes in — and answered it by parking the
   * load instead of judging it (`WebHlsPolicy.managedHlsErrorAction`,
   * `park-paused`). This is the same decision on a platform that cannot reach
   * its loader to park it, so the source is re-asked on resume instead.
   *
   * Held rather than dropped, because the error is very likely still true: it is
   * met again at `resume()`, with the viewer present and this adapter in the
   * state where it knows what to do about it.
   */
  private parked?: { source: PlaybackSource; positionMs: number; message: string };

  /**
   * What a node last said about a source, in a status.
   *
   * `expo-video` reports `{ message: string }` and nothing else, so a terminal
   * error from its own loader carries no status to classify. The web client has
   * exactly this problem on its Direct Play path — a 404 body handed to the
   * element as media raises a generic decode error — and did **not** parse the
   * message: the layer that does see statuses latches what it learned, and the
   * statusless error is reinterpreted against that memory. This is the same
   * latch, fed by the readiness walk, which is the only thing here that makes
   * its own requests.
   *
   * **Cleared at every `play()`, and keyed by URL as well.** The web session
   * observes that a stream URL carries a per-generation index — a fresh session
   * served `/…/1/master.m3u8`, one that had taken about fifty PATCHes served
   * `/…/50/` — which would make the URL generation-unique on its own. But that
   * is two captures rather than a contract, and core says outright that the URL
   * shape is the server's to change: 0.32.12 turned `master.m3u8` from a media
   * playlist into a master one without renaming it. So correctness does not
   * rest on it. The verdict is discarded when a new source is attached, which
   * is the only lifetime it was ever meant to have, and the URL check is what
   * is left if a stale one somehow survives.
   *
   * The cheap direction is an extra probe; the expensive one is answering for a
   * generation nobody asked about.
   */
  private sourceVerdict?: { url: string; kind: PlaybackFailureKind };

  /** A player a promotion replaced, awaiting presentation letting go of it. */
  private retired?: VideoPlayer;

  /**
   * Which `play()` call is the current one.
   *
   * Needed only because `play()` can now await: the readiness walk can run
   * for up to five server holds, and core is free to call `play()` again in
   * the meantime — a failover, a quality change, or the viewer picking
   * something else. Without this, the older walk would finish afterwards and
   * hand the player a source two generations stale, silently replacing what
   * the viewer is actually watching.
   */
  private sourceGeneration = 0;

  /**
   * Rebuilt per attach, because its budget belongs to the node.
   *
   * `MediaStallWatchdog` takes the serving node's figures through
   * `useSourceBudgets()`; the start watchdog has no such method — its budget is
   * a constructor argument — so the equivalent is a fresh one per source. Core
   * gives the figure either way (Tom, 2026-09-19): the same deadline the
   * readiness walk uses, stated by the node or derived from the server's
   * defaults for one that cannot say. Left at its own default it would judge
   * every node by `MEDIA_START_STARVATION_MS`, a compiled-in 20 s, against
   * nodes that now say what they are entitled to spend.
   */
  private startWatchdog: MediaStartWatchdog;
  private readonly stallWatchdog: MediaStallWatchdog;
  private readonly watchdogEnvironment: MediaWatchdogEnvironment;

  constructor() {
    // Constructed with no source: `attach` binds presentation and must not
    // create a playback session, so the session begins at `play()`.
    this.active = createVideoPlayer(null);
    this.active.bufferOptions = BUFFER_OPTIONS;
    // Media3 keeps the screen awake itself when told to. The WebView client
    // never had this and dimmed through films; a CPU wake lock is not enough.
    this.active.keepScreenOnWhilePlaying = true;
    // Emitted often enough for the scrubber and the stall watchdog to have
    // something to judge, without flooding the bridge.
    this.active.timeUpdateEventInterval = 0.25;

    const environment = createWatchdogEnvironment();
    this.watchdogEnvironment = environment;
    this.startWatchdog = new MediaStartWatchdog(environment);
    this.stallWatchdog = new MediaStallWatchdog(environment);

    this.subscriptions.push(...this.bindPlayer(this.active));
  }

  /**
   * Wire one player's events to this adapter.
   *
   * Extracted because a promotion re-points the adapter at a different
   * instance and the new one has to carry the same wiring — the events are the
   * adapter's contract with core, not the player's.
   */
  private bindPlayer(video: VideoPlayer): { remove(): void }[] {
    return [
      video.addListener('timeUpdate', () => this.emit()),
      video.addListener('playingChange', () => this.emit()),
      video.addListener('playToEnd', () => {
        this.ended = true;
        this.stallWatchdog.suspend();
        this.emit();
      }),
      video.addListener('statusChange', ({ status, error }) => {
        if (status === 'error') {
          const message = error?.message ?? 'Playback failed';
          // Nobody is waiting, so nothing here is evidence yet. Parked and
          // re-asked on resume rather than reported — see `parked`.
          if (!this.wantsPlayback && this.activeSource) {
            this.parked = {
              source: this.activeSource,
              // The position to come back to. Read now, because the player is
              // in its error state and will be replaced to escape it.
              positionMs: Math.max(0, this.video.currentTime * 1_000),
              message,
            };
            playbackLog.warn('failure-parked-while-paused', { message });
            return;
          }
          this.reportTerminalPlayerFailure(message);
          return;
        }
        if (status === 'readyToPlay') this.seeking = false;
        this.emit();
      }),
    ];
  }

  private emit(): void {
    const positionMs = Math.max(0, this.video.currentTime * 1_000);
    const durationMs = Math.max(0, this.video.duration * 1_000);
    const bufferedEndMs = Math.max(0, this.video.bufferedPosition * 1_000);
    const paused = !this.video.playing;

    // Any byte at all cancels the start watch: it triggers on *zero bytes
    // ever*, never on "slow", so a merely bad link is never judged by it.
    if (bufferedEndMs > 0 || positionMs > 0) this.startWatchdog.noteProgress();

    if (paused || this.ended) {
      // Paused is not stalled: the viewer stopped it on purpose.
      this.stallWatchdog.suspend();
    } else {
      // Passing the buffer figure is what keeps "slow" distinguishable from
      // "dead": a node producing below realtime freezes the picture while its
      // buffer still grows, and judging on position alone would evict exactly
      // the node doing the work.
      this.stallWatchdog.note(positionMs, bufferedEndMs);
    }

    const snapshot: PlaybackEvent = {
      positionMs,
      durationMs,
      paused,
      ended: this.ended,
      seeking: this.seeking,
      buffering: this.video.status === 'loading',
      bufferedRangesMs: bufferedEndMs > 0 ? [{ startMs: 0, endMs: bufferedEndMs }] : [],
      forwardBufferMs: Math.max(0, bufferedEndMs - positionMs),
    };
    this.lastForwardBufferMs = snapshot.forwardBufferMs ?? 0;
    this.lastForwardBufferAt = machaHost().now();
    for (const listener of this.listeners) listener(snapshot);
  }

  /** Binds presentation only. Must not create a playback session, and does not. */
  attach(_host: PlaybackHost): void {
    this.video.keepScreenOnWhilePlaying = true;
  }

  detachHost(): void {
    this.video.keepScreenOnWhilePlaying = false;
  }

  detach(): void {
    if (this.released) return;
    this.released = true;
    this.wantsPlayback = false;
    this.activeSource = undefined;
    this.parked = undefined;
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    this.listeners.clear();
    this.failureListeners.clear();
    this.degradationListeners.clear();
    this.playerListeners.clear();
    this.discardStandby();
    this.releaseRetiredPlayer();
    this.active.release();
  }

  /**
   * Resolves once dispatched, never when buffering completes.
   *
   * Waiting for buffering here would stall the coordinator's failover timing,
   * which is the machinery that moves a viewer off an unhealthy node.
   *
   * **The one wait that is allowed is the readiness walk**, and it is allowed
   * because it is not waiting for buffering — it is waiting for the node to
   * stop saying `500 segment_not_ready`, which is the node stating it is
   * working. Failing over during that answer is not faster; it is a cold
   * start on a node that does not have the fragment either. See
   * `readiness.ts`.
   *
   * **`transition` is the one bit this adapter cannot work out for itself**,
   * and it decides whether replacing the source may be hidden. See
   * `promoteStandby`.
   */
  async play(
    source: PlaybackSource,
    positionMs = 0,
    startPaused = false,
    transition?: PlaybackTransition,
  ): Promise<boolean> {
    const generation = ++this.sourceGeneration;
    this.ended = false;
    this.seeking = false;
    // Core is asking for a source, so a viewer is waiting on one unless it says
    // otherwise — and anything parked belonged to the generation being replaced.
    this.wantsPlayback = !startPaused;
    this.parked = undefined;
    this.sourceVerdict = undefined;
    this.lastForwardBufferMs = 0;
    this.lastForwardBufferAt = undefined;
    this.video.keepScreenOnWhilePlaying = true;

    // A promotion arrives as an ordinary `play()` carrying the source we were
    // asked to preflight, so this is where a warm standby is cashed in. It
    // does everything the cold path below does, against a player that has
    // already buffered.
    //
    // Checked before the readiness walk, not after: a standby has already
    // been preflighted and is holding bytes, so walking its manifest again
    // would spend up to five server holds re-answering a question that was
    // settled when it was primed — in front of a viewer whose picture has
    // just frozen, which is the worst possible moment to spend it.
    if (this.promoteStandby(source, positionMs, startPaused, transition)) {
      this.activeSource = source;
      this.startWatchdogs(source);
      return true;
    }

    // Any standby still held is for a source core is no longer asking for.
    this.discardStandby();

    if (source.isManifest && !(await this.nodeWillServe(source, generation))) return false;
    // Core asked for something else while we waited. The newer call owns the
    // player now, and finishing this one would overwrite it.
    if (generation !== this.sourceGeneration) return false;

    this.activeSource = source;
    this.startWatchdogs(source);
    this.active.replace(this.videoSourceFor(source));
    if (positionMs > 0) this.active.currentTime = positionMs / 1_000;
    if (startPaused) this.active.pause();
    else this.active.play();
    return true;
  }

  /**
   * Wait out a node's holds before handing `expo-video` the source.
   *
   * Reports its own failure and answers `false` when the node will not serve,
   * so the coordinator fails over on real evidence rather than on the node
   * having said "not yet".
   */
  private async nodeWillServe(source: PlaybackSource, generation: number): Promise<boolean> {
    const readiness = await awaitFirstFragment(source, {
      superseded: () => generation !== this.sourceGeneration,
    });
    if (generation !== this.sourceGeneration) return false;

    // Warned rather than logged when it actually had to wait, because a wait
    // is the node at its production frontier and that is worth seeing on the
    // failure trail. A first-attempt success is routine and stays below the
    // buffer's level.
    if (readiness.attempts > 1) {
      playbackLog.warn('first-fragment-held', { url: source.url, ...readiness });
    } else {
      playbackLog.info('first-fragment', { url: source.url, ...readiness });
    }

    if (readiness.ready) return true;
    if (readiness.status !== undefined) {
      // Remembered as well as reported: the walk is the only thing here that
      // sees a status, so what it learned is what a later statusless error from
      // the player is read against.
      this.sourceVerdict = { url: source.url, kind: playbackFailureKindForStatus(readiness.status) };
    }
    this.reportFailure(
      new PlaybackSourceError(
        `The node did not serve the first fragment: ${readiness.reason}`,
        // The status it answered with, through core's rule — never a blanket
        // `stream`, which is what this said until core 0.13.0 gave `404` a kind
        // of its own. A `404` on a playback route is one session's existence,
        // not the node's health: read as `stream` it is endpoint evidence, and
        // the node that answered honestly is charged a failure and dropped from
        // the candidate list while the viewer is sent to one that never held
        // the session. Reported as `not-found`, core asks that same node
        // whether the session is still there and regenerates on it if not.
        //
        // **Reporting the kind carries an obligation** (`Player.subscribeFailure`):
        // an adapter reporting `not-found` must not tear the presentation down
        // on it, because the element's buffer is the cover a replacement is
        // built behind. Nothing here does — the walk runs before the active
        // player is given anything, so whatever is playing keeps playing, and
        // `reportFailure` touches only the watchdogs. Where there was no status
        // at all the honest answer is still `stream`: the node was asked and
        // did not answer.
        readiness.status !== undefined
          ? playbackFailureKindForStatus(readiness.status)
          : 'stream',
      ),
    );
    return false;
  }

  /**
   * Arm both watchdogs.
   *
   * **Called only once the player has actually been given a source**, which
   * is the ordering the readiness walk depends on:
   * `MEDIA_START_STARVATION_MS` is 20 s and `FIRST_FRAGMENT_TIMEOUT_MS` is
   * 30 s, so arming these first and then waiting would have the start
   * watchdog fire mid-walk and report a `stream` failure against a node that
   * was answering the protocol correctly — the exact spurious failover the
   * walk was written to remove.
   *
   * **The source is passed because the stall budget belongs to the node, not
   * to the watchdog.** A stall must be called only after the node has failed
   * to answer its own hold, and until core 0.14.0 that relationship could only
   * be written against a compiled-in guess at what the hold was. The watchdog
   * outlives any one generation while the figure travels with the source, so
   * a host that does not re-state it at every attach goes on judging the new
   * node by the old one's number.
   */
  private startWatchdogs(source: PlaybackSource): void {
    this.stallWatchdog.useSourceBudgets(source);
    this.startWatchdog.stop();
    this.startWatchdog = new MediaStartWatchdog(
      this.watchdogEnvironment,
      firstFragmentTimeoutMs(source),
    );

    // What the node said about itself, on the trail. A frozen picture at three
    // metres is unreadable without it: "this node holds a fragment for 6 s and
    // is allowed 19 s to bring a stream up" is the difference between a fault
    // and a node doing what it is entitled to. Absent where the node is too old
    // to say, which is itself worth seeing.
    playbackLog.warn('source-budgets', {
      url: source.url,
      deadlineMs: source.budgets?.deadlineMs,
      segmentHoldMs: source.budgets?.segmentHoldMs,
      startBudgetMs: firstFragmentTimeoutMs(source),
    });

    // A node that accepts the source and then sends nothing is reported as a
    // `stream` failure so the coordinator recovers onto another node. Nothing
    // else would ever notice: no player raises an error for a source it
    // accepted and that then delivered nothing.
    this.startWatchdog.start((visibleMs) => {
      this.reportFailure(
        new PlaybackSourceError(`No media delivered within ${Math.round(visibleMs)}ms`, 'stream'),
      );
    });

    // A stall goes to the degradation channel rather than the failure channel:
    // the buffered source may still play, and core prepares a standby.
    this.stallWatchdog.watch((detail) => {
      playbackLog.warn('stalled', { positionMs: Math.round(detail.positionMs) });
      for (const listener of this.degradationListeners) {
        listener(new Error(`Playback stalled at ${Math.round(detail.positionMs)}ms`));
      }
    });
  }

  pause(): void {
    // Presentation intent, not source teardown: the stall watchdog stands down
    // in `emit()` and core re-arms it on the first report after the resume, so
    // a node that dies mid-pause is still judged the moment anyone waits on it.
    this.wantsPlayback = false;
    this.video.pause();
  }

  resume(): void {
    this.wantsPlayback = true;
    // Before the play request, deliberately: whatever killed this source while
    // nobody was watching is about to be met again, and it should be met while
    // the viewer is waiting — which is the state this adapter knows what to do
    // in. The same ordering as the web client's `restartParkedHlsLoad`.
    this.restartParkedSource();
    this.video.play();
  }

  /**
   * Re-ask the node for a source that died while the viewer was away.
   *
   * The web client restarts hls.js's load and keeps everything the element had
   * buffered. There is no equivalent here — `expo-video` owns its loader and a
   * player in its error state will not resume — so the source is re-attached at
   * the position the viewer left it. **What that costs is the buffer**, which on
   * this path is very likely gone with the generation anyway.
   *
   * The watchdogs are re-armed with it: this is an acquisition like any other,
   * and a node that accepts the source and then sends nothing on the way back
   * must still be judged.
   */
  private restartParkedSource(): void {
    const parked = this.parked;
    if (!parked) return;
    this.parked = undefined;
    playbackLog.warn('parked-source-restarted', {
      url: parked.source.url,
      positionMs: Math.round(parked.positionMs),
      message: parked.message,
    });
    this.startWatchdogs(parked.source);
    this.active.replace(this.videoSourceFor(parked.source));
    if (parked.positionMs > 0) this.active.currentTime = parked.positionMs / 1_000;
  }

  seek(positionMs: number): void {
    this.seeking = true;
    this.video.currentTime = positionMs / 1_000;
  }

  /**
   * Shares one coordinate system with `seek()`; both are
   * source-generation-local.
   *
   * `expo-video` exposes a single `bufferedPosition` rather than the real
   * range set, so this reports the one contiguous range it can prove. That is
   * narrower than the native module's answer, not wrong: core uses it to
   * decide whether a seek needs a new source generation, and understating
   * coverage costs an avoidable generation rather than a broken seek.
   */
  localSeekCoverage(): readonly PlaybackTimeRange[] {
    const endMs = Math.max(0, this.video.bufferedPosition * 1_000);
    return endMs > 0 ? [{ startMs: 0, endMs }] : [];
  }

  setVolume(volume: number): void {
    // Remembered as well as applied: a standby is primed muted so it cannot be
    // heard behind the active source, and has to come up at the real volume
    // when it is promoted.
    this.volume = volume;
    this.active.volume = volume;
  }

  /** Replaces the subtitle resource without touching active A/V playback. */
  setSubtitle(subtitleUrl?: string): void {
    if (!subtitleUrl) {
      this.video.subtitleTrack = null;
      return;
    }
    // expo-video selects from the tracks the manifest already carries; it
    // cannot side-load a URL. Match by URI where the manifest offers it, and
    // otherwise leave selection alone rather than silently clearing it.
    const match = this.video.availableSubtitleTracks.find((track) => track.label === subtitleUrl);
    if (match) this.video.subtitleTrack = match;
  }

  /**
   * Validate a transformed source without replacing the active presentation.
   *
   * Core calls this before it accepts a warm standby, and throws the standby
   * away when it returns `false` (`PlaybackCoordinator.ts:1305`). No decoder is
   * involved — the walk is `fetch` and a range request, so nothing here depends
   * on `expo-video` exposing anything. See `preflight.ts` for why it is a
   * re-implementation of the web client's version rather than a copy of it.
   */
  async preflightSource(source: PlaybackSource): Promise<boolean> {
    const servable = await preflightHlsSource(source, { fetch });
    if (servable) this.primeStandby(source);
    return servable;
  }

  /**
   * Buffer a source on a second player so promotion does not have to.
   *
   * **Tier 2 of seamless failover.** Promotion itself was measured at 3 ms; the
   * visible cost of a failover is the buffering, and this pays it in advance
   * against a node already proven to be serving by the walk above.
   *
   * Muted and never started: the standby must not be heard behind the active
   * source, and `play()` is what would make it compete for audio focus.
   *
   * No surface is bound here, which is the deliberate Tier 2 limit. A player
   * that has never rendered reports `hasSentFirstFrameForCurrentMediaItem` as
   * false, so `VideoView`'s setter closes the shutter over the swap and the
   * viewer sees a brief black frame. Tier 3 removes that by giving the standby
   * an off-screen surface, and is gated on §1.3's decoder-instance limit —
   * whether a second surfaceless player already costs a decoder session on this
   * panel is exactly what that measurement answers.
   */
  private primeStandby(source: PlaybackSource): void {
    if (this.released || this.standby?.url === source.url) return;
    this.discardStandby();
    const player = createVideoPlayer(this.videoSourceFor(source));
    // The standby buffers on the same terms as the active player, which is what
    // makes a promotion worth having — and is the web client's shape. Two
    // players holding a minute each is also the memory question on a 32-bit set,
    // and belongs with §1.3's decoder-instance measurement rather than being
    // guessed at here.
    player.bufferOptions = BUFFER_OPTIONS;
    player.volume = 0;
    player.timeUpdateEventInterval = 0;
    this.standby = { url: source.url, player };
  }

  private discardStandby(): void {
    if (!this.standby) return;
    this.standby.player.release();
    this.standby = undefined;
  }

  /**
   * Hand the surface to the primed player rather than reloading the source.
   *
   * Core signals a promotion by calling `play()` with the source it previously
   * asked us to preflight — there is no separate hook, so the URL is the
   * recognition. Returns false when this is an ordinary play.
   *
   * **A matching URL is not sufficient on its own; `transition` decides.** Core
   * 0.14.0 states whether the viewer asked for this change, and it is the one
   * fact no host can derive: a seek and a recovery both arrive as
   * `play(source, positionMs)` and are byte-identical, measured. `continue`
   * means the viewer did not ask and should not see it — a failover, a reaped
   * session, a quality change — which is exactly what a warm standby is for.
   * `relocate` means they asked to be somewhere else, and the one outcome they
   * did not want is being held where they were while the move is hidden. The
   * web client measured fourteen seconds of that.
   *
   * So a `relocate` takes the ordinary path and the standby is discarded by the
   * caller. Absent is treated as `relocate`, which is core's stated default and
   * the behaviour every player had before seamless replacement existed.
   *
   * Today the cost of getting this wrong is small, because Tier 2 promotion
   * still shows a black frame — but Tier 3 (§2.1) exists precisely to make the
   * swap invisible, and at that point an unasked-for hide becomes a lie about
   * where the viewer is.
   */
  private promoteStandby(
    source: PlaybackSource,
    positionMs: number,
    startPaused: boolean,
    transition?: PlaybackTransition,
  ): boolean {
    const standby = this.standby;
    if (!standby || standby.url !== source.url) return false;
    if (transition !== 'continue') return false;
    this.standby = undefined;

    // A successful promotion is logged at `warn` on purpose, against the
    // usual rule that a warning means something went wrong. It did: a
    // promotion only ever happens because the previous node stopped being
    // usable, and the trail is filtered to warnings and errors. An `info`
    // here would be dropped by the buffer's level and the failover would
    // appear on screen as a gap with no explanation between two failures.
    playbackLog.warn('standby-promoted', { url: source.url });

    const previous = this.active;
    for (const subscription of this.subscriptions) subscription.remove();
    this.active = standby.player;
    this.active.volume = this.volume;
    this.active.bufferOptions = BUFFER_OPTIONS;
    this.active.keepScreenOnWhilePlaying = true;
    this.active.timeUpdateEventInterval = 0.25;
    this.subscriptions = this.bindPlayer(this.active);

    if (positionMs > 0) this.active.currentTime = positionMs / 1_000;
    if (startPaused) this.active.pause();
    else this.active.play();

    // **Retired, not released.** `subscribePlayerChange` drives a React state
    // update, and React commits after the current task — so releasing here
    // would destroy a player the mounted `VideoView` still holds, which is a
    // worse outcome than the shutter this tier already accepts. Presentation
    // calls `releaseRetiredPlayer()` once it has rendered the new instance;
    // `stop()` and `detach()` are the backstop if it never does.
    this.retired = previous;
    for (const listener of this.playerListeners) listener(this.active);
    return true;
  }

  /**
   * Release the player a promotion walked away from.
   *
   * Called by presentation *after* it has rendered the promoted instance, so
   * the old player is no longer attached to a surface by the time it is
   * destroyed. Safe to call at any time, including when nothing is retired.
   */
  releaseRetiredPlayer(): void {
    if (!this.retired) return;
    this.retired.release();
    this.retired = undefined;
  }

  /** Notify presentation that the active player instance has changed. */
  subscribePlayerChange(listener: (player: VideoPlayer) => void): () => void {
    this.playerListeners.add(listener);
    return () => this.playerListeners.delete(listener);
  }

  private videoSourceFor(source: PlaybackSource): VideoSource {
    return {
      uri: source.url,
      // Stated by the source, never sniffed from the extension or the mode —
      // hand a player an `.m3u8` without declaring it and it parses the
      // playlist as a media file and reports a source error.
      contentType: source.isManifest ? 'hls' : 'progressive',
      ...(source.headers ? { headers: { ...source.headers } } : {}),
    };
  }

  stop(): void {
    this.wantsPlayback = false;
    this.activeSource = undefined;
    this.parked = undefined;
    this.active.keepScreenOnWhilePlaying = false;
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    // A standby holds a session on a node, and `max_video_transcodes` is 1 on
    // this cluster: leaving one buffering after playback has been released
    // costs the next viewer a 429.
    this.discardStandby();
    this.releaseRetiredPlayer();
    this.active.pause();
    this.active.replace(null);
  }

  /**
   * Classify a terminal error the player could not classify for itself.
   *
   * **The player's own errors are the one path here with no status.**
   * `expo-video`'s `PlayerError` is `{ message: string }`, and until this
   * existed every one of them was reported as `unknown` — which core treats as
   * possible endpoint evidence. So a session the node reaped while the viewer
   * was paused, the single likeliest failure on a television, charged a failure
   * against the node that had answered honestly and sent the viewer to one that
   * had never held the session. That is the fault core's `not-found` exists to
   * prevent, arriving through the one door this client could not see through.
   *
   * So the node is asked. **The readiness walk, not the session** — the web
   * client's correction, and the reason is measured: a fragment past the end of
   * a live plan and a reaped session both answer `404 not_found`, differing by
   * one word of English in a body no loader surfaces. A session that reports
   * itself alive therefore does not prove the fragment was servable, while the
   * walk asks exactly what the loader asked.
   *
   * **Conservative on everything else.** A walk that answers `ready`,
   * `holding`, `unassessable` or nothing at all leaves the kind `unknown`.
   *
   * *An earlier version of this comment justified that by saying `unknown`
   * costs a spinner while a wrong `stream` costs a healthy node. That is not
   * true and the core session corrected it:*
   * `isEndpointRetryablePlaybackFailure` (`Platform.js:27`) returns true for
   * **both** — an `unknown` prepares a standby on another node and can escalate
   * exactly as a `stream` does. `unknown` is still the right floor for a
   * different reason: it is core's documented answer for a status it has no
   * rule for, and the standby machinery behind it is the recovery that works
   * *without* knowing the cause. The asymmetry that does hold is against
   * `not-found`, which is excluded from that gate — a wrong `not-found` sends
   * core to ask about a session that was never reaped, and a session reported
   * alive stops the recovery dead. **A false `not-found` buys silence; a false
   * `unknown` buys a standby.** That is why the floor is the permissive one.
   *
   * **Bounded against the runway rather than by a fixed deadline**, because
   * lateness spends something. Core defers building a replacement while
   * `runwayMs > leadTimeMs` and builds immediately below it, so every second
   * spent here comes off the cover the deferral was protecting; and
   * `beginMissingSessionRecovery` returns handled if another recovery already
   * owns the source, so a verdict that arrives after one has started is not
   * late but void. Below the lead time a correct kind later is worse than an
   * honest `unknown` now.
   */
  private reportTerminalPlayerFailure(message: string): void {
    const generation = this.sourceGeneration;
    // Stopped now rather than at the report: this source is already terminal,
    // and a watchdog firing during the probe would report it a second time.
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    // The set's own decoder failed: nothing the node could answer would change
    // that, so it is reported as it is rather than probed. See
    // `decoderFailureKind`.
    const decoderKind = decoderFailureKind(message);
    if (decoderKind) {
      this.reportFailure(new PlaybackSourceError(message, decoderKind));
      return;
    }
    void this.kindForTerminalError(this.classificationBudgetMs()).then((kind) => {
      // Core moved on while we asked, so the answer is about a source nobody is
      // watching any more.
      if (this.released || generation !== this.sourceGeneration) return;
      this.reportFailure(new PlaybackSourceError(message, kind));
    });
  }

  /**
   * How long there is to ask, before asking is worse than not knowing.
   *
   * The cover is what the element still holds, and core spends it on the same
   * clock: it defers building a replacement while the runway exceeds the
   * replacement lead time. So the honest budget is what is left over above that
   * lead — computed the way core computes it, from the same exported function,
   * against this node's own attempt budget. `lookAheadMs` is a session fact the
   * adapter is not given, and leaving it out yields the *largest* lead time the
   * function can return, which is the conservative direction here.
   *
   * **The floor is one transport allowance**, and it is what makes this worth
   * doing at all with no cover left. A node that is going to answer answers
   * within a round trip — a `404` is a refusal, not a hold — so the floor costs
   * nothing in the case it exists for and bounds the case where the node has
   * stopped answering at all.
   *
   * *What it is weighed against was wrong here first, and is worth stating
   * correctly.* The comparison is not with a cold start: a terminal `unknown`
   * with no cover is endpoint evidence, so it goes to failover, and negotiating
   * a generation on the new node is bounded by `generationAttemptBudgetMs()` —
   * the node's `startupTimeoutMs`, 15 s by default, plus the transport
   * allowance. **Roughly 19 s on a node holding nothing for this title**,
   * against a `not-found` at zero cover, which regenerates on the node already
   * warm and already configured for the session. Four seconds spent to avoid
   * nineteen. The two figures this first cited — 9 s and 4 s — are both real
   * measurements of other things, which the core session went and read: the 9 s
   * is a join point built past a node's look-ahead frontier, and the 4 s is
   * this very allowance elapsing on a dead node.
   *
   * The runway is the last figure the event stream carried, **less the time
   * since it was carried**: a stale sample describes a buffer that has been
   * draining ever since, and over-reporting it here grants a walk more time
   * than the viewer actually has.
   */
  private classificationBudgetMs(): number {
    const leadMs = replacementLeadTimeMs(
      undefined,
      this.activeSource?.budgets?.deadlineMs ?? generationAttemptBudgetMs(),
    );
    const ageMs = this.lastForwardBufferAt === undefined
      ? Number.POSITIVE_INFINITY
      : Math.max(0, machaHost().now() - this.lastForwardBufferAt);
    const runwayMs = Math.max(0, this.lastForwardBufferMs - ageMs);
    return Math.max(runwayMs - leadMs, ENDPOINT_TRANSPORT_ALLOWANCE_MS);
  }

  private async kindForTerminalError(budgetMs: number): Promise<PlaybackFailureKind> {
    const source = this.activeSource;
    if (!source) return 'unknown';
    // Already asked, for this source. The second terminal error of a generation
    // is not a second question.
    if (this.sourceVerdict?.url === source.url) return this.sourceVerdict.kind;
    // A progressive source has no playlist to walk, and asking would
    // range-request the film. This is the web client's Direct Play case, where
    // the latch is fed by the read-ahead worker; there is no worker here, so
    // the honest answer is that nothing was learned.
    if (!source.isManifest) {
      playbackLog.warn('terminal-failure-unclassified', { state: 'not-a-manifest', url: source.url });
      return 'unknown';
    }
    const controller = new AbortController();
    const expiry = setTimeout(() => controller.abort(), budgetMs);
    try {
      const outcome = await probeHlsReadiness(source, { fetch, signal: controller.signal });
      if (outcome.state !== 'unavailable' || outcome.status === undefined) {
        /*
         * **Measured 2026-09-20: this is the branch a reaped session takes**,
         * and it is why the first failover on hardware classified a `404` as
         * `unknown` with `Response code: 404` sitting in the player's own
         * message.
         *
         * When the session is gone the *master playlist* 404s, and
         * `hlsWalkTargets` answers a non-ok manifest with `[]`
         * (`hlsWalk.ts:436`) rather than with its status — so
         * `probeHlsReadiness` reports `unassessable / empty-manifest`, the
         * status the walk actually saw is dropped, and there is nothing here
         * to map. `playbackFailureKindForStatus(404)` would have said
         * `not-found`, which is the whole contract: ask that node again rather
         * than condemn it.
         *
         * **The distinction belongs in core** — a manifest that answers `404`
         * is exactly as much evidence as a fragment that does, and only the
         * walk ever sees it — and core has the measurement. This line exists
         * so the next run says *which* verdict was returned instead of leaving
         * a silent `unknown` on the trail, and so it keeps saying it if the
         * cause is ever something else.
         */
        playbackLog.warn('terminal-failure-unclassified', {
          state: outcome.state,
          reason: outcome.state === 'unassessable' ? outcome.reason : undefined,
          detail: outcome.state === 'unavailable' ? outcome.detail : undefined,
          url: source.url,
        });
        return 'unknown';
      }
      const kind = playbackFailureKindForStatus(outcome.status);
      playbackLog.warn('terminal-failure-classified', { status: outcome.status, kind });
      this.sourceVerdict = { url: source.url, kind };
      return kind;
    } catch (error) {
      // The walk could not be made at all, which says nothing about the node
      // — but it must not be silent either, because an aborted walk and a
      // walk that answered are the same `unknown` to core and to anyone
      // reading the screen. The budget is named so an abort is recognisable
      // for what it is.
      playbackLog.warn('terminal-failure-unclassified', {
        state: 'probe-failed',
        budgetMs: Math.round(budgetMs),
        detail: error instanceof Error ? error.message : String(error),
      });
      return 'unknown';
    } finally {
      clearTimeout(expiry);
    }
  }

  /** One route for terminal evidence, so a watchdog and the player agree. */
  private reportFailure(error: PlaybackSourceError): void {
    // Logged here rather than at each origin precisely because this is the
    // one route: a failure that reaches core without appearing on the trail
    // would be a failure nobody standing at the television can account for.
    playbackLog.error('failure', { message: error.message, kind: error.kind });
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    for (const listener of this.failureListeners) listener(error);
  }

  subscribe(listener: (event: PlaybackEvent) => void): () => void {
    this.listeners.add(listener);
    // Returning the unsubscribe is required: a player that returns nothing
    // leaks listeners across playback generations.
    return () => this.listeners.delete(listener);
  }

  subscribeFailure(listener: (error: Error) => void): () => void {
    this.failureListeners.add(listener);
    return () => this.failureListeners.delete(listener);
  }

  subscribeDegradation(listener: (error: Error) => void): () => void {
    this.degradationListeners.add(listener);
    return () => this.degradationListeners.delete(listener);
  }
}
