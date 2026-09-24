import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { cardLines } from './cardLines';

const music = { album: { id: 'al', title: 'Homogenic', year: 1997 }, artist: { id: 'ar', title: 'Björk' } };

describe('cardLines', () => {
  it('names an episode by its series, then "Season x Episode y", never SxxEyy', () => {
    const episode: MediaSummary = {
      id: 'e', kind: 'episode', title: 'Our Mrs. Reynolds', mediaIds: [], seasonNumber: 1, episodeNumber: 3,
      playbackContext: { series: { id: 's', title: 'Firefly' }, season: { id: 'x', title: 'Season 1', seasonNumber: 1 } },
    };
    expect(cardLines(episode)).toEqual(['Firefly', 'Season 1 Episode 3']);
  });

  it('gives a search track "Artist - Album (year)", then its own position', () => {
    const track = { id: 't', kind: 'track', title: 'Jóga', mediaIds: [], trackNumber: 3, musicContext: music } as MediaSummary;
    expect(cardLines(track)).toEqual(['Björk - Homogenic (1997)', 'Track 3']);
  });

  it("puts an album's artist beneath it", () => {
    const album = { id: 'al', kind: 'album', title: 'Homogenic', mediaIds: [], musicContext: music } as MediaSummary;
    expect(cardLines(album)).toEqual(['Björk']);
  });

  it('gives a film its year', () => {
    expect(cardLines({ id: 'f', kind: 'movie', title: 'Arrival', mediaIds: [], year: 2016 })).toEqual(['2016']);
  });
});
