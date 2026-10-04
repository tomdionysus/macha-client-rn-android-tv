import { describe, expect, it } from 'vitest';
import { jumpTarget, scrollTarget } from './focusScroll';

describe('bringing a focused item into view', () => {
  const viewport = 1000;

  it('does not move when the item is already fully visible', () => {
    expect(scrollTarget({ offset: 200, length: 100 }, viewport, 0)).toBeUndefined();
  });

  it('scrolls down far enough to show an item below the fold', () => {
    // 1,400 to 1,500 against a viewport ending at 1,000.
    expect(scrollTarget({ offset: 1_400, length: 100 }, viewport, 0)).toBe(500);
  });

  it('scrolls up to an item above the current position', () => {
    expect(scrollTarget({ offset: 100, length: 100 }, viewport, 900)).toBe(100);
  });

  it('never scrolls above the top of the content', () => {
    // `scrollTo` accepts a negative offset and leaves an empty strip on Android.
    expect(scrollTarget({ offset: 20, length: 100 }, viewport, 500, 200)).toBe(0);
  });

  it('keeps a lead below an item reached from above', () => {
    expect(scrollTarget({ offset: 1_400, length: 100 }, viewport, 0, 40)).toBe(540);
  });

  it('counts the lead when deciding whether something is visible at all', () => {
    // Visible but flush: still worth moving, by exactly the lead.
    expect(scrollTarget({ offset: 950, length: 50 }, viewport, 0, 40)).toBe(40);
  });

  it('shows the top of an item taller than the viewport', () => {
    expect(scrollTarget({ offset: 300, length: 2_000 }, viewport, 0, 20)).toBe(280);
  });

  it('abstains until something has been measured', () => {
    // A zero viewport is the first render, not a very small screen.
    expect(scrollTarget({ offset: 1_400, length: 100 }, 0, 0)).toBeUndefined();
  });
});

describe('jumpTarget', () => {
  it('brings the item to the top, with the lead above it, even when it is already in view', () => {
    expect(jumpTarget({ offset: 1200, length: 300 }, 24)).toBe(1176);
    expect(jumpTarget({ offset: 400, length: 300 }, 24)).toBe(376);
  });

  it('never scrolls above the start of the page', () => {
    expect(jumpTarget({ offset: 10, length: 300 }, 24)).toBe(0);
  });

  // The scroller clamps a target past the end silently, leaving the screens' remembered scroll wrong.
  it('stops at the end of the page, where the last titles cannot come any higher', () => {
    expect(jumpTarget({ offset: 5000, length: 300 }, 24, 4200)).toBe(4200);
    expect(jumpTarget({ offset: 1200, length: 300 }, 24, 4200)).toBe(1176);
  });
});
