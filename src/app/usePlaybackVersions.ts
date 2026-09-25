import { playbackVersions, type MediaSummary, type PlaybackVersions } from '@machafoundation/core';
import { useAsync } from '../hooks/useAsync';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { deviceQualityCeiling } from '../player/qualityCeiling';
import { useMacha } from './MachaProvider';

/**
 * The qualities a detail page offers, and what automatic play would take.
 *
 * Core's `playbackVersions` from the same three inputs the coordinator starts
 * from — the item's file facts, this set's capabilities and its ceiling — so
 * the buttons show what pressing them will do. It is pure, and the
 * coordinator runs it again at start; the facts are fetched twice for a play
 * from here, which is one small request against a page that shows the wrong
 * thing if it guesses.
 *
 * Undefined while loading and where the facts do not answer: then there are
 * no buttons, and the generic Play is still there, meaning "decide for me".
 */
export function usePlaybackVersions(media: MediaSummary): PlaybackVersions | undefined {
  const { services } = useMacha();
  const { value } = useAsync(async () => {
    const [facts, capabilities] = await Promise.all([
      services.playbackFactsApi.facts({ itemId: media.id }),
      androidTvPlatform.capabilities(),
    ]);
    if (facts.length === 0) return undefined;
    const ceiling = deviceQualityCeiling();
    return playbackVersions(facts, capabilities, { mediaIds: media.mediaIds, ...(ceiling ? { ceiling } : {}) });
  }, [services.playbackFactsApi, media.id]);
  return value;
}
