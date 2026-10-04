import { useCallback, useRef } from 'react';
import type { LayoutChangeEvent, ScrollView } from 'react-native';
import { scrollTarget, type ScrollExtent } from './focusScroll';

/**
 * A vertical page scroller that follows focus. Scrollers here have
 * `scrollEnabled={false}`, so this is the only thing that moves the page.
 * Rows are measured, not computed: a wrapped title changes a row's height.
 */
export function usePageFocusScroll(lead = 0): {
  scroller: React.RefObject<ScrollView | null>;
  /**
   * `onLayout` for a plain `View` wrapping the scroller. The `ScrollView`'s
   * own `onLayout` reports nothing (measured on the TCL set).
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
      // Recorded here, not from a scroll event: a programmatic scroll may report none.
      scrollY.current = target;
      scroller.current?.scrollTo({ y: target, animated: true });
    },
    [lead],
  );

  return { scroller, measureViewport, measureRow, revealRow };
}
