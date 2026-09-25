import type { PlaybackCapabilities, PlaybackMediaFacts } from '@machafoundation/core';
import { useAsync } from '../hooks/useAsync';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { useMacha } from './MachaProvider';

export interface ItemPlaybackFacts {
  files: readonly PlaybackMediaFacts[];
  capabilities: PlaybackCapabilities;
}

/**
 * An item's file facts and this set's capabilities: what core's pure
 * choosers (`playbackVersions`, `offeredModes`) need to say what a screen
 * may offer. The same inputs the coordinator starts from, fetched here
 * because it keeps them to itself.
 *
 * Undefined while loading and where the facts do not answer; a screen then
 * offers what it did before facts existed.
 */
export function usePlaybackFacts(itemId: string): ItemPlaybackFacts | undefined {
  const { services } = useMacha();
  const { value } = useAsync(async () => {
    const [files, capabilities] = await Promise.all([
      services.playbackFactsApi.facts({ itemId }),
      androidTvPlatform.capabilities(),
    ]);
    return files.length > 0 ? { files, capabilities } : undefined;
  }, [services.playbackFactsApi, itemId]);
  return value;
}
