import { describe, expect, it } from 'vitest';
import { scrollTargetY } from './focusScroll';

/**
 * The fault these are written against shipped: a control that could be focused,
 * toggled and never seen, because focus moves by geometry and the scroller did
 * not follow. The on-screen failure trail was unreachable for a week behind it.
 */
describe('bringing a focused item into view', () => {
  const viewport = 1000;

  it('does not move when the item is already fully visible', () => {
    // The commonest case by far, and the one where scrolling is actively wrong:
    // a page that jumps whenever focus moves is worse than one that never does.
    expect(scrollTargetY({ y: 200, height: 100 }, viewport, 0)).toBeUndefined();
  });

  it('scrolls down far enough to show an item below the fold', () => {
    // 1,400 to 1,500 against a viewport ending at 1,000.
    expect(scrollTargetY({ y: 1_400, height: 100 }, viewport, 0)).toBe(500);
  });

  it('scrolls up to an item above the current position', () => {
    expect(scrollTargetY({ y: 100, height: 100 }, viewport, 900)).toBe(100);
  });

  it('never scrolls above the top of the content', () => {
    // The clamp matters: a negative offset is accepted by `scrollTo` and leaves
    // the content hanging below an empty strip on Android.
    expect(scrollTargetY({ y: 20, height: 100 }, viewport, 500, 200)).toBe(0);
  });

  it('keeps a lead below an item reached from above', () => {
    // Flush against the bottom edge of a television reads as cut off, and there
    // is no scrollbar at three metres to say otherwise.
    expect(scrollTargetY({ y: 1_400, height: 100 }, viewport, 0, 40)).toBe(540);
  });

  it('counts the lead when deciding whether something is visible at all', () => {
    // Visible but flush: still worth moving, by exactly the lead.
    expect(scrollTargetY({ y: 950, height: 50 }, viewport, 0, 40)).toBe(40);
  });

  it('shows the top of an item taller than the viewport', () => {
    // Its heading is what tells the viewer which control they are on, so the
    // bottom is the wrong end to align.
    expect(scrollTargetY({ y: 300, height: 2_000 }, viewport, 0, 20)).toBe(280);
  });

  it('abstains until something has been measured', () => {
    // A zero viewport is the first render, not a very small screen.
    expect(scrollTargetY({ y: 1_400, height: 100 }, 0, 0)).toBeUndefined();
  });
});
