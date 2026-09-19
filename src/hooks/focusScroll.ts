/**
 * Where a vertical scroller must move to bring a focused item into view.
 *
 * **This exists because focus and scrolling are separate on this platform and
 * only one of them is ours.** `tvFocus` moves focus by geometry across every
 * registered rectangle, including rectangles that are off screen — which is
 * correct, and is how the web client behaves — so a scroller that does not
 * follow leaves focus somewhere nobody can see. On the Settings screen that
 * shipped a control which could be focused, toggled and never observed: the
 * Diagnostics switch sits below the fold, and Down and centre both appeared
 * dead because their effect was invisible rather than absent.
 *
 * `MediaRow` solves the horizontal case from a stride, because every card is
 * the same width. Nothing vertical can: sections are as tall as their content,
 * so the answer has to come from measurement.
 *
 * Kept as a pure function rather than living inside the component so the rule
 * can be tested without a renderer — this project has no React test
 * environment, and the arithmetic is the part that goes wrong.
 */

export interface ScrollExtent {
  /** Offset of the item within the scrolled content. */
  y: number;
  height: number;
}

/**
 * The offset to scroll to, or `undefined` when the item is already fully
 * visible and scrolling would only move the picture under the viewer.
 *
 * `lead` is breathing room kept above an item scrolled to from below and below
 * one scrolled to from above: an item flush against the edge of a television
 * screen reads as cut off, and at three metres there is no scrollbar to say
 * otherwise.
 */
export function scrollTargetY(
  item: ScrollExtent,
  viewportHeight: number,
  scrollY: number,
  lead = 0,
): number | undefined {
  // Nothing measured yet. Scrolling on a guess would move the page under a
  // viewer who can see perfectly well where they are.
  if (viewportHeight <= 0) return undefined;

  const top = item.y;
  const bottom = item.y + item.height;
  const viewportTop = scrollY;
  const viewportBottom = scrollY + viewportHeight;

  if (top >= viewportTop + lead && bottom <= viewportBottom - lead) return undefined;

  // Taller than the viewport: show its top rather than its bottom, because a
  // section's heading is what says which control the viewer is on.
  if (item.height + lead * 2 >= viewportHeight) return Math.max(0, top - lead);

  if (top < viewportTop + lead) return Math.max(0, top - lead);
  return Math.max(0, bottom - viewportHeight + lead);
}
