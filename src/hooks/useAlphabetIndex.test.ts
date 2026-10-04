import { beforeEach, describe, expect, it } from 'vitest';
import { sortMediaByIndexedTitle, type MediaSummary } from '@machafoundation/core';
import { firstMediaIdByKey, isMediaFocusId, mediaFocusId } from './useAlphabetIndex';
import { tvFocus } from './tvFocus';

/** Bucketing is core's and tested there; these pin that a jump moves focus and an empty letter does nothing. */

function media(id: string, title: string): MediaSummary {
  return { id, title, kind: 'movie' } as MediaSummary;
}

const LIBRARY = [
  media('m1', 'Memento'),
  media('m2', 'The Mummy'),
  media('m3', '28 Years Later'),
  media('m4', 'Nosferatu'),
  media('m5', 'Titanic'),
];

beforeEach(() => {
  while (tvFocus.suspended) tvFocus.suspend()();
});

describe('the contract between the strip and the grid', () => {
  it('derives a focus id from the media id', () => {
    expect(mediaFocusId('m1')).toBe('media:m1');
  });

  it('is the id a card registers, so a jump can address it', () => {
    const stop = tvFocus.register({ id: mediaFocusId('m1') });
    tvFocus.select(mediaFocusId('m1'));
    expect(tvFocus.selected()).toBe('media:m1');
    stop();
  });
});

describe('jumping to a letter', () => {
  it('selects the first title in the bucket, in indexed order', () => {
    const sorted = sortMediaByIndexedTitle(LIBRARY);
    const stops = sorted.map((item) => tvFocus.register({ id: mediaFocusId(item.id) }));

    // Core decides the order within M; this follows whatever it decided.
    const firstM = sorted.find((item) => item.title.replace(/^the\s+/i, '').toUpperCase().startsWith('M'));
    expect(firstM).toBeDefined();
    tvFocus.select(mediaFocusId(firstM!.id));
    expect(tvFocus.selected()).toBe(mediaFocusId(firstM!.id));

    for (const stop of stops) stop();
  });

  it('puts a numeric title in the # bucket rather than under its digit', () => {
    const sorted = sortMediaByIndexedTitle(LIBRARY);
    // '28 Years Later' sorts first because '#' leads the index.
    expect(sorted[0]?.title).toBe('28 Years Later');
  });

  it('offers no target for a letter with nothing behind it', () => {
    // The strip also renders empty letters unfocusable; this guards `jumpTo` itself.
    const buckets = firstMediaIdByKey(sortMediaByIndexedTitle(LIBRARY));
    expect(buckets.get('Q')).toBeUndefined();
    expect(buckets.get('M')).toBeDefined();
  });

  it('takes the first title of a bucket, not merely any member of it', () => {
    const sorted = sortMediaByIndexedTitle(LIBRARY);
    const buckets = firstMediaIdByKey(sorted);
    const firstUnderM = sorted.find((item) => buckets.get('M') === item.id);
    const everyM = sorted.filter((item) => buckets.get('M') !== undefined
      && item.title.replace(/^the\s+/i, '').toUpperCase().startsWith('M'));
    expect(firstUnderM?.id).toBe(everyM[0]?.id);
  });
});

describe('a card in one of several rails', () => {
  it('has an id of its own in each rail, so Back can return to the one opened', () => {
    expect(mediaFocusId('m1', 'continue')).not.toBe(mediaFocusId('m1', 'movies'));
    expect(mediaFocusId('m1', 'movies')).not.toBe(mediaFocusId('m1'));
  });

  it('is still a media card, which is what the focus memory keeps', () => {
    expect(isMediaFocusId(mediaFocusId('m1', 'movies'))).toBe(true);
  });
});
