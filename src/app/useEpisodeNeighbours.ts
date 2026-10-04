import { useEffect, useState } from 'react';
import {
  episodeNeighbours,
  type EpisodeNeighbours,
  type MediaApi,
  type MediaSummary,
} from '@machafoundation/core';

export interface EpisodeNavigation extends EpisodeNeighbours {
  /** True until the lookup for the current episode has settled either way. */
  loading: boolean;
}

/**
 * The episodes either side of the one playing. The rule is core's
 * (`episodeNeighbours`); this owns the lifecycle: one lookup per episode,
 * abandoned when the episode changes. Settles to empty rather than failing.
 */
export function useEpisodeNeighbours(api: MediaApi, media: MediaSummary | undefined): EpisodeNavigation {
  const episodeId = media?.kind === 'episode' ? media.id : undefined;
  const [state, setState] = useState<{ id?: string; value: EpisodeNeighbours }>({ value: {} });

  useEffect(() => {
    if (!episodeId || !media) return undefined;
    const controller = new AbortController();
    episodeNeighbours(api, media, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) setState({ id: episodeId, value });
      },
      () => {
        // Only our own abort rejects; settle so the buttons stop reading as pending.
        if (!controller.signal.aborted) setState({ id: episodeId, value: {} });
      },
    );
    return () => controller.abort();
    // Keyed on the episode id: the same episode must not start a second lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, episodeId]);

  if (!episodeId) return { loading: false };
  // An answer for a previous episode is not an answer for this one.
  if (state.id !== episodeId) return { loading: true };
  return { ...state.value, loading: false };
}
