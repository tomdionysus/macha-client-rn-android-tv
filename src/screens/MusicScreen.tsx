import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { sortMediaByIndexedTitle, type MediaApi, type MediaSummary } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { firstAvailableIndex } from '../components/availability';
import { MediaCard } from '../components/MediaCard';
import { scrollTarget } from '../hooks/focusScroll';
import { CARD_FRAME, layout, pageGutter, rem } from '../styles/theme';

/**
 * Music — albums, and only albums for now.
 *
 * **This is one of the web client's seven music routes, not a port of them.**
 * That client has artists, albums, tracks, playlists and a page for each, all
 * hanging off an `OverflowMenu` this client does not have yet, and a queue that
 * outlives the screen.
 *
 * Albums stand alone: a grid of things a viewer recognises, opening the same
 * detail screen everything else opens, so the nav entry goes somewhere real.
 *
 * **What a viewer cannot do here yet**, so it is not mistaken for a bug: play a
 * whole album in order, queue anything, or reach an artist. All three need the
 * queue and the menu.
 */
export function MusicScreen({
  api,
  onOpen,
}: {
  api: MediaApi;
  onOpen: (media: MediaSummary) => void;
}): React.JSX.Element {
  const result = useRefreshableAsync(() => api.albums(), [api]);
  const items = useMemo(() => sortMediaByIndexedTitle(result.value ?? []), [result.value]);
  const firstFocus = firstAvailableIndex(items);

  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const cards = useRef(new Map<number, { y: number; height: number }>());

  const revealCard = (index: number) => {
    const card = cards.current.get(index);
    if (!card) return;
    const target = scrollTarget(
      { offset: gridY.current + card.y, length: card.height },
      viewportHeight.current,
      scrollY.current,
      rem(1.4),
    );
    if (target === undefined) return;
    scrollY.current = target;
    scroller.current?.scrollTo({ y: target, animated: true });
  };

  if (!result.value) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <PageTitle>Music</PageTitle>
        {result.loading ? <Loading /> : result.error ? <ErrorMessage error={result.error} /> : null}
      </ScrollView>
    );
  }

  return (
    <View
      style={styles.screen}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <ScrollView ref={scroller} contentContainerStyle={styles.page} scrollEnabled={false}>
        <PageTitle>Music</PageTitle>
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
              onSelect={() => onOpen(item)}
              defaultFocus={index === firstFocus}
              onExtent={(box) => cards.current.set(index, { y: box.y, height: box.height })}
              onFocusChange={(focused) => focused && revealCard(index)}
            />
          ))}
        </View>
      </ScrollView>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `.media-grid { gap: 1.4rem 1rem }`, less the focus frame each card holds
    // inside its own box. See `layout.rowGap`.
    rowGap: Math.max(rem(0.5), rem(1.4) - CARD_FRAME * 2),
    columnGap: layout.rowGap,
    paddingHorizontal: pageGutter,
  },
});
