import type { PlaybackCapabilities, PlaybackMediaFacts, UnavailableMedia } from '@machafoundation/core';
import { useAsync } from '../hooks/useAsync';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { useMacha } from './MachaProvider';

export interface ItemPlaybackFacts {
  files: readonly PlaybackMediaFacts[];
  capabilities: PlaybackCapabilities;
  /**
   * Files of the item no node could read (core 5a16534's `factsReport`,
   * which asks the other nodes before giving up on one). Non-empty means
   * `files` is partial.
   */
  unavailable: readonly UnavailableMedia[];
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
    const [report, capabilities] = await Promise.all([
      services.playbackFactsApi.factsReport({ itemId }),
      androidTvPlatform.capabilities(),
    ]);
    // `facts` used to be read here, which answered with the files one node
    // read and said nothing of the rest: *The Martian* showed one of its two
    // files on `.133`, 2026-09-27, until a later look.
    return report.files.length > 0 || report.unavailable.length > 0
      ? { files: report.files, capabilities, unavailable: report.unavailable }
      : undefined;
  }, [services.playbackFactsApi, itemId]);
  return value;
}
