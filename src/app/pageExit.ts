import type { PlaybackRuntime, PlaybackRuntimeRequest, PlaybackRuntimeSnapshot } from '@machafoundation/core';

/**
 * The playback a `background` closed, for the return to `active` to offer
 * back. The set's standby sends the app to the background with the player
 * still open; the session is closed so the node's transcode slot is freed,
 * and the viewer comes back to the same title, paused.
 */
export class PageExit {
  private closed: PlaybackRuntimeRequest | undefined;

  /** What this `background` closes, if anything is worth offering back. */
  background(runtime: PlaybackRuntimeSnapshot): PlaybackRuntimeRequest | undefined {
    // A second `background` sees the first close still stopping, and keeps it.
    if (this.closed) return undefined;
    // A failure stays on screen as it was; there is nothing to resume.
    if (runtime.phase === 'idle' || runtime.phase === 'failed' || runtime.phase === 'stopping') return undefined;
    this.closed = runtime.request;
    return this.closed;
  }

  /** The playback to offer back, once. */
  active(): PlaybackRuntimeRequest | undefined {
    const closed = this.closed;
    this.closed = undefined;
    return closed;
  }
}

/**
 * Start the generation `play` has just begun paused. Called after `play`,
 * whose first act withdraws the previous snapshot. Core's `play` takes no
 * paused start, so the pause is set on the first snapshot the new
 * coordinator publishes, which precedes its first load; the load reads the
 * intent and attaches paused.
 * A local stand-in until core's `PlaybackRuntimeRequest` carries a paused
 * start; replace it with that.
 */
export function pauseOnFirstSnapshot(runtime: Pick<PlaybackRuntime, 'subscribePlayback' | 'setPaused'>): void {
  let done = false;
  let unsubscribe: (() => void) | undefined;
  unsubscribe = runtime.subscribePlayback((snapshot) => {
    if (done || !snapshot) return;
    done = true;
    runtime.setPaused(true);
    unsubscribe?.();
  });
  if (done) unsubscribe();
}
