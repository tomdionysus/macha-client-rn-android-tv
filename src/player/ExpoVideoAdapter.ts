import { createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import {
  MediaStallWatchdog,
  MediaStartWatchdog,
  PlaybackSourceError,
  playbackFailureKindForStatus,
  preflightHlsSource,
  type PlaybackEvent,
  type PlaybackHost,
  type PlaybackSource,
  type PlaybackTimeRange,
  type PlaybackTransition,
  type Player,
} from '@machafoundation/core';
import { createWatchdogEnvironment } from './watchdogEnvironment';
import { awaitFirstFragment } from './readiness';
import { playbackLog } from '../diagnostics/playbackLog';

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

  private readonly startWatchdog: MediaStartWatchdog;
  private readonly stallWatchdog: MediaStallWatchdog;

  constructor() {
    // Constructed with no source: `attach` binds presentation and must not
    // create a playback session, so the session begins at `play()`.
    this.active = createVideoPlayer(null);
    // Media3 keeps the screen awake itself when told to. The WebView client
    // never had this and dimmed through films; a CPU wake lock is not enough.
    this.active.keepScreenOnWhilePlaying = true;
    // Emitted often enough for the scrubber and the stall watchdog to have
    // something to judge, without flooding the bridge.
    this.active.timeUpdateEventInterval = 0.25;

    const environment = createWatchdogEnvironment();
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
          // Everything expo-video reports here is already terminal. It gives
          // no HTTP status, so `playbackFailureKindForStatus` — which is the
          // protocol rule and belongs to core — cannot be applied, and the
          // honest kind is `unknown` rather than a guess at `stream`. This is
          // strictly less evidence than the native module produced.
          this.reportFailure(new PlaybackSourceError(error?.message ?? 'Playback failed', 'unknown'));
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
      this.startWatchdogs(source);
      return true;
    }

    // Any standby still held is for a source core is no longer asking for.
    this.discardStandby();

    if (source.isManifest && !(await this.nodeWillServe(source, generation))) return false;
    // Core asked for something else while we waited. The newer call owns the
    // player now, and finishing this one would overwrite it.
    if (generation !== this.sourceGeneration) return false;

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
    this.video.pause();
  }

  resume(): void {
    this.video.play();
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
