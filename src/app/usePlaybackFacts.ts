import type { PlaybackCapabilities, PlaybackMediaFacts, UnavailableMedia } from '@machafoundation/core';
import { useAsync } from '../hooks/useAsync';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { useMacha } from './MachaProvider';

export interface ItemPlaybackFacts {
  files: readonly PlaybackMediaFacts[];
  capabilities: PlaybackCapabilities;
  /** Files no node could read (core's `factsReport`). Non-empty means `files` is partial. */
  unavailable: readonly UnavailableMedia[];
}

/**
 * An item's file facts and this set's capabilities, the inputs to core's
 * `playbackVersions` and `offeredModes`. Undefined while loading or when the
 * facts do not answer.
 */
export function usePlaybackFacts(itemId: string): ItemPlaybackFacts | undefined {
  const { services } = useMacha();
  const { value } = useAsync(async () => {
    const [report, capabilities] = await Promise.all([
      services.playbackFactsApi.factsReport({ itemId }),
      androidTvPlatform.capabilities(),
    ]);
    // Not `facts`, which reports only the files one node read.
    return report.files.length > 0 || report.unavailable.length > 0
      ? { files: report.files, capabilities, unavailable: report.unavailable }
      : undefined;
  }, [services.playbackFactsApi, itemId]);
  return value;
}
