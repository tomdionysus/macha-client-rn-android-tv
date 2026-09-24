import type { MediaSummary } from '@machafoundation/core';
import { episodeLabel, trackNumberLabel, trackSearchLine } from '../text/viewerText';

/**
 * The lines under a card's title, in the web client's order (its Search
 * design language, 2026-09-24), composed here from core's data — core writes
 * no viewer text (Tom, 2026-09-24; the words are in `src/text/viewerText.ts`).
 *
 * - an episode: its series, then "Season 3 Episode 2" — not `S03E02`, and the
 *   same in Continue Watching. The web links each line to its page; a
 *   television card is one focus target, so here Back walks there instead.
 * - a season (from search): its series.
 * - an album: its artist, below the album's name (Tom's Music ruling).
 * - a track: "Artist - Album (year)", then its own "Track 9" /
 *   "Disc 2 · Track 3". Tracks are shown as cards only in search here.
 * - an artist: nothing beneath the name.
 * - anything else: its year.
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
