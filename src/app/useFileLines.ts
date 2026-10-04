import { fileSummaries, type CatalogueMediaProfile, type MediaSummary } from '@machafoundation/core';
import { useAsync } from '../hooks/useAsync';
import { fileLine } from '../text/viewerText';
import { useMacha } from './MachaProvider';

/**
 * Each of an item's files as one line, identical files combined, as the web
 * client's detail page shows them. The combining is core's (`fileSummaries`).
 * Only `macha:` ids have a profile; an unreadable one is left out. Empty while
 * loading.
 *
 * TODO: report combined files to the server as likely duplicates once it has
 * a route for that.
 */
export function useFileLines(media: MediaSummary): string[] {
  const { services } = useMacha();
  const ids = media.mediaIds.filter((mediaId) => mediaId.startsWith('macha:'));
  const { value } = useAsync(async (signal) => {
    const api = services.mediaApi;
    if (!api.mediaProfile) return [];
    const profiles = await Promise.all(ids.map((mediaId) => api.mediaProfile!(mediaId, signal).catch(() => undefined)));
    const read = profiles.filter((profile): profile is CatalogueMediaProfile => profile !== undefined);
    // Core orders them largest picture first.
    return fileSummaries(read).map(({ summary }) => fileLine(summary));
  }, [services.mediaApi, ids.join(' ')]);
  return value ?? [];
}
