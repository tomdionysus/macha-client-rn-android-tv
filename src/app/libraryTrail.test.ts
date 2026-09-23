import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { libraryTrail } from './libraryTrail';

const episode: MediaSummary = {
  id: 'ep-5',
  kind: 'episode',
  title: 'The Fifth',
  mediaIds: ['m5'],
  seasonNumber: 4,
  episodeNumber: 5,
  playbackContext: {
    series: { id: 'show-1', title: 'The Joy of Cooking' },
    season: { id: 'season-4', title: 'Season 4', seasonNumber: 4 },
  },
};

describe('libraryTrail', () => {
  it('puts TV Shows, the series and the season beneath an episode, however it was reached', () => {
    const trail = libraryTrail(episode);
    expect(trail?.map((level) => level.route.name)).toEqual(['shows', 'series', 'season']);
    const [, series, season] = trail ?? [];
    expect(series?.route).toMatchObject({ name: 'series', media: { id: 'show-1', kind: 'show', title: 'The Joy of Cooking' } });
    expect(season?.route).toMatchObject({ name: 'season', media: { id: 'season-4', kind: 'season', title: 'Season 4' } });
  });

  it('hands focus back down the chain to the episode that was playing', () => {
    expect(libraryTrail(episode)?.map((level) => level.returnTo)).toEqual(['show-1', 'season-4', 'ep-5']);
  });

  it('uses what core resolved when the episode carries no context', () => {
    const bare: MediaSummary = { id: 'ep-5', kind: 'episode', title: 'The Fifth', mediaIds: ['m5'] };
    expect(libraryTrail(bare)).toBeUndefined();
    const trail = libraryTrail(bare, {
      show: { id: 'show-1', title: 'The Joy of Cooking' },
      season: { id: 'season-4', title: 'Season 4' },
    });
    expect(trail?.map((level) => level.route.name)).toEqual(['shows', 'series', 'season']);
  });

  it('puts TV Shows and the series beneath a season, from its show id', () => {
    const season = { id: 'season-4', kind: 'season', title: 'Season 4', mediaIds: [], showId: 'show-1' } as MediaSummary;
    const trail = libraryTrail(season);
    expect(trail?.map((level) => level.route.name)).toEqual(['shows', 'series']);
    expect(trail?.[1]?.route).toMatchObject({ media: { id: 'show-1', kind: 'show' } });
    expect(trail?.map((level) => level.returnTo)).toEqual(['show-1', 'season-4']);
  });

  it('puts TV Shows beneath a series', () => {
    const show: MediaSummary = { id: 'show-1', kind: 'show', title: 'The Joy of Cooking', mediaIds: [] };
    expect(libraryTrail(show)).toEqual([{ route: { name: 'shows' }, returnTo: 'show-1' }]);
  });

  it('leaves a film, and anything else that is not TV, alone', () => {
    const film: MediaSummary = { id: 'f', kind: 'movie', title: 'Film', mediaIds: ['m'] };
    expect(libraryTrail(film)).toBeUndefined();
  });
});
