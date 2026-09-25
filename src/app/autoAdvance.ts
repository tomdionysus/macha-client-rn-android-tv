import type { Episode, MediaSummary } from '@machafoundation/core';
import type { EpisodeNavigation } from './useEpisodeNeighbours';

/**
 * The episode to play when the one playing reaches its end, or undefined.
 *
 * Tom, 2026-09-25: when an episode ends, play the next one if there is one,
 * across seasons too. "Next" is core's `episodeNeighbours`, which already
 * crosses a season boundary and keeps specials to their own chain, and the
 * same answer the player's next button uses, so the end of an episode does
 * exactly what pressing next would.
 *
 * `ended` is core's: a source that runs out early is reported as an
 * interruption for recovery, not as an end (`isPrematurePlaybackEnd`), so this
 * never skips an episode the viewer has not finished. Nothing while the
 * neighbour lookup is still pending; the caller asks again when it settles.
 */
export function episodeToPlayOnEnd(
  media: MediaSummary | undefined,
  ended: boolean,
  neighbours: EpisodeNavigation,
): Episode | undefined {
  if (!ended || media?.kind !== 'episode' || neighbours.loading) return undefined;
  return neighbours.next;
}
