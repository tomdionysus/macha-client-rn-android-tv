import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@macha/core';
import { MediaCard } from './MediaCard';
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
}: {
  title?: string;
  items: MediaSummary[];
  onSelect: (media: MediaSummary) => void;
  defaultFocusFirst?: boolean;
  progressFor?: (media: MediaSummary) => number | undefined;
}): React.JSX.Element | null {
  const scroller = useRef<ScrollView | null>(null);

  if (items.length === 0) return null;

  const scrollToIndex = (index: number) => {
    const stride = layout.mediaCardWidth + layout.rowGap;
    // Keep one card of lead-in visible so the viewer can see there is more to
    // the left, matching how the web row comes to rest.
    const x = Math.max(0, index * stride - stride);
    scroller.current?.scrollTo({ x, animated: true });
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
      >
        {items.map((media, index) => (
          <MediaCard
            key={media.id}
            media={media}
            onSelect={() => onSelect(media)}
            defaultFocus={defaultFocusFirst && index === 0}
            progress={progressFor?.(media)}
            onFocusChange={(focused) => focused && scrollToIndex(index)}
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
