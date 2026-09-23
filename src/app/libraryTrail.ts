import type { MediaSummary } from '@machafoundation/core';

/**
 * What sits beneath a TV item, whichever way the viewer reached it.
 *
 * **Tom, 2026-09-23, business P0:** Back from an episode goes to its season,
 * Back from a season goes to its series, and Back from a series goes to TV
 * Shows — always, not only when the viewer happened to walk down that way. An
 * episode resumed from Continue Watching on Home, or a season found by Search,
 * has to land in the same place as one reached through the library.
 *
 * This supersedes, for episodes only, Tom's 2026-09-20 ruling that Back out of
 * a playing item arrives at that item's own detail screen. Films keep it.
 *
 * So the stack is synthesised from what the item says about its ancestry
 * rather than from the path taken. An episode names its series and season in
 * `playbackContext`; a season names its show in `showId` or `parentId`. When
 * an item does not say, there is no trail and the caller keeps the plain
 * stack — a guessed parent is worse than an honest Back to where the viewer
 * came from.
 *
 * `returnTo` is the card each level should hand focus back to, so Back from
 * the player lands on the episode that was playing, not the season's first.
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

/**
 * Only what is on hand without a fetch: the item itself, plus whatever core's
 * `episodeNeighbours` has already resolved for an episode that carried no
 * context. Kept to ids and titles because that is all the screens need to
 * mount — each fetches its own details by id.
 */
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
    // A season found by Search knows its show's id and not its name. The
    // series screen titles itself from its own fetch, so an empty title here
    // is filled in as soon as that lands.
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
