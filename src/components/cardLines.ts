import type { MediaSummary } from '@machafoundation/core';
import { episodeLabel, seasonLabel, trackNumberLabel, trackSearchLine } from '../text/viewerText';

/**
 * The lines under a card's title, in the web client's order. The words are
 * composed in `src/text/viewerText.ts`; core writes no viewer text.
 */
export function cardLines(media: MediaSummary): string[] {
  switch (media.kind) {
    case 'episode':
      return present([media.playbackContext?.series.title, episodeLabel(media)]);
    case 'season':
      return present([media.playbackContext?.series.title]);
    case 'album':
      return present([media.musicContext?.artist?.title]);
    case 'track':
      return present([media.musicContext ? trackSearchLine(media.musicContext) : undefined, trackNumberLabel(media)]);
    case 'artist':
      return [];
    default:
      return present([media.year ? String(media.year) : undefined]);
  }
}

function present(lines: (string | undefined)[]): string[] {
  return lines.filter((line): line is string => typeof line === 'string' && line.length > 0);
}

/** A link on a card to a place in the library. */
export interface CardLink {
  label: string;
  target: MediaSummary;
}

/**
 * An episode's parents as links, as the web client's `contextLines`: its
 * series, then its season, labelled by the episode mark. A track's artist and
 * album have no screen here, so a track has none.
 */
export function contextLinks(media: MediaSummary): CardLink[] | undefined {
  if (media.kind !== 'episode' || !media.playbackContext) return undefined;
  const { series, season } = media.playbackContext;
  return [
    { label: series.title, target: { id: series.id, kind: 'show', title: series.title, mediaIds: [] } },
    {
      label: episodeLabel(media) ?? (season.title || seasonLabel(season.seasonNumber) || series.title),
      // `parentId` puts the season on its show's trail when opened.
      target: { id: season.id, kind: 'season', title: season.title, mediaIds: [], parentId: series.id },
    },
  ];
}

/**
 * Where Up or Down goes among a card and its links, which sit inside the
 * card where the scorer cannot reach them: Down walks from the card through
 * each link, Up walks back to the card. Undefined leaves the move to the
 * scorer: sideways, Up from the card, Down from the last link.
 */
export function linkStep(from: 'card' | number, direction: string, count: number): 'card' | number | undefined {
  if (direction === 'down') {
    const next = from === 'card' ? 0 : from + 1;
    return next < count ? next : undefined;
  }
  if (direction === 'up' && from !== 'card') return from === 0 ? 'card' : from - 1;
  return undefined;
}
