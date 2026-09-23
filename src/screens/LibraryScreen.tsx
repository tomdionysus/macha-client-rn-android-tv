import { useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORTS,
  orderMedia,
  type MediaApi,
  type MediaSortKey,
  type MediaSummary,
} from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaCard } from '../components/MediaCard';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { SortControl } from '../components/SortControl';
import { useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { scrollTarget } from '../hooks/focusScroll';
import { CARD_FRAME, layout, pageGutter, rem, screenSize } from '../styles/theme';

/**
 * The full catalogue grid, from `.media-grid` in base.css.
 *
 * The web client's `repeat(auto-fill, minmax(145px, 1fr))` becomes a wrapping
 * flex row over a computed column count, because React Native has no grid and
 * `auto-fill` has no flex equivalent. The column count is derived from the same
 * inputs the CSS uses, so the two lay out identically at a given width.
 *
 * Ordering is core's (`LIBRARY_SORTS`, `orderMedia`), offered as a sort
 * control because Tom ruled every media list has one (2026-09-24). Title, the
 * default, is `sortMediaByIndexedTitle` — the comparator that knows about
 * leading articles and numeric titles — so the default is what this screen
 * always showed.
 *
 * **The alphabet index only in title order.** Under Year or Recently added a
 * letter names no run of the grid, and jumping to it would land somewhere
 * arbitrary.
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
  const indexed = sort === 'title';
  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const cardExtents = useRef(new Map<number, { y: number; height: number }>());
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

  /**
   * Bring the focused card fully into view.
   *
   * **Measured, not computed.** This multiplied a row index by a card height
   * derived from the poster ratio plus two text lines, and then parked that row
   * second from the top. Both halves were wrong on the set: a title that wraps
   * to two lines makes a row taller than the formula says, the error accumulates
   * down the grid, and forcing a scroll on every focus change means the last row
   * can never come further up than the arithmetic allows — so the selector sat
   * on a card cut off by the bottom edge and stayed there. Reported by Tom,
   * 2026-09-19.
   *
   * Cards report their own boxes now, and a card already fully visible does not
   * scroll at all.
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
    // The strip is a sibling of the scroller, not a child of it: it is pinned
    // to the screen edge and must not scroll away with the grid.
    <View
      style={styles.screen}
      onLayout={(event) => {
        // The wrapper, not the scroller: a `ScrollView`'s own `onLayout`
        // reports no height here, which left every decision abstaining.
        viewportHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <ScrollView ref={scroller} contentContainerStyle={styles.page} scrollEnabled={false}>
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
          }}
        >
          {items.map((item, index) => (
            <MediaCard
              key={item.id}
              media={item}
              addressable
              onSelect={() => onOpen(item)}
              defaultFocus={index === 0}
              onExtent={(box) => cardExtents.current.set(index, { y: box.y, height: box.height })}
              onFocusChange={(focused) => focused && revealCard(index)}
            />
          ))}
        </View>
      </ScrollView>
      {indexed ? <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={alphabet.jumpTo} /> : null}
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
  // `.media-grid { gap: 1.4rem 1rem }` — row gap then column gap.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `.media-grid { gap: 1.4rem 1rem }`, less the focus frame each card holds
    // inside its own box. See `layout.rowGap`.
    rowGap: Math.max(rem(0.5), rem(1.4) - CARD_FRAME * 2),
    columnGap: layout.rowGap,
    paddingLeft: pageGutter,
    // The alphabet strip is pinned over this edge, so the grid keeps clear of
    // it rather than laying its last column underneath.
    paddingRight: pageGutter + alphabetStripWidth,
  },
});
