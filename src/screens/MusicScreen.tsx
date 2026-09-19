import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { sortMediaByIndexedTitle, type MediaApi, type MediaSummary } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaCard } from '../components/MediaCard';
import { scrollTarget } from '../hooks/focusScroll';
import { layout, pageGutter, rem, screenSize } from '../styles/theme';

/**
 * Music — albums, and only albums for now.
 *
 * **This is one of the web client's seven music routes, not a port of them.**
 * That client has artists, albums, tracks, playlists and a page for each, all
 * hanging off an `OverflowMenu` this client does not have yet, and a queue that
 * outlives the screen. `TODO/ACTIVE.md` §4.6 is the whole of it.
 *
 * Albums first because it is the one that stands alone: a grid of things a
 * viewer recognises, opening the same detail screen everything else opens. The
 * nav entry is therefore honest — it goes somewhere real — rather than a stub
 * that apologises, which is the alternative that was rejected.
 *
 * **What a viewer cannot do here yet**, so it is not rediscovered as a bug:
 * play a whole album in order, queue anything, or reach an artist. All three
 * need the queue and the menu, and both are in §4.6.
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

  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const cards = useRef(new Map<number, { y: number; height: number }>());

  const columns = Math.max(
    1,
    Math.floor((screenSize.width - pageGutter * 2) / (layout.mediaCardWidth + rem(1))),
  );

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
              defaultFocus={index === 0}
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
    rowGap: rem(1.4),
    columnGap: rem(1),
    paddingHorizontal: pageGutter,
  },
});
