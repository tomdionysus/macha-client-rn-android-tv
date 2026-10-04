import type { Episode, MediaSummary } from '@machafoundation/core';
import type { EpisodeNavigation } from './useEpisodeNeighbours';
import { availableToPlay } from '@machafoundation/core';

/**
 * The episode to play when the current one ends: core's `episodeNeighbours`,
 * the same answer as the player's next button. `ended` is core's, so a source
 * that runs out early does not count. Undefined while the lookup is pending
 * or when the next episode is unavailable.
 */
export function episodeToPlayOnEnd(
  media: MediaSummary | undefined,
  ended: boolean,
  neighbours: EpisodeNavigation,
): Episode | undefined {
  if (!ended || media?.kind !== 'episode' || neighbours.loading) return undefined;
  return neighbours.next && availableToPlay(neighbours.next) ? neighbours.next : undefined;
}
