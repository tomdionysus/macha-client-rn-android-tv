import { episodeLabel, trackNumberLabel, type MediaSummary } from '@machafoundation/core';

/**
 * The lines under a card's title, in the web client's order (its Search
 * design language, 2026-09-24):
 *
 * - an episode: its series, then "Season 3 Episode 2" — not `S03E02`, and the
 *   same in Continue Watching. The web links each line to its page; a
 *   television card is one focus target, so here Back walks there instead.
 * - a track: the subtitle core gave it, then its own "Track 9" / "Disc 2 ·
 *   Track 3" unless that is already what the subtitle says. Core decides the
 *   first line by context — "Artist - Album (year)" from search, "Track 9" on
 *   an album page where the album is on screen — so this never adds an artist
 *   line core chose to leave out.
 * - anything else: its subtitle, or its year.
 *
 * Every string is core's (`episodeLabel`, `trackNumberLabel`, and the subtitle
 * core set); this only decides which lines a card shows.
 */
export function cardLines(media: MediaSummary): string[] {
  if (media.kind === 'episode' && media.playbackContext) {
    return present([media.playbackContext.series.title, episodeLabel(media) ?? media.subtitle]);
  }
  if (media.kind === 'track') {
    const position = trackNumberLabel(media);
    return present([media.subtitle, position === media.subtitle ? undefined : position]);
  }
  const single = media.subtitle ?? (media.year ? String(media.year) : undefined);
  return present([single]);
}

function present(lines: (string | undefined)[]): string[] {
  return lines.filter((line): line is string => typeof line === 'string' && line.length > 0);
}
