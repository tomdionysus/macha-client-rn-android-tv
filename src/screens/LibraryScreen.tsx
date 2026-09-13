import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { sortMediaByIndexedTitle, type MediaApi, type MediaSummary } from '@macha/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaCard } from '../components/MediaCard';
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

  const title = kind === 'movies' ? 'Movies' : 'TV Shows';
  const columns = Math.max(1, Math.floor((screenSize.width - pageGutter * 2) / (layout.mediaCardWidth + rem(1))));

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
    <ScrollView ref={scroller} contentContainerStyle={styles.page} scrollEnabled={false}>
      <PageTitle>{title}</PageTitle>
      {result.error ? <RefreshError error={result.error} /> : null}
      <View style={styles.grid}>
        {items.map((item, index) => (
          <MediaCard
            key={item.id}
            media={item}
            onSelect={() => onOpen(item)}
            defaultFocus={index === 0}
            onFocusChange={(focused) => focused && scrollToRow(index)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
    paddingHorizontal: pageGutter,
  },
});
