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
 * Buffer ahead as the web client does: 60 s, its hls.js `maxBufferLength`
 * (`macha-client` `WebHlsPolicy.webHlsBufferConfig`); `expo-video` defaults
 * Android to 20. The web client's 128 MB byte ceiling is not copied: `0`
 * leaves it to the platform. Leave `prioritizeTimeOverSizeThreshold` at its
 * default, so the size ceiling beats the 60 s on this 32-bit set: an
 * allocation failure mid-film is worse than a short buffer. The forward
 * buffer reached on a high-bitrate title is unmeasured.
 */
const BUFFER_OPTIONS: BufferOptions = {
  preferredForwardBufferDuration: 60,
  maxBufferBytes: 0,
};

/**
 * Core's `Player` over `expo-video`, the player in use. `ExoPlayerAdapter`
 * stays in the tree, unused, as the alternative.
 *
 * Limits of `expo-video`:
 * - No byte-level source control: it builds its `OkHttpDataSource.Factory`
 *   internally, so there is no per-request control and no HTTP status from
 *   its loader. `addDirectSourceAlternative` is deliberately not implemented.
 *   Seamless failover does not need it: a second `VideoPlayer` is primed and
 *   promoted (`preflightSource`, `promoteStandby`).
 * - Audio focus ducking halves `player.volume` and restores from its own
 *   `userVolume`, rather than using a separate multiplier.
 *
 * Capability detection still comes from `MediaCodecList` through
 * `MachaPlayer.capabilities()`.
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
   * The surface `PlayerScreen` renders. Not stable across a promotion: follow
   * `subscribePlayerChange` rather than capturing it once.
   */
  get video(): VideoPlayer {
    return this.active;
  }

  private active: VideoPlayer;
  private playerListeners = new Set<(player: VideoPlayer) => void>();

  /**
   * A source primed and buffering. Keyed by URL: a promotion arrives as an
   * ordinary `play()` carrying the preflighted source. See `promoteStandby`.
   */
  private standby?: { url: string; player: VideoPlayer };

  /** Last volume core asked for, so a promoted standby comes up at it. */
  private volume = 1;

  /**
   * Forward buffer from the last event, and when it was reported (monotonic).
   * Kept because a failed player may report nothing; aged at use, since a
   * stale sample over-reports cover.
   */
  private lastForwardBufferMs = 0;

  private lastForwardBufferAt?: number;

  /**
   * Whether the viewer wants this playing. Not `!this.video.playing`: between
   * a play request and the element running, the viewer is waiting.
   */
  private wantsPlayback = false;

  /** The source the active player is on, for re-asking a node after a park. */
  private activeSource?: PlaybackSource;

  /**
   * A terminal error raised while paused. Nobody is waiting, so it is held
   * and the source re-asked at `resume()` instead of reported, as the web
   * client parks the load (`macha-client`
   * `WebHlsPolicy.managedHlsErrorAction`, `park-paused`).
   */
  private parked?: { source: PlaybackSource; positionMs: number; message: string };

  /**
   * The failure kind a node's status last gave for a source. `expo-video`
   * errors carry only a message, so a statusless player error is read against
   * what the readiness walk learned. Cleared at every `play()` and keyed by
   * URL, so it never answers for another generation.
   */
  private sourceVerdict?: { url: string; kind: PlaybackFailureKind };

  /** A player a promotion replaced, awaiting presentation letting go of it. */
  private retired?: VideoPlayer;

  /**
   * Which `play()` call is current. `play()` awaits the readiness walk, and
   * core may call it again meanwhile; a superseded call must not attach its
   * stale source.
   */
  private sourceGeneration = 0;

  /**
   * Rebuilt per attach: its budget is a constructor argument and belongs to
   * the node (`firstFragmentTimeoutMs`), not the compiled-in
   * `MEDIA_START_STARVATION_MS`.
   */
  private startWatchdog: MediaStartWatchdog;
  private readonly stallWatchdog: MediaStallWatchdog;
  private readonly watchdogEnvironment: MediaWatchdogEnvironment;

  constructor() {
    // No source: the playback session begins at `play()`, not at `attach`.
    this.active = createVideoPlayer(null);
    this.active.bufferOptions = BUFFER_OPTIONS;
    // Without this the panel dims through films; a CPU wake lock is not enough.
    this.active.keepScreenOnWhilePlaying = true;
    // Seconds: enough for the scrubber and the stall watchdog without
    // flooding the bridge.
    this.active.timeUpdateEventInterval = 0.25;

    const environment = createWatchdogEnvironment();
    this.watchdogEnvironment = environment;
    this.startWatchdog = new MediaStartWatchdog(environment);
    this.stallWatchdog = new MediaStallWatchdog(environment);

    this.subscriptions.push(...this.bindPlayer(this.active));
  }

  /** Wire a player's events to this adapter; a promoted player is re-bound. */
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
          // Nobody is waiting: park and re-ask on resume. See `parked`.
          if (!this.wantsPlayback && this.activeSource) {
            this.parked = {
              source: this.activeSource,
              // Read now: the errored player is about to be replaced.
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
    // `expo-video` ticks position 0 on a player with no source, and core lets
    // a player event overwrite the start position until the session is
    // presented, so an idle tick would start a resumed film at 0:00.
    if (!this.activeSource) return;
    const positionMs = Math.max(0, this.video.currentTime * 1_000);
    const durationMs = Math.max(0, this.video.duration * 1_000);
    const bufferedEndMs = Math.max(0, this.video.bufferedPosition * 1_000);
    const paused = !this.video.playing;

    // Any byte cancels the start watch: it judges zero bytes ever, never "slow".
    if (bufferedEndMs > 0 || positionMs > 0) this.startWatchdog.noteProgress();

    if (paused || this.ended) {
      // Paused is not stalled.
      this.stallWatchdog.suspend();
    } else {
      // The buffer figure separates slow from dead: a node below realtime
      // freezes the picture while its buffer still grows.
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

  /** Binds presentation only; must not create a playback session. */
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
   * Resolves once dispatched, never when buffering completes: waiting would
   * stall the coordinator's failover timing. The one wait allowed is the
   * readiness walk, while the node answers `500 segment_not_ready`
   * (`readiness.ts`). `transition` decides whether the swap may be hidden;
   * see `promoteStandby`.
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
    // Anything parked belonged to the generation being replaced.
    this.wantsPlayback = !startPaused;
    this.parked = undefined;
    this.sourceVerdict = undefined;
    this.lastForwardBufferMs = 0;
    this.lastForwardBufferAt = undefined;
    this.video.keepScreenOnWhilePlaying = true;

    // A promotion arrives as an ordinary `play()`. Checked before the
    // readiness walk: a standby is already preflighted and buffered.
    if (this.promoteStandby(source, positionMs, startPaused, transition)) {
      this.activeSource = source;
      this.startWatchdogs(source);
      return true;
    }

    // Any standby still held is for a source core is no longer asking for.
    this.discardStandby();

    if (source.isManifest && !(await this.nodeWillServe(source, generation))) return false;
    // Superseded while waiting: the newer call owns the player.
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
   * Wait out a node's holds before handing `expo-video` the source. Reports
   * the failure itself and answers `false` when the node will not serve.
   */
  private async nodeWillServe(source: PlaybackSource, generation: number): Promise<boolean> {
    const readiness = await awaitFirstFragment(source, {
      superseded: () => generation !== this.sourceGeneration,
    });
    if (generation !== this.sourceGeneration) return false;

    // A wait is warned so it reaches the failure trail; a first-attempt
    // success stays below the buffer's level.
    if (readiness.attempts > 1) {
      playbackLog.warn('first-fragment-held', { url: source.url, ...readiness });
    } else {
      playbackLog.info('first-fragment', { url: source.url, ...readiness });
    }

    if (readiness.ready) return true;
    if (readiness.status !== undefined) {
      // Only the walk sees a status; a later statusless player error is read
      // against it.
      this.sourceVerdict = { url: source.url, kind: playbackFailureKindForStatus(readiness.status) };
    }
    this.reportFailure(
      new PlaybackSourceError(
        `The node did not serve the first fragment: ${readiness.reason}`,
        // The kind comes from the status through core's rule, never a blanket
        // `stream`: a `404` is one session's existence, not the node's health,
        // and `not-found` has core ask that node again. A `not-found` must not
        // tear the presentation down (`Player.subscribeFailure`); the walk
        // runs before the active player is touched. No status is `stream`.
        readiness.status !== undefined
          ? playbackFailureKindForStatus(readiness.status)
          : 'stream',
      ),
    );
    return false;
  }

  /**
   * Arm both watchdogs. Called only once the player has a source: armed
   * before the readiness walk, the start watchdog could fire mid-walk against
   * a node answering correctly. The stall budget is the node's, so it is
   * re-stated from the source at every attach.
   */
  private startWatchdogs(source: PlaybackSource): void {
    this.stallWatchdog.useSourceBudgets(source);
    this.startWatchdog.stop();
    this.startWatchdog = new MediaStartWatchdog(
      this.watchdogEnvironment,
      firstFragmentTimeoutMs(source),
    );

    // The node's stated budgets, warned so they reach the trail. Absent where
    // the node is too old to state them.
    playbackLog.warn('source-budgets', {
      url: source.url,
      deadlineMs: source.budgets?.deadlineMs,
      segmentHoldMs: source.budgets?.segmentHoldMs,
      startBudgetMs: firstFragmentTimeoutMs(source),
    });

    // No player raises an error for a source it accepted that then delivers
    // nothing, so that is reported here as a `stream` failure.
    this.startWatchdog.start((visibleMs) => {
      this.reportFailure(
        new PlaybackSourceError(`No media delivered within ${Math.round(visibleMs)}ms`, 'stream'),
      );
    });

    // Degradation, not failure: the buffered source may still play, and core
    // prepares a standby.
    this.stallWatchdog.watch((detail) => {
      playbackLog.warn('stalled', { positionMs: Math.round(detail.positionMs) });
      for (const listener of this.degradationListeners) {
        listener(new Error(`Playback stalled at ${Math.round(detail.positionMs)}ms`));
      }
    });
  }

  pause(): void {
    // Presentation intent, not teardown: the stall watchdog stands down in
    // `emit()` and re-arms on the first report after the resume.
    this.wantsPlayback = false;
    this.video.pause();
  }

  resume(): void {
    this.wantsPlayback = true;
    // Before the play request, so a source that died while paused is met with
    // the viewer waiting. Same order as the web client's `restartParkedHlsLoad`.
    this.restartParkedSource();
    this.video.play();
  }

  /**
   * Re-attach a source that died while paused, at the position left. A player
   * in its error state will not resume, so the buffer is lost. The watchdogs
   * are re-armed, as for any acquisition.
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
   * Same coordinates as `seek()`, local to the source generation.
   * `expo-video` exposes one `bufferedPosition`, so this reports a single
   * contiguous range; understating coverage costs core an avoidable
   * generation, not a broken seek.
   */
  localSeekCoverage(): readonly PlaybackTimeRange[] {
    const endMs = Math.max(0, this.video.bufferedPosition * 1_000);
    return endMs > 0 ? [{ startMs: 0, endMs }] : [];
  }

  setVolume(volume: number): void {
    // Remembered: a standby is primed muted and comes up at this on promotion.
    this.volume = volume;
    this.active.volume = volume;
  }

  /** Replaces the subtitle resource without touching active A/V playback. */
  setSubtitle(subtitleUrl?: string): void {
    if (!subtitleUrl) {
      this.video.subtitleTrack = null;
      return;
    }
    // expo-video selects from the manifest's tracks and cannot side-load a
    // URL. With no match, selection is left alone rather than cleared.
    const match = this.video.availableSubtitleTracks.find((track) => track.label === subtitleUrl);
    if (match) this.video.subtitleTrack = match;
  }

  /**
   * Validate a source without replacing the active presentation. Core
   * discards the standby when this returns `false`. No decoder is involved:
   * the walk is `fetch` and a range request.
   */
  async preflightSource(source: PlaybackSource): Promise<boolean> {
    const servable = await preflightHlsSource(source, { fetch });
    if (servable) this.primeStandby(source);
    return servable;
  }

  /**
   * Buffer a source on a second player so promotion does not have to
   * (promotion itself measured at 3 ms). Muted and never started, so it is
   * not heard and does not compete for audio focus. No surface is bound, so
   * `VideoView` closes the shutter over the swap: a brief black frame.
   * Whether a second player costs a decoder session on this panel is
   * unmeasured.
   */
  private primeStandby(source: PlaybackSource): void {
    if (this.released || this.standby?.url === source.url) return;
    this.discardStandby();
    const player = createVideoPlayer(this.videoSourceFor(source));
    // Same buffer as the active player. The memory cost of two on a 32-bit
    // set is unmeasured.
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
   * Hand the surface to the primed player instead of reloading. Returns false
   * for an ordinary play. A matching URL is not enough: only `continue` (the
   * viewer did not ask for the change) may be hidden. `relocate`, and absent,
   * which core defaults to `relocate`, take the ordinary path and the caller
   * discards the standby.
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

    // `warn` on purpose: the trail is filtered to warnings and errors, and a
    // promotion means the previous node stopped being usable.
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

    // Retired, not released: the mounted `VideoView` still holds the old
    // player until React commits. Presentation calls `releaseRetiredPlayer()`
    // after rendering the new one; `stop()` and `detach()` are the backstop.
    this.retired = previous;
    for (const listener of this.playerListeners) listener(this.active);
    return true;
  }

  /**
   * Release the player a promotion replaced. Called by presentation after it
   * has rendered the promoted instance; safe when nothing is retired.
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
      // Stated by the source, never sniffed: an undeclared `.m3u8` is parsed
      // as a media file and fails.
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
    // this cluster: one left buffering costs the next viewer a 429.
    this.discardStandby();
    this.releaseRetiredPlayer();
    this.active.pause();
    this.active.replace(null);
  }

  /**
   * Classify a terminal player error, which carries no status. Reported as
   * `unknown`, a session reaped during a pause would be charged to the node
   * that answered honestly, so the node is asked with the readiness walk. Not
   * the session: a fragment past a live plan and a reaped session both answer
   * `404 not_found` (measured).
   *
   * Anything but a status leaves the kind `unknown`: a false `unknown` costs
   * a standby, while a false `not-found` stops recovery. The walk is bounded
   * by the runway (`classificationBudgetMs`), because a verdict arriving after
   * core has started a recovery is void.
   */
  private reportTerminalPlayerFailure(message: string): void {
    const generation = this.sourceGeneration;
    // Stopped now: a watchdog firing during the probe would report this
    // source twice.
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    // A decoder failure is the set's own; no node answer changes it. See
    // `decoderFailureKind`.
    const decoderKind = decoderFailureKind(message);
    if (decoderKind) {
      this.reportFailure(new PlaybackSourceError(message, decoderKind));
      return;
    }
    void this.kindForTerminalError(this.classificationBudgetMs()).then((kind) => {
      // Core moved on while we asked.
      if (this.released || generation !== this.sourceGeneration) return;
      this.reportFailure(new PlaybackSourceError(message, kind));
    });
  }

  /**
   * How long the classification probe may take. Core defers a replacement
   * while the runway exceeds `replacementLeadTimeMs`, so the budget is the
   * runway above that lead, computed with core's function against this
   * node's attempt budget. `lookAheadMs` is not available here; omitting it
   * gives the largest lead, the conservative direction.
   *
   * Floor: `ENDPOINT_TRANSPORT_ALLOWANCE_MS`, one round trip, in which a node
   * that will answer does. Asserted from core's figures: about 4 s against
   * the roughly 19 s (`generationAttemptBudgetMs()`: `startupTimeoutMs`,
   * 15 s by default, plus the allowance) of a failover to a cold node.
   *
   * The runway is the last reported figure less its age.
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
    // Already asked for this source.
    if (this.sourceVerdict?.url === source.url) return this.sourceVerdict.kind;
    // A progressive source has no playlist to walk, and asking would
    // range-request the film.
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
         * A reaped session lands here (measured): its master playlist 404s,
         * core's `hlsWalkTargets` answers a non-ok manifest with `[]`, and
         * `probeHlsReadiness` reports `unassessable / empty-manifest` with
         * the status dropped. Carrying that status belongs in core; until
         * then this logs which verdict was returned.
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
      // The walk could not be made, which says nothing about the node. Logged
      // with the budget so an abort is recognisable.
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
    // Logged here because this is the one route every failure takes to core.
    playbackLog.error('failure', { message: error.message, kind: error.kind });
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    for (const listener of this.failureListeners) listener(error);
  }

  subscribe(listener: (event: PlaybackEvent) => void): () => void {
    this.listeners.add(listener);
    // The unsubscribe is required, or listeners leak across generations.
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
