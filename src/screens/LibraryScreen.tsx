import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORTS,
  orderMedia,
  type MediaApi,
  type MediaSortKey,
  type MediaSummary,
  type AlphabetIndexKey,
} from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaCard } from '../components/MediaCard';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { SortControl } from '../components/SortControl';
import { firstAvailableIndex } from '../components/availability';
import { availableToPlay } from '@machafoundation/core';
import { mediaFocusId, useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { jumpTarget, scrollTarget } from '../hooks/focusScroll';
import { tvFocus } from '../hooks/tvFocus';
import { CARD_FRAME, layout, pageGutter, rem } from '../styles/theme';

/**
 * The catalogue grid, from `.media-grid` in base.css: a wrapping flex row over
 * a column count derived from the CSS's own inputs. Ordering is core's
 * (`LIBRARY_SORTS`, `orderMedia`). The alphabet index shows only in title
 * order, where a letter names a run of the grid.
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
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_LIBRARY_SORT);
  const items = useMemo(() => orderMedia(result.value ?? [], sort, LIBRARY_SORTS), [result.value, sort]);
  const firstFocus = firstAvailableIndex(items);
  const indexed = sort === 'title';
  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const contentHeight = useRef(0);
  const cardExtents = useRef(new Map<number, { y: number; height: number }>());
  // A jump moves focus and scroll-on-focus reveals it (see `useAlphabetIndex`).
  // A letter leads only to titles that can take focus.
  const alphabet = useAlphabetIndex(useMemo(() => items.filter(availableToPlay), [items]));

  const title = kind === 'movies' ? 'Movies' : 'TV Shows';
  if (!result.value) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <PageTitle>{title}</PageTitle>
        {result.loading ? <Loading /> : result.error ? <ErrorMessage error={result.error} /> : null}
      </ScrollView>
    );
  }

  /** Focus the letter's first title and put its row at the top (`jumpTarget`). */
  const jumpToKey = (key: AlphabetIndexKey) => {
    const mediaId = alphabet.jumpTo(key);
    const index = mediaId === undefined ? -1 : items.findIndex((entry) => entry.id === mediaId);
    const extent = cardExtents.current.get(index);
    if (!extent || viewportHeight.current <= 0) return;
    const target = jumpTarget(
      { offset: gridY.current + extent.y, length: extent.height },
      rem(1.4),
      Math.max(0, contentHeight.current - viewportHeight.current),
    );
    scrollY.current = target;
    scroller.current?.scrollTo({ y: target, animated: true });
  };

  /**
   * Bring the focused card fully into view, from its measured box: a wrapped
   * title makes its row taller than any formula.
   */
  const revealCard = (index: number) => {
    const extent = cardExtents.current.get(index);
    if (!extent) return;
    const target = scrollTarget(
      { offset: gridY.current + extent.y, length: extent.height },
      viewportHeight.current,
      scrollY.current,
      rem(1.4),
    );
    if (target === undefined) return;
    scrollY.current = target;
    scroller.current?.scrollTo({ y: target, animated: true });
  };

  return (
    // The strip is a sibling of the scroller, so it stays pinned to the screen edge.
    <View
      style={styles.screen}
      onLayout={(event) => {
        // A `ScrollView`'s own `onLayout` reports no height here.
        viewportHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.page}
        scrollEnabled={false}
        onContentSizeChange={(_, height) => {
          contentHeight.current = height;
        }}
      >
        {/* `.media-page-title-row { display: flex; align-items: center; justify-content: space-between }` */}
        <View style={styles.titleRow}>
          <PageTitle>{title}</PageTitle>
          <SortControl sorts={LIBRARY_SORTS} value={sort} onChange={setSort} />
        </View>
        {result.error ? <RefreshError error={result.error} /> : null}
        <View
          style={styles.grid}
          onLayout={(event) => {
            gridY.current = event.nativeEvent.layout.y;
            // The grid can report its place after its cards do.
            const focusedIndex = items.findIndex((entry) => tvFocus.selected() === mediaFocusId(entry.id));
            if (focusedIndex >= 0 && cardExtents.current.has(focusedIndex)) revealCard(focusedIndex);
          }}
        >
          {items.map((item, index) => (
            <MediaCard
              key={item.id}
              media={item}
              addressable
              onSelect={() => onOpen(item)}
              defaultFocus={index === firstFocus}
              onExtent={(box) => {
                cardExtents.current.set(index, { y: box.y, height: box.height });
                // Focus restored by Back lands before layout; reveal once the box is known.
                if (tvFocus.selected() === mediaFocusId(item.id)) revealCard(index);
              }}
              onFocusChange={(focused) => focused && revealCard(index)}
            />
          ))}
        </View>
      </ScrollView>
      {indexed ? <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={jumpToKey} /> : null}
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: rem(1),
    paddingRight: pageGutter + alphabetStripWidth,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `.media-grid { gap: 1.4rem 1rem }`, less each card's focus frame. See `layout.rowGap`.
    rowGap: Math.max(rem(0.5), rem(1.4) - CARD_FRAME * 2),
    columnGap: layout.rowGap,
    paddingLeft: pageGutter,
    // Keeps clear of the alphabet strip pinned over this edge.
    paddingRight: pageGutter + alphabetStripWidth,
  },
});
