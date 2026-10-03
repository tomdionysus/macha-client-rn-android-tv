import type { Episode, MediaSummary } from '@machafoundation/core';
import type { EpisodeNavigation } from './useEpisodeNeighbours';
import { availableToPlay } from '@machafoundation/core';

/**
 * The episode to play when the one playing reaches its end, or undefined.
 *
 * "Next" is core's `episodeNeighbours`, which crosses a season boundary and
 * keeps specials to their own chain, and is the same answer the player's next
 * button uses, so the end of an episode does exactly what pressing next would.
 *
 * `ended` is core's: a source that runs out early is reported as an
 * interruption for recovery, not as an end (`isPrematurePlaybackEnd`), so this
 * never skips an episode the viewer has not finished. Nothing while the
 * neighbour lookup is still pending; the caller asks again when it settles.
 * Nothing either when the next episode is unavailable: playback stops there.
 */
export function episodeToPlayOnEnd(
  media: MediaSummary | undefined,
  ended: boolean,
  neighbours: EpisodeNavigation,
): Episode | undefined {
  if (!ended || media?.kind !== 'episode' || neighbours.loading) return undefined;
  return neighbours.next && availableToPlay(neighbours.next) ? neighbours.next : undefined;
}
