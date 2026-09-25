import { useMemo } from 'react';
import { playbackVersions, type MediaSummary, type PlaybackVersions } from '@machafoundation/core';
import { deviceQualityCeiling } from '../player/qualityCeiling';
import { qualityPreferenceStore } from '../state/qualityPreference';
import { usePlaybackFacts } from './usePlaybackFacts';

/**
 * The qualities a detail page offers, and what automatic play would take.
 *
 * Core's `playbackVersions` from the same inputs the coordinator starts from —
 * the item's file facts, this set's capabilities, its ceiling and the viewer's
 * offer-everything setting — so the buttons show what pressing them will do.
 * It is pure, and the coordinator runs it again at start; the facts are
 * fetched twice for a play from here, which is one small request against a
 * page that shows the wrong thing if it guesses.
 *
 * Undefined while loading and where the facts do not answer: then there are
 * no buttons, and the generic Play is still there, meaning "decide for me".
 */
export function usePlaybackVersions(media: MediaSummary): PlaybackVersions | undefined {
  const facts = usePlaybackFacts(media.id);
  return useMemo(() => {
    if (!facts) return undefined;
    const ceiling = deviceQualityCeiling();
    return playbackVersions(facts.files, facts.capabilities, {
      mediaIds: media.mediaIds,
      offerAll: qualityPreferenceStore().get().offerAll ?? false,
      ...(ceiling ? { ceiling } : {}),
    });
  }, [facts, media.mediaIds]);
}
