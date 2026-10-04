import type { PlaybackCoordinatorSnapshot } from '@machafoundation/core';
import { REBUFFER_SPINNER_DELAY_MS, START_WAIT_NOTICE_MS } from '../../player/timingBudgets';
import { startWaitText } from '../../text/viewerText';

/**
 * The rules behind the player's spinner, as the web client's `PlayerScreen.tsx`
 * (`showBuffering`, `startWaitNotice`). Streaming and seeking only; a recovery
 * has its own indicator.
 */

/** Never over a failure. */
export function showsBuffering(playback: PlaybackCoordinatorSnapshot | undefined): boolean {
  if (!playback || playback.fatalError) return false;
  return playback.starting || Boolean(playback.event.buffering);
}

/** At once for a start, where nothing is on screen; delayed for a rebuffer. */
export function bufferingDelayMs(starting: boolean): number {
  return starting ? 0 : REBUFFER_SPINNER_DELAY_MS;
}

/**
 * What to tell a viewer whose title is slow to start. `stage` is what a node
 * that reports progress says it is doing.
 */
export function startWaitNotice(starting: boolean, elapsedMs: number, stage?: string): string | undefined {
  if (!starting || elapsedMs < START_WAIT_NOTICE_MS) return undefined;
  return startWaitText(elapsedMs, stage);
}
