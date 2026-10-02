import { fileSummaries, type CatalogueMediaProfile, type MediaSummary } from '@machafoundation/core';
import { useAsync } from '../hooks/useAsync';
import { fileLine } from '../text/viewerText';
import { useMacha } from './MachaProvider';

/**
 * Each of an item's files as one line, identical files combined, matching the
 * web client's detail page. The facts and the combining are core's
 * (`fileSummaries`); the line is laid out here.
 *
 * TODO: files core combines are very likely one media stored twice (each
 * summary carries its `mediaIds`). Report them to the server as likely
 * duplicates once it has a route for that, rather than only hiding the repeat.
 *
 * From each file's catalogue profile, as the web reads them: only the
 * immutable `macha:` ids have one, and a file whose profile cannot be read is
 * left out rather than failing the others. Empty while loading.
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
