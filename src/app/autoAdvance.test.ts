import { describe, expect, it } from 'vitest';
import type { Episode, MediaSummary } from '@machafoundation/core';
import { episodeToPlayOnEnd } from './autoAdvance';

const episode = { id: 'ep-s1e10', kind: 'episode', title: 'Last of season one', mediaIds: [] } as unknown as MediaSummary;
const film = { id: 'film', kind: 'movie', title: 'A film', mediaIds: [] } as unknown as MediaSummary;
// Core's neighbour across the season boundary: season two's first episode.
const next = { id: 'ep-s2e1', title: 'First of season two' } as unknown as Episode;

describe('the episode played when one ends', () => {
  it("is core's next episode, which crosses into the next season", () => {
    expect(episodeToPlayOnEnd(episode, true, { loading: false, next })).toBe(next);
  });

  it('is nothing before the end', () => {
    expect(episodeToPlayOnEnd(episode, false, { loading: false, next })).toBeUndefined();
  });

  it('is nothing after the last episode of the show', () => {
    expect(episodeToPlayOnEnd(episode, true, { loading: false })).toBeUndefined();
  });

  it('waits for the neighbour lookup rather than deciding there is none', () => {
    expect(episodeToPlayOnEnd(episode, true, { loading: true })).toBeUndefined();
  });

  it('is nothing for anything but an episode', () => {
    expect(episodeToPlayOnEnd(film, true, { loading: false, next })).toBeUndefined();
  });
});
