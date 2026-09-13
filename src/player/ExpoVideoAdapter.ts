import { createVideoPlayer, type VideoPlayer, type VideoSource } from 'expo-video';
import {
  MediaStallWatchdog,
  MediaStartWatchdog,
  PlaybackSourceError,
  type PlaybackEvent,
  type PlaybackHost,
  type PlaybackSource,
  type PlaybackTimeRange,
  type Player,
} from '@macha/core';
import { createWatchdogEnvironment } from './watchdogEnvironment';
import { preflightHlsSource } from './preflight';

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
 * - **Seamless failover.** `expo-video` builds its `OkHttpDataSource.Factory`
 *   internally (`utils/DataSourceUtils.kt`) with no injection point, so there
 *   is no way to prime a second source or hand a surface over.
 *   `preflightSource` and `addDirectSourceAlternative` are therefore not
 *   implemented here — deliberately, not by oversight. Core degrades to a cold
 *   endpoint walk, which still recovers, just visibly.
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
   * Keyed by URL because that is all core gives us to recognise it: promotion
   * arrives as an ordinary `play()` carrying the source we were asked to
   * preflight, with nothing marking it as a promotion.
   */
  private standby?: { url: string; player: VideoPlayer };

  /** Last volume core asked for, so a promoted standby comes up at it. */
  private volume = 1;

  /** A player a promotion replaced, awaiting presentation letting go of it. */
  private retired?: VideoPlayer;

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
   */
  async play(source: PlaybackSource, positionMs = 0, startPaused = false): Promise<boolean> {
    this.ended = false;
    this.seeking = false;
    this.video.keepScreenOnWhilePlaying = true;

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
      for (const listener of this.degradationListeners) {
        listener(new Error(`Playback stalled at ${Math.round(detail.positionMs)}ms`));
      }
    });

    // A promotion arrives as an ordinary `play()` carrying the source we were
    // asked to preflight, so this is where a warm standby is cashed in. It
    // does everything the cold path below does, against a player that has
    // already buffered.
    if (this.promoteStandby(source, positionMs, startPaused)) return true;

    // Any standby still held is for a source core is no longer asking for.
    this.discardStandby();

    this.active.replace(this.videoSourceFor(source));
    if (positionMs > 0) this.active.currentTime = positionMs / 1_000;
    if (startPaused) this.active.pause();
    else this.active.play();
    return true;
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
    const servable = await preflightHlsSource(source);
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
   */
  private promoteStandby(source: PlaybackSource, positionMs: number, startPaused: boolean): boolean {
    const standby = this.standby;
    if (!standby || standby.url !== source.url) return false;
    this.standby = undefined;

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
