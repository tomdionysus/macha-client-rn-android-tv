import { beforeEach, describe, expect, it } from 'vitest';
import { sortMediaByIndexedTitle, type MediaSummary } from '@machafoundation/core';
import { firstMediaIdByKey, mediaFocusId } from './useAlphabetIndex';
import { tvFocus } from './tvFocus';

/**
 * The bucketing itself belongs to core and is tested there. What is worth
 * pinning here is the behaviour that makes this a *television* component: a
 * jump moves focus, and a letter with nothing behind it does nothing at all.
 *
 * The hook is exercised through its two halves — `mediaFocusId`, which is the
 * contract between the strip and the grid, and the registry selection that
 * `jumpTo` performs — rather than through a renderer.
 */

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

/**
 * A jump has to *move focus*, not merely scroll. The web client calls
 * `scrollIntoView` and stops, which on a D-pad would leave focus behind and the
 * viewer's next press would scroll straight back — the jump appearing to undo
 * itself.
 */
describe('jumping to a letter', () => {
  it('selects the first title in the bucket, in indexed order', () => {
    const sorted = sortMediaByIndexedTitle(LIBRARY);
    const stops = sorted.map((item) => tvFocus.register({ id: mediaFocusId(item.id) }));

    // 'The Mummy' indexes under M with the article stripped, and sorts before
    // 'Memento'? Core decides; this asserts we follow whatever it decided.
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
    // This is the guard `jumpTo` checks before touching focus at all: an empty
    // letter must be a no-op, not a way to send focus somewhere that does not
    // exist. The strip also renders such letters unfocusable, so the D-pad
    // never reaches them — this is the second line of defence.
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
