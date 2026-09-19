import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import { scrollTargetY, type ScrollExtent } from './focusScroll';

/**
 * A vertical page scroller that follows focus.
 *
 * **Three screens needed this and none of them had it.** `tvFocus` moves focus
 * by geometry across every registered rectangle, on or off screen — correctly,
 * and identically to the web client — so a page that does not scroll leaves the
 * selector somewhere nobody can see. On the set that showed up as focus
 * "sticking" to a card cut off by the bottom edge, and as a Settings toggle
 * that could be operated but never observed.
 *
 * Every scroller on a television has `scrollEnabled={false}`: there is no touch,
 * so this is the only thing that moves the page.
 *
 * Measured rather than computed. The grid's previous attempt multiplied a row
 * index by a card height derived from the poster ratio, which a wrapping title
 * makes wrong by a line, and the error accumulates down the page.
 */
export function usePageFocusScroll(lead = 0): {
  scroller: React.RefObject<ScrollView | null>;
  viewportHeight: React.RefObject<number>;
  /** `onLayout` for a measured block, keyed. Its `y` must be content-relative. */
  measureRow: (key: string) => (event: LayoutChangeEvent) => void;
  /** Bring a measured block into view, if it is not already. */
  revealRow: (key: string) => void;
} {
  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const extents = useRef(new Map<string, ScrollExtent>());

  const measureRow = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      extents.current.set(key, { y, height });
    },
    [],
  );

  const revealRow = useCallback(
    (key: string) => {
      const extent = extents.current.get(key);
      if (!extent) return;
      const target = scrollTargetY(extent, viewportHeight.current, scrollY.current, lead);
      if (target === undefined) return;
      // Recorded before the scroll rather than waiting to be told: touch is
      // disabled on every scroller here, and a programmatic scroll that reported
      // nothing would leave the next decision judging against an offset of zero,
      // which reads as "already visible" for everything above the fold.
      scrollY.current = target;
      scroller.current?.scrollTo({ y: target, animated: true });
    },
    [lead],
  );

  return { scroller, viewportHeight, measureRow, revealRow };
}
