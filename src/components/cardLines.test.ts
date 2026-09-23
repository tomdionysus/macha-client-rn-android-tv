import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { cardLines } from './cardLines';

describe('cardLines', () => {
  it('names an episode by its series, then "Season x Episode y", never SxxEyy', () => {
    const episode: MediaSummary = {
      id: 'e', kind: 'episode', title: 'Our Mrs. Reynolds', mediaIds: [], subtitle: 'S01E03',
      seasonNumber: 1, episodeNumber: 3,
      playbackContext: { series: { id: 's', title: 'Firefly' }, season: { id: 'x', title: 'Season 1', seasonNumber: 1 } },
    };
    expect(cardLines(episode)).toEqual(['Firefly', 'Season 1 Episode 3']);
  });

  it('gives a search track its line, then its own position', () => {
    const track = { id: 't', kind: 'track', title: 'Jóga', mediaIds: [], subtitle: 'Björk - Homogenic (1997)', trackNumber: 3 } as MediaSummary;
    expect(cardLines(track)).toEqual(['Björk - Homogenic (1997)', 'Track 3']);
  });

  it('does not repeat "Track 9" where core already made it the subtitle', () => {
    const track = { id: 't', kind: 'track', title: 'Jóga', mediaIds: [], subtitle: 'Track 9', trackNumber: 9 } as MediaSummary;
    expect(cardLines(track)).toEqual(['Track 9']);
  });

  it('gives a film its year', () => {
    expect(cardLines({ id: 'f', kind: 'movie', title: 'Arrival', mediaIds: [], year: 2016 })).toEqual(['2016']);
  });
});
