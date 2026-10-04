/**
 * Where a scroller must move to bring a focused item into view, on either
 * axis. `tvFocus` moves focus onto off-screen rectangles, so scrollers must
 * follow. Moves only when the item is not fully in view.
 */

export interface ScrollExtent {
  /** Offset of the item within the scrolled content, along the scrolling axis. */
  offset: number;
  /** The item's length along that axis. */
  length: number;
}

/**
 * The offset to scroll to, or `undefined` when the item is already fully
 * visible. `lead` is the margin kept between the item and the viewport edge.
 */
export function scrollTarget(
  item: ScrollExtent,
  viewportLength: number,
  scrolled: number,
  lead = 0,
): number | undefined {
  // Nothing measured yet.
  if (viewportLength <= 0) return undefined;

  const top = item.offset;
  const bottom = item.offset + item.length;
  const viewportTop = scrolled;
  const viewportBottom = scrolled + viewportLength;

  if (top >= viewportTop + lead && bottom <= viewportBottom - lead) return undefined;

  // Taller than the viewport: show its top, where a section's heading is.
  if (item.length + lead * 2 >= viewportLength) return Math.max(0, top - lead);

  if (top < viewportTop + lead) return Math.max(0, top - lead);
  return Math.max(0, bottom - viewportLength + lead);
}

/**
 * Where a jump scrolls to: the item at the top with `lead` above it, even if
 * already in view. `maxOffset` is the page's last scroll position, so the
 * answer is an offset the scroller actually reaches.
 */
export function jumpTarget(item: ScrollExtent, lead = 0, maxOffset = Number.POSITIVE_INFINITY): number {
  return Math.max(0, Math.min(item.offset - lead, maxOffset));
}
