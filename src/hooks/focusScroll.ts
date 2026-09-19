/**
 * Where a scroller must move to bring a focused item into view, on either axis.
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
 * **Both axes, and the horizontal one was wrong in the other direction.**
 * `MediaRow` scrolled from a stride on *every* focus change, so a card already
 * in plain sight still dragged the row under the viewer — the eager half of the
 * same fault, reported off the set alongside the sticky one. Vertical sections
 * cannot use a stride at all, since they are as tall as their content. One rule
 * serves both: move only when the focused thing is not fully in view.
 *
 * Kept as a pure function rather than living inside the component so the rule
 * can be tested without a renderer — this project has no React test
 * environment, and the arithmetic is the part that goes wrong.
 */

export interface ScrollExtent {
  /** Offset of the item within the scrolled content, along the scrolling axis. */
  offset: number;
  /** The item's length along that axis. */
  length: number;
}

/**
 * The offset to scroll to, or `undefined` when the item is already fully
 * visible and scrolling would only move the picture under the viewer.
 *
 * `lead` is breathing room kept beyond an item scrolled to: an item flush
 * against the edge of a television screen reads as cut off, and at three metres
 * there is no scrollbar to say otherwise. On a row it doubles as the web
 * client's lead-in, which shows there is more to one side.
 */
export function scrollTarget(
  item: ScrollExtent,
  viewportLength: number,
  scrolled: number,
  lead = 0,
): number | undefined {
  // Nothing measured yet. Scrolling on a guess would move the page under a
  // viewer who can see perfectly well where they are.
  if (viewportLength <= 0) return undefined;

  const top = item.offset;
  const bottom = item.offset + item.length;
  const viewportTop = scrolled;
  const viewportBottom = scrolled + viewportLength;

  if (top >= viewportTop + lead && bottom <= viewportBottom - lead) return undefined;

  // Taller than the viewport: show its top rather than its bottom, because a
  // section's heading is what says which control the viewer is on.
  if (item.length + lead * 2 >= viewportLength) return Math.max(0, top - lead);

  if (top < viewportTop + lead) return Math.max(0, top - lead);
  return Math.max(0, bottom - viewportLength + lead);
}
