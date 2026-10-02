import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import { scrollTarget, type ScrollExtent } from './focusScroll';

/**
 * A vertical page scroller that follows focus.
 *
 * `tvFocus` moves focus by geometry across every registered rectangle, on or
 * off screen — correctly, and identically to the web client — so a page that
 * does not scroll leaves the selector somewhere nobody can see.
 *
 * Every scroller on a television has `scrollEnabled={false}`: there is no touch,
 * so this is the only thing that moves the page.
 *
 * Measured rather than computed: a row height derived from the poster ratio is
 * wrong by a line whenever a title wraps, and the error accumulates down the
 * page.
 */
export function usePageFocusScroll(lead = 0): {
  scroller: React.RefObject<ScrollView | null>;
  /**
   * `onLayout` for a plain `View` wrapping the scroller.
   *
   * **Not the `ScrollView`'s own `onLayout`, which reports nothing here.**
   * Measured on the TCL: it leaves the viewport at `0`, so every decision
   * abstains and no page scrolls. A wrapping `View` does report, and its
   * height is the scroller's because the scroller fills it.
   */
  measureViewport: (event: LayoutChangeEvent) => void;
  /** `onLayout` for a measured block, keyed. Its `y` must be content-relative. */
  measureRow: (key: string) => (event: LayoutChangeEvent) => void;
  /** Bring a measured block into view, if it is not already. */
  revealRow: (key: string) => void;
} {
  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const extents = useRef(new Map<string, ScrollExtent>());

  const measureViewport = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);

  const measureRow = useCallback(
    (key: string) => (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      extents.current.set(key, { offset: y, length: height });
    },
    [],
  );

  const revealRow = useCallback(
    (key: string) => {
      const extent = extents.current.get(key);
      const target = extent
        ? scrollTarget(extent, viewportHeight.current, scrollY.current, lead)
        : undefined;
      if (!extent || target === undefined) return;
      // Recorded before the scroll rather than waiting to be told: touch is
      // disabled on every scroller here, and a programmatic scroll that reported
      // nothing would leave the next decision judging against an offset of zero,
      // which reads as "already visible" for everything above the fold.
      scrollY.current = target;
      scroller.current?.scrollTo({ y: target, animated: true });
    },
    [lead],
  );

  return { scroller, measureViewport, measureRow, revealRow };
}
