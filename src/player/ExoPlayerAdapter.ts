import {
  MediaStallWatchdog,
  MediaStartWatchdog,
  playbackFailureKindForStatus,
  PlaybackSourceError,
  type PlaybackEvent,
  type PlaybackFailureKind,
  type PlaybackHost,
  type PlaybackSource,
  type PlaybackTimeRange,
  type Player,
} from '@machafoundation/core';
import { MachaPlayer, type NativePlaybackEvent } from '../../modules/macha-player';
import { createWatchdogEnvironment } from './watchdogEnvironment';

/**
 * Core's `Player` over ExoPlayer, for `PlaybackCoordinator`. Contracts not in
 * the type signature are in `macha-ts/docs/writing-a-player.md`.
 */
export class ExoPlayerAdapter implements Player {
  private listeners = new Set<(event: PlaybackEvent) => void>();
  private failureListeners = new Set<(error: Error) => void>();
  private degradationListeners = new Set<(error: Error) => void>();
  private subscriptions: { remove(): void }[] = [];
  private released = false;

  /**
   * Faults ExoPlayer never reports: a source that delivers no bytes, and a
   * frozen picture. Core leaves each host to wire these.
   */
  private readonly startWatchdog: MediaStartWatchdog;
  private readonly stallWatchdog: MediaStallWatchdog;

  constructor() {
    const environment = createWatchdogEnvironment();
    this.startWatchdog = new MediaStartWatchdog(environment);
    this.stallWatchdog = new MediaStallWatchdog(environment);

    this.subscriptions.push(
      MachaPlayer.addListener('onPlaybackEvent', (event) => this.emit(event)),
      MachaPlayer.addListener('onFailure', ({ httpStatus, platformKind, message }) => {
        // The status-to-kind mapping is core's. The decoder's own verdict is
        // used only when there is no status.
        const kind: PlaybackFailureKind =
          typeof httpStatus === 'number'
            ? playbackFailureKindForStatus(httpStatus)
            : ((platformKind as PlaybackFailureKind | null | undefined) ?? 'unknown');
        this.reportFailure(new PlaybackSourceError(message, kind));
      }),
      MachaPlayer.addListener('onDegradation', ({ message }) => {
        for (const listener of this.degradationListeners) listener(new Error(message));
      }),
    );
  }

  private emit(event: NativePlaybackEvent): void {
    // Any byte cancels the start watch: it fires on zero bytes ever, never on slow.
    if (event.forwardBufferMs > 0 || event.positionMs > 0) this.startWatchdog.noteProgress();

    if (event.paused || event.ended) {
      // Paused is not stalled: the viewer stopped it on purpose.
      this.stallWatchdog.suspend();
    } else {
      // Passing the buffer end distinguishes slow from dead: a node below
      // realtime freezes the picture while its buffer still grows.
      this.stallWatchdog.note(event.positionMs, event.bufferedRangesMs[0]?.endMs);
    }

    const snapshot: PlaybackEvent = {
      positionMs: event.positionMs,
      durationMs: event.durationMs,
      paused: event.paused,
      ended: event.ended,
      seeking: event.seeking,
      buffering: event.buffering,
      bufferedRangesMs: event.bufferedRangesMs,
      forwardBufferMs: event.forwardBufferMs,
      ...(event.streamOrigin ? { streamOrigin: event.streamOrigin } : {}),
    };
    for (const listener of this.listeners) listener(snapshot);
  }

  /**
   * Binds presentation only; must not create a playback session. The native
   * view binds itself to the engine on mount.
   */
  attach(_host: PlaybackHost): void {
    MachaPlayer.setKeepScreenOn(true);
  }

  /** Unbind presentation without changing playback or resource ownership. */
  detachHost(): void {
    MachaPlayer.setKeepScreenOn(false);
  }

  /** Final destruction. Resource-destructive, unlike `detachHost`. */
  detach(): void {
    if (this.released) return;
    this.released = true;
    MachaPlayer.setKeepScreenOn(false);
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
    this.listeners.clear();
    this.failureListeners.clear();
    this.degradationListeners.clear();
    MachaPlayer.release();
  }

  /**
   * Resolves once dispatched, not when buffering completes: waiting would
   * stall the coordinator's failover timing.
   *
   * No `transition` parameter: one `ExoPlayer` and no standby, so every
   * replacement is an ordinary attach. A standby would have to honour it
   * here; see `ExpoVideoAdapter.promoteStandby`.
   */
  async play(source: PlaybackSource, positionMs = 0, startPaused = false): Promise<boolean> {
    MachaPlayer.setKeepScreenOn(true);

    // Stall budgets come from the node serving this source, which may state a
    // longer hold than the default.
    this.stallWatchdog.useSourceBudgets(source);

    // A node that accepts the source and sends nothing is a `stream` failure,
    // so the coordinator recovers onto another node.
    this.startWatchdog.start((visibleMs) => {
      this.reportFailure(
        new PlaybackSourceError(`No media delivered within ${Math.round(visibleMs)}ms`, 'stream'),
      );
    });

    // A stall is degradation, not failure: the buffer may still play, and core
    // prepares a standby and promotes it if the stall continues.
    this.stallWatchdog.watch((detail) => {
      for (const listener of this.degradationListeners) {
        listener(new Error(`Playback stalled at ${Math.round(detail.positionMs)}ms`));
      }
    });

    return MachaPlayer.play(
      source.url,
      source.mimeType ?? null,
      // Stated by the source, never sniffed from the extension or the mode.
      source.isManifest,
      positionMs,
      startPaused,
      source.headers ?? null,
      source.subtitleUrl ?? null,
    );
  }

  pause(): void {
    MachaPlayer.pause();
  }

  resume(): void {
    MachaPlayer.resume();
  }

  seek(positionMs: number): void {
    MachaPlayer.seek(positionMs);
  }

  /** Shares one coordinate system with `seek()`; both are source-generation-local. */
  localSeekCoverage(): readonly PlaybackTimeRange[] {
    try {
      return MachaPlayer.localSeekCoverage();
    } catch {
      return [];
    }
  }

  setVolume(volume: number): void {
    MachaPlayer.setVolume(volume);
  }

  stop(): void {
    MachaPlayer.setKeepScreenOn(false);
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    MachaPlayer.stop();
  }

  /** One route for terminal evidence, so a watchdog and the player agree. */
  private reportFailure(error: PlaybackSourceError): void {
    this.startWatchdog.stop();
    this.stallWatchdog.stop();
    for (const listener of this.failureListeners) listener(error);
  }

  subscribe(listener: (event: PlaybackEvent) => void): () => void {
    this.listeners.add(listener);
    // The unsubscribe is required, or listeners leak across playback generations.
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
