import { useMemo } from 'react';
import { playbackVersions, type MediaSummary, type PlaybackVersions, type UnavailableMedia } from '@machafoundation/core';
import { deviceQualityCeiling } from '../player/qualityCeiling';
import { qualityPreferenceStore } from '../state/qualityPreference';
import { usePlaybackFacts } from './usePlaybackFacts';

/**
 * The qualities a detail page offers: core's `playbackVersions` over the same
 * inputs the coordinator starts from, so a button shows what pressing it does.
 * `versions` is undefined while loading or when the facts do not answer.
 */
export function usePlaybackVersions(media: MediaSummary): {
  versions?: PlaybackVersions;
  /** Files no node could read, which `versions` therefore leaves out. */
  unavailable: readonly UnavailableMedia[];
} {
  const facts = usePlaybackFacts(media.id);
  return useMemo(() => {
    if (!facts) return { unavailable: [] };
    if (facts.files.length === 0) return { unavailable: facts.unavailable };
    const ceiling = deviceQualityCeiling();
    const versions = playbackVersions(facts.files, facts.capabilities, {
      mediaIds: media.mediaIds,
      offerAll: qualityPreferenceStore().get().offerAll ?? false,
      ...(ceiling ? { ceiling } : {}),
    });
    return { versions, unavailable: facts.unavailable };
  }, [facts, media.mediaIds]);
}
