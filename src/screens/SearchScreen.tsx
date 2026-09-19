import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MediaApi, MediaSummary } from '@machafoundation/core';
import { MediaCard } from '../components/MediaCard';
import { TvTextInput } from '../components/TvTextInput';
import { ErrorMessage, Loading, PageTitle } from '../components/Status';
import { scrollTarget } from '../hooks/focusScroll';
import { CARD_FRAME, layout, pageGutter, rem, screenSize } from '../styles/theme';

/**
 * Search, from the web client's screen of the same name.
 *
 * **The design was settled before it was built** (Tom, 2026-09-10): use the
 * television's own on-screen keyboard. A React Native `TextInput` raises the
 * leanback IME the viewer already knows, with its own voice input, and drawing
 * one would be larger and worse. `TvTextInput` is that field, and the reason
 * `tvFocus.suspend()` exists — while the IME owns the D-pad the focus registry
 * must stand down, or selection wanders behind the keyboard.
 *
 * The query rules are the web client's exactly, because a viewer moving between
 * the two should not find one of them answering and the other not: **two
 * characters before anything is asked of the node**, and a **180 ms** settle so
 * a word typed on a remote is one request rather than eight. Below two
 * characters the results are cleared rather than left standing, since a stale
 * grid under a half-typed query reads as an answer to it.
 */
export function SearchScreen({
  api,
  onOpen,
}: {
  api: MediaApi;
  onOpen: (media: MediaSummary) => void;
}): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<Error | undefined>();

  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const cards = useRef(new Map<number, { y: number; height: number }>());

  useEffect(() => {
    const normalised = query.trim();
    if (normalised.length < 2) {
      setResults([]);
      setError(undefined);
      setSearching(false);
      return undefined;
    }
    let active = true;
    setSearching(true);
    setError(undefined);
    const timer = setTimeout(() => {
      void api
        .search(normalised)
        .then((value) => {
          if (active) setResults(value);
        })
        .catch((reason: unknown) => {
          if (active) setError(reason instanceof Error ? reason : new Error(String(reason)));
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, SETTLE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [api, query]);

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

  return (
    <View
      style={styles.screen}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <ScrollView ref={scroller} contentContainerStyle={styles.page} scrollEnabled={false}>
        <PageTitle>Search</PageTitle>

        <View style={styles.field}>
          <TvTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            defaultFocus
          />
        </View>

        {error ? <ErrorMessage error={error} /> : null}

        {query.trim().length < 2 ? (
          <Text style={styles.hint}>Type two letters or more to search.</Text>
        ) : searching && results.length === 0 ? (
          <Loading />
        ) : results.length === 0 ? (
          <Text style={styles.hint}>Nothing matched “{query.trim()}”.</Text>
        ) : (
          <View
            style={styles.grid}
            onLayout={(event) => {
              gridY.current = event.nativeEvent.layout.y;
            }}
          >
            {results.map((item, index) => (
              <MediaCard
                key={item.id}
                media={item}
                onSelect={() => onOpen(item)}
                onExtent={(box) => cards.current.set(index, { y: box.y, height: box.height })}
                onFocusChange={(focused) => focused && revealCard(index)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/**
 * How long the field is left alone before the node is asked.
 *
 * The web client's figure, and the reason to keep it identical is the viewer
 * rather than the server: a search that feels quicker on one client and slower
 * on another is a difference nobody can explain from the outside. It is also
 * why it is not tuned up for a remote — an on-screen keyboard is slower to type
 * on than a physical one, so if anything each keystroke here is further apart
 * than the settle.
 */
const SETTLE_MS = 180;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  field: {
    paddingHorizontal: pageGutter,
    marginBottom: rem(1.4),
    maxWidth: rem(34),
  },
  hint: {
    paddingHorizontal: pageGutter,
    color: '#77777f',
    fontSize: rem(1),
  },
  // `.media-grid { gap: 1.4rem 1rem }` — row gap then column gap.
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
