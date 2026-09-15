import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { sortMediaByIndexedTitle, type MediaApi, type MediaSummary } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaCard } from '../components/MediaCard';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { layout, pageGutter, rem, screenSize } from '../styles/theme';

/**
 * The full catalogue grid, from `.media-grid` in base.css.
 *
 * The web client's `repeat(auto-fill, minmax(145px, 1fr))` becomes a wrapping
 * flex row over a computed column count, because React Native has no grid and
 * `auto-fill` has no flex equivalent. The column count is derived from the same
 * inputs the CSS uses, so the two lay out identically at a given width.
 *
 * Sorting is core's `sortMediaByIndexedTitle`, not a local comparator — it is
 * the one that knows about leading articles and numeric titles.
 */
export function LibraryScreen({
  api,
  kind,
  onOpen,
}: {
  api: MediaApi;
  kind: 'movies' | 'shows';
  onOpen: (media: MediaSummary) => void;
}): React.JSX.Element {
  const result = useRefreshableAsync(
    () => (kind === 'movies' ? api.movies() : api.shows()),
    [api, kind],
  );
  const items = useMemo(() => sortMediaByIndexedTitle(result.value ?? []), [result.value]);
  const scroller = useRef<ScrollView | null>(null);
  // Jumping moves focus to the first title in the bucket; the grid's existing
  // scroll-on-focus below does the revealing. See `useAlphabetIndex` for why
  // scrolling alone is the wrong behaviour on a D-pad.
  const alphabet = useAlphabetIndex(items);

  const title = kind === 'movies' ? 'Movies' : 'TV Shows';
  const columns = Math.max(
    1,
    Math.floor(
      (screenSize.width - pageGutter * 2 - alphabetStripWidth) / (layout.mediaCardWidth + rem(1)),
    ),
  );

  if (!result.value) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <PageTitle>{title}</PageTitle>
        {result.loading ? <Loading /> : result.error ? <ErrorMessage error={result.error} /> : null}
      </ScrollView>
    );
  }

  const scrollToRow = (index: number) => {
    const row = Math.floor(index / columns);
    // Card height is the poster (2:3 of its width) plus the two text lines.
    const rowHeight = layout.mediaCardWidth * 1.5 + rem(3.4);
    scroller.current?.scrollTo({ y: Math.max(0, (row - 1) * rowHeight), animated: true });
  };

  return (
    // The strip is a sibling of the scroller, not a child of it: it is pinned
    // to the screen edge and must not scroll away with the grid.
    <View style={styles.screen}>
      <ScrollView ref={scroller} contentContainerStyle={styles.page} scrollEnabled={false}>
        <PageTitle>{title}</PageTitle>
        {result.error ? <RefreshError error={result.error} /> : null}
        <View style={styles.grid}>
          {items.map((item, index) => (
            <MediaCard
              key={item.id}
              media={item}
              addressable
              onSelect={() => onOpen(item)}
              defaultFocus={index === 0}
              onFocusChange={(focused) => focused && scrollToRow(index)}
            />
          ))}
        </View>
      </ScrollView>
      <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={alphabet.jumpTo} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  // `.media-grid { gap: 1.4rem 1rem }` — row gap then column gap.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: rem(1.4),
    columnGap: rem(1),
    paddingLeft: pageGutter,
    // The alphabet strip is pinned over this edge, so the grid keeps clear of
    // it rather than laying its last column underneath.
    paddingRight: pageGutter + alphabetStripWidth,
  },
});
