import type { MediaSummary } from '@machafoundation/core';

/**
 * What sits beneath a TV item, however the viewer reached it: episode ->
 * season -> series -> TV Shows. Built from the item's stated ancestry
 * (`playbackContext`, `showId`, `parentId`); with none stated there is no
 * trail and the caller keeps the plain stack.
 */
export type TrailRoute =
  | { name: 'shows' }
  | { name: 'series'; media: MediaSummary }
  | { name: 'season'; media: MediaSummary };

export interface TrailLevel {
  route: TrailRoute;
  /** The media id whose card this level should give focus to on the way back. */
  returnTo: string;
}

/** Ancestry on hand without a fetch, e.g. from core's `episodeNeighbours`. */
export interface KnownAncestry {
  show?: { id: string; title: string };
  season?: { id: string; title: string };
}

export function libraryTrail(media: MediaSummary, known: KnownAncestry = {}): TrailLevel[] | undefined {
  if (media.kind === 'episode') {
    const series = media.playbackContext?.series ?? known.show;
    const season = media.playbackContext?.season ?? known.season;
    if (!series || !season) return undefined;
    return [
      { route: { name: 'shows' }, returnTo: series.id },
      { route: { name: 'series', media: summary(series, 'show') }, returnTo: season.id },
      { route: { name: 'season', media: summary(season, 'season') }, returnTo: media.id },
    ];
  }
  if (media.kind === 'season') {
    const showId = ('showId' in media && typeof media.showId === 'string' ? media.showId : undefined)
      ?? media.parentId
      ?? known.show?.id;
    if (!showId) return undefined;
    // The show's title may be unknown here; the series screen fetches its own.
    const title = known.show?.id === showId ? known.show.title : '';
    return [
      { route: { name: 'shows' }, returnTo: showId },
      { route: { name: 'series', media: summary({ id: showId, title }, 'show') }, returnTo: media.id },
    ];
  }
  if (media.kind === 'show') {
    return [{ route: { name: 'shows' }, returnTo: media.id }];
  }
  return undefined;
}

function summary(item: { id: string; title: string }, kind: 'show' | 'season'): MediaSummary {
  return { id: item.id, kind, title: item.title, mediaIds: [] };
}
