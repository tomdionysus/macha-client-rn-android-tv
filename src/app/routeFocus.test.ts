import { describe, expect, it } from 'vitest';
import { routeFocus } from './routeFocus';
import { mediaFocusId } from '../hooks/useAlphabetIndex';

describe('where focus goes when the screen changes', () => {
  // Tom, 2026-09-29: "When the 'home', 'movies' 'tv shows' or other page is
  // selected, the focus needs to stay on the nav button selected."
  it('stays on the top-bar button that chose the screen', () => {
    expect(routeFocus({ fromNav: true, remembered: undefined })).toBe('keep');
  });

  it("returns to the card Back came up from, as before", () => {
    expect(routeFocus({ fromNav: false, remembered: mediaFocusId('m1') })).toBe('restore');
  });

  it("lands on the screen's own default otherwise, as before", () => {
    expect(routeFocus({ fromNav: false, remembered: undefined })).toBe('default');
  });
});
