import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@machafoundation/core';
import { MediaCard } from './MediaCard';
import { scrollTarget } from '../hooks/focusScroll';
import { colour, font, layout, pageGutter, rem, type } from '../styles/theme';

/**
 * A titled horizontal rail, from `.media-section` / `h2` / `.media-row`.
 *
 * The web client relies on `scrollIntoView` after each focus move; here the row
 * scrolls itself when one of its cards takes focus. The card's index is enough
 * — a card has a fixed width and a fixed gap, so its offset is arithmetic
 * rather than a measurement, which avoids a measure round-trip on every D-pad
 * press.
 */
export function MediaRow({
  title,
  items,
  onSelect,
  defaultFocusFirst,
  progressFor,
  onRowFocus,
  addressable,
  onRemove,
}: {
  title?: string;
  items: MediaSummary[];
  onSelect: (media: MediaSummary) => void;
  defaultFocusFirst?: boolean;
  progressFor?: (media: MediaSummary) => number | undefined;
  /** Any card in this row taking focus. For a page scroller following focus. */
  onRowFocus?: () => void;
  /**
   * Give each card its media focus id, so a Back to this screen can return
   * focus to the card that was opened. **Opt-in because ids must be unique on
   * screen**, and Home can show one title in two rails.
   */
  addressable?: boolean;
  /** Each card gets a remove button calling this: Continue Watching's. */
  onRemove?: (media: MediaSummary) => void;
}): React.JSX.Element | null {
  const scroller = useRef<ScrollView | null>(null);
  const viewportWidth = useRef(0);
  const scrollX = useRef(0);
  const cards = useRef(new Map<number, { offset: number; length: number }>());

  if (items.length === 0) return null;

  /**
   * Move the row only when the focused card is not already in view.
   *
   * **It used to scroll on every focus change**, from a stride: a card in plain
   * sight still dragged the row under the viewer, and the first card of a row
   * could never sit at the left edge because the arithmetic always subtracted
   * one stride. Reported off the set as the eager half of the scrolling fault.
   * The stride was also a guess — correct only while every card is exactly the
   * same width, which is true today and is not a thing to depend on.
   *
   * The lead keeps a sliver of the neighbouring card visible, which is the same
   * signal the web row gives that there is more to one side.
   */
  const revealCard = (index: number) => {
    const card = cards.current.get(index);
    if (!card) return;
    const target = scrollTarget(card, viewportWidth.current, scrollX.current, layout.rowGap);
    if (target === undefined) return;
    scrollX.current = target;
    scroller.current?.scrollTo({ x: target, animated: true });
  };

  return (
    <View style={styles.section}>
      {title ? <Text style={styles.heading}>{title}</Text> : null}
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        // A television has no touch; the D-pad drives this entirely.
        scrollEnabled={false}
        // Measured from a wrapping `View` for the vertical scrollers because a
        // `ScrollView` reports nothing here; horizontally it does report, and
        // this is the frame rather than the content.
        onLayout={(event) => {
          viewportWidth.current = event.nativeEvent.layout.width;
        }}
      >
        {items.map((media, index) => (
          <MediaCard
            key={media.id}
            media={media}
            onSelect={() => onSelect(media)}
            defaultFocus={defaultFocusFirst && index === 0}
            addressable={addressable}
            progress={progressFor?.(media)}
            {...(onRemove ? { onRemove: () => onRemove(media) } : {})}
            onExtent={(box) => cards.current.set(index, { offset: box.x, length: box.width })}
            onFocusChange={(focused) => {
              if (!focused) return;
              revealCard(index);
              // The row moves horizontally; the page has to move vertically to
              // it, or focus lands on a row below the fold and the selector sits
              // on a card cut off by the bottom edge.
              onRowFocus?.();
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // `.media-section { margin-bottom: 2.2rem }`
  section: {
    marginBottom: rem(2.2),
  },
  // `h2 { font-size: clamp(1.2rem,2vw,1.75rem); margin: 1.1rem 0 .75rem; color: #d7d7db }`
  heading: {
    fontSize: type.h2,
    letterSpacing: -type.h2 * 0.01,
    marginTop: rem(1.1),
    marginBottom: rem(0.75),
    marginLeft: pageGutter,
    color: colour.headingDim,
    fontWeight: font.weightMedium,
  },
  // `.media-row { gap: 1rem; padding: .4rem .2rem 1.2rem }`
  row: {
    gap: layout.rowGap,
    paddingTop: rem(0.4),
    paddingBottom: rem(1.2),
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
});
