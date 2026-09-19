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
 * Core's `Player`, implemented over ExoPlayer.
 *
 * This is the one interface a host must implement, and handing it to
 * `PlaybackCoordinator` is what buys node failover, stall detection, standby
 * promotion and the segment-container handling for free. Nothing in this file
 * decides *what* to play or *from where* — it only does what it is told and
 * reports what came back.
 *
 * The contracts that are not visible in the type signature are the ones worth
 * checking against `macha-ts/docs/writing-a-player.md`; each is noted where it
 * is honoured below.
 */
export class ExoPlayerAdapter implements Player {
  private listeners = new Set<(event: PlaybackEvent) => void>();
  private failureListeners = new Set<(error: Error) => void>();
  private degradationListeners = new Set<(error: Error) => void>();
  private subscriptions: { remove(): void }[] = [];
  private released = false;

  /**
   * The two faults ExoPlayer will never report as errors.
   *
   * Media3 gives real error callbacks for a broken source, so most failures
   * arrive on the failure channel already. These cover what no player raises:
   * a source that was accepted and then delivered no bytes at all, and a
   * picture frozen with nothing arriving to restart it. Both would otherwise
   * walk straight past the cluster-failover machinery that exists precisely
   * for "this node is not delivering" — the coordinator only ever hears about
   * degradation through `subscribeDegradation`, and without these nothing
   * would ever call it.
   *
   * They are deliberately not inside `PlaybackCoordinator`; core leaves each
   * host to wire its own, and this is that wiring.
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
        // The status-to-kind mapping is core's, not ours: the native side
        // reports the status it saw and this applies the protocol rule. A
        // decoder's own verdict is used only when there was no status, since
        // that is the one thing core cannot know.
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
    // Any byte at all cancels the start watch. It triggers on *zero bytes
    // ever*, never on "slow", so a merely bad link is never judged by it.
    if (event.forwardBufferMs > 0 || event.positionMs > 0) this.startWatchdog.noteProgress();

    if (event.paused || event.ended) {
      // Paused is not stalled: the viewer stopped it on purpose.
      this.stallWatchdog.suspend();
    } else {
      // ExoPlayer's `getBufferedPosition` is trustworthy here, so the buffer
      // figure is passed. That is what keeps "slow" distinguishable from
      // "dead" — a node producing below realtime freezes the picture while its
      // buffer still grows, and judging on position alone would evict exactly
      // the node doing the work.
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
   * Binds presentation only.
   *
   * The native view binds itself to the engine when it mounts, so there is no
   * handle to pass down; core never inspects what it carries here anyway. This
   * must not create a playback session, and it does not.
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
   * Resolves once dispatched, never when buffering completes.
   *
   * Waiting for buffering here would stall the coordinator's failover timing,
   * which is the machinery that moves a viewer off an unhealthy node.
   *
   * **No `transition` parameter, deliberately.** Core 0.14.0 passes one so a
   * host that can replace a source invisibly knows when it may; this engine
   * holds one `ExoPlayer` and has no standby to cut to, so every replacement is
   * an ordinary attach and there is nothing the answer would change. Omitting
   * an optional parameter still satisfies `Player`. When the seamless work in
   * `TODO/ACTIVE.md` §2.1 reaches this engine — where the injectable data
   * source factory makes it cheaper than here — this is where it has to be
   * honoured, and `ExpoVideoAdapter.promoteStandby` is the worked example.
   */
  async play(source: PlaybackSource, positionMs = 0, startPaused = false): Promise<boolean> {
    MachaPlayer.setKeepScreenOn(true);

    // The stall budget belongs to the node serving this source, not to the
    // watchdog, which outlives any one generation. A node stating a longer hold
    // than the compiled-in default is no longer called dead for using it.
    this.stallWatchdog.useSourceBudgets(source);

    // A node that accepts the source and then sends nothing is reported as a
    // `stream` failure, so the coordinator recovers onto another node — that
    // is the whole point of bounding it, since nothing else would ever notice.
    this.startWatchdog.start((visibleMs) => {
      this.reportFailure(
        new PlaybackSourceError(`No media delivered within ${Math.round(visibleMs)}ms`, 'stream'),
      );
    });

    // A stall goes to the degradation channel rather than the failure channel:
    // the buffered source may still play, and core prepares a standby and
    // promotes it if the degradation continues.
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
