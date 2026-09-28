import { describe, expect, it } from 'vitest';
import { backAction } from './backAction';

describe('what Back does on a screen that is not the player', () => {
  it('goes back a level wherever there is one', () => {
    expect(backAction('detail', 2)).toBe('pop');
    expect(backAction('settings', 2)).toBe('pop');
    // A screen that is not top-level pops even alone, as it always has.
    expect(backAction('detail', 1)).toBe('pop');
  });

  // Tom, 2026-09-28: "'Back' on settings should go to Home, not exit the app."
  it('takes Settings home rather than out of the app', () => {
    expect(backAction('settings', 1)).toBe('home');
  });

  it('leaves the app from Home and the other top-level screens, as the platform does', () => {
    expect(backAction('home', 1)).toBe('exit');
    expect(backAction('movies', 1)).toBe('exit');
    expect(backAction('status', 1)).toBe('exit');
  });
});
