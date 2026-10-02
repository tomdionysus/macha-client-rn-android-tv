import type { PlaybackCoordinatorSnapshot } from '@machafoundation/core';
import { REBUFFER_SPINNER_DELAY_MS, START_WAIT_NOTICE_MS } from '../../player/timingBudgets';
import { startWaitText } from '../../text/viewerText';

/**
 * The rules behind the player's spinner, the web client's
 * (`PlayerScreen.tsx`, `showBuffering` and `startWaitNotice`) unchanged.
 *
 * The spinner is only a streaming and seeking indicator: the stream is
 * catching up. A recovery is shown by its own indicator, not this.
 */

/** A start, or the player reporting it is buffering; never over a failure. */
export function showsBuffering(playback: PlaybackCoordinatorSnapshot | undefined): boolean {
  if (!playback || playback.fatalError) return false;
  return playback.starting || Boolean(playback.event.buffering);
}

/** At once for a start, where nothing is on screen; after a pause for a rebuffer. */
export function bufferingDelayMs(starting: boolean): number {
  return starting ? 0 : REBUFFER_SPINNER_DELAY_MS;
}

/**
 * What to tell a viewer whose title has not started yet, once it is taking a
 * while. Only a start: a rebuffer has the picture behind it. `stage` is what
 * a node that reports progress says it is doing; the delay is unchanged, since
 * a quick start is no more worth announcing for being measured.
 */
export function startWaitNotice(starting: boolean, elapsedMs: number, stage?: string): string | undefined {
  if (!starting || elapsedMs < START_WAIT_NOTICE_MS) return undefined;
  return startWaitText(elapsedMs, stage);
}
