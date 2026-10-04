import type { MediaSummary } from '@machafoundation/core';
import { episodeLabel, trackNumberLabel, trackSearchLine } from '../text/viewerText';

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
