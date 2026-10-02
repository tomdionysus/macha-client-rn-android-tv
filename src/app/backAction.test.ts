import { describe, expect, it } from 'vitest';
import { backAction } from './backAction';

describe('what Back does on a screen that is not the player', () => {
  it('goes back a level wherever there is one', () => {
    expect(backAction('detail', 2)).toBe('pop');
    expect(backAction('settings', 2)).toBe('pop');
  });

  it('takes every other screen home, never out of the app', () => {
    for (const route of ['settings', 'movies', 'shows', 'music', 'search', 'status']) {
      expect(backAction(route, 1)).toBe('home');
    }
    // A screen alone on the stack that is not a section has nothing to pop to.
    expect(backAction('detail', 1)).toBe('home');
  });

  it('leaves the app from Home alone', () => {
    expect(backAction('home', 1)).toBe('exit');
  });
});
