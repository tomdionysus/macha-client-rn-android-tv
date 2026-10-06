import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  DEFAULT_SEARCH_CATEGORIES,
  DEFAULT_SEARCH_SORT,
  isSearchable,
  orderMedia,
  SEARCH_CATEGORIES,
  SEARCH_SORTS,
  type MediaApi,
  type MediaSortKey,
  type SearchCategoryKey,
  type MediaSummary,
  type AlphabetIndexKey,
} from '@machafoundation/core';
import { MediaCard } from '../components/MediaCard';
import { TvTextInput } from '../components/TvTextInput';
import { SortControl } from '../components/SortControl';
import { CategoryToggles } from '../components/CategoryToggles';
import { Focusable } from '../components/Focusable';
import { RefreshIcon } from '../components/NavIcons';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { availableToPlay } from '@machafoundation/core';
import { mediaFocusId, useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { ErrorMessage, Loading, PageTitle } from '../components/Status';
import { jumpTarget, scrollTarget } from '../hooks/focusScroll';
import { tvFocus } from '../hooks/tvFocus';
import { CARD_FRAME, colour, controlRow, focusFrame, layout, pageGutter, px, rem } from '../styles/theme';

/**
 * Search, with the web client's query rules: nothing is asked below core's
 * minimum, and results clear rather than stand under a half-typed query.
 * `TvTextInput` raises the leanback IME, and the focus registry stands down
 * (`tvFocus.suspend()`) while it owns the D-pad.
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
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_SEARCH_SORT);
  const [categories, setCategories] = useState<SearchCategoryKey[]>([...DEFAULT_SEARCH_CATEGORIES]);
  // Core's search names every hit: an episode with its series, a track as
  // "Artist - Album (year)".
  const ordered = useMemo(() => orderMedia(results, sort, SEARCH_SORTS), [results, sort]);
  // Asks the same question again (`.search-bar-refresh`).
  const [refreshToken, setRefreshToken] = useState(0);
  // The A-Z index only in title order, where a letter marks a run of the grid.
  const indexed = sort === 'title';
  // A letter leads only to titles that can take focus.
  const alphabet = useAlphabetIndex(useMemo(() => (indexed ? ordered.filter(availableToPlay) : []), [indexed, ordered]));

  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const contentHeight = useRef(0);
  const cards = useRef(new Map<number, { y: number; height: number }>());

  useEffect(() => {
    const normalised = query.trim();
    // Core's rule: "the", "an" and "a" do not count towards the minimum.
    if (!isSearchable(normalised)) {
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
        .search(normalised, undefined, { categories })
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
  }, [api, query, categories, refreshToken]);

  /** Focus the letter's first title and put its row at the top (`jumpTarget`). */
  const jumpToKey = (key: AlphabetIndexKey) => {
    const mediaId = alphabet.jumpTo(key);
    const index = mediaId === undefined ? -1 : ordered.findIndex((entry) => entry.id === mediaId);
    const extent = cards.current.get(index);
    if (!extent || viewportHeight.current <= 0) return;
    const target = jumpTarget(
      { offset: gridY.current + extent.y, length: extent.height },
      rem(1.4),
      Math.max(0, contentHeight.current - viewportHeight.current),
    );
    scrollY.current = target;
    scroller.current?.scrollTo({ y: target, animated: true });
  };

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
      <ScrollView
        ref={scroller}
        contentContainerStyle={styles.page}
        scrollEnabled={false}
        onContentSizeChange={(_, height) => {
          contentHeight.current = height;
        }}
      >
        <PageTitle>Search</PageTitle>

        {/*
          * `.search-bar { --search-control-height: 3.5rem; display: flex; gap: 1rem;
          * width: 100% }`: field, sort, type toggles, refresh (`controlRow`).
          */}
        <View style={styles.bar}>
          <TvTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search your library"
            defaultFocus
            fieldStyle={styles.field}
            boxStyle={styles.fieldBox}
            boxFocusedStyle={styles.fieldBoxFocused}
            inputStyle={styles.fieldInput}
          />
          <SortControl sorts={SEARCH_SORTS} value={sort} onChange={setSort} height={controlRow.height} />
          <CategoryToggles
            categories={SEARCH_CATEGORIES}
            selected={categories}
            onChange={setCategories}
            height={controlRow.height}
          />
          <Focusable
            ring={false}
            onSelect={() => setRefreshToken((value) => value + 1)}
            style={styles.refresh}
            focusedStyle={styles.refreshFocused}
          >
            {({ focused }) => <RefreshIcon size={px(22)} colour={focused ? colour.heading : colour.textDim} />}
          </Focusable>
        </View>

        {error ? <ErrorMessage error={error} /> : null}

        {query.trim().length === 0 ? null : searching && results.length === 0 ? (
          <Loading />
        ) : !isSearchable(query) || categories.length === 0 || results.length === 0 ? (
          // `.search-empty`: one line for every way a query comes back empty.
          <Text style={styles.empty}>Nothing found. Try different search terms or filters.</Text>
        ) : (
          <View
            style={[styles.grid, indexed && styles.gridIndexed]}
            onLayout={(event) => {
              gridY.current = event.nativeEvent.layout.y;
              // The grid can report its place after its cards do.
              const focusedIndex = ordered.findIndex((entry) => tvFocus.selected() === mediaFocusId(entry.id));
              if (focusedIndex >= 0 && cards.current.has(focusedIndex)) revealCard(focusedIndex);
            }}
          >
            {ordered.map((item, index) => (
              <MediaCard
                key={item.id}
                media={item}
                addressable
                squareInPosterHeight
                onSelect={() => onOpen(item)}
                onOpenLink={onOpen}
                onExtent={(box) => {
                cards.current.set(index, { y: box.y, height: box.height });
                // Focus restored by Back lands before layout; reveal once the box is known.
                if (tvFocus.selected() === mediaFocusId(item.id)) revealCard(index);
              }}
                onFocusChange={(focused) => focused && revealCard(index)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {indexed && ordered.length > 0 ? (
        <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={jumpToKey} />
      ) : null}
    </View>
  );
}

/** Settle before the node is asked. Asserted: the web client's figure, kept identical. */
const SETTLE_MS = 180;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: controlRow.height,
    gap: rem(1),
    paddingHorizontal: pageGutter,
    marginBottom: rem(1.4),
  },
  // `.search-input { flex: 1; min-width: 0 }`
  field: {
    flex: 1,
    minWidth: 0,
    marginBottom: 0,
  },
  /**
   * `.search-input { background: #19191c; border: 1px solid #3a3a40;
   * border-radius: .65rem; font-size: 1.15rem }`, with `focusFrame.border`.
   */
  fieldBox: {
    height: controlRow.height,
    justifyContent: 'center',
    borderRadius: controlRow.radius,
    backgroundColor: colour.inputBackground,
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
  },
  fieldBoxFocused: {
    borderColor: colour.focus,
  },
  fieldInput: {
    paddingVertical: 0,
    paddingHorizontal: rem(1.2),
    fontSize: rem(1.15),
    minWidth: 0,
  },
  // `.search-bar-refresh { width/height: var(--search-control-height); border-radius: .65rem }`
  refresh: {
    width: controlRow.height,
    height: controlRow.height,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: controlRow.radius,
    backgroundColor: colour.inputBackground,
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
  },
  refreshFocused: {
    borderColor: colour.focus,
  },
  // `.search-empty { place-items: center; color: var(--text-dim); font-size: 1.1rem }`
  empty: {
    marginTop: rem(4),
    textAlign: 'center',
    color: colour.textDim,
    fontSize: rem(1.1),
  },
  // `.media-grid { gap: 1.4rem 1rem }`, with `.search-results { row-gap: 1rem }`.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Less each card's focus frame. See `layout.rowGap`.
    rowGap: Math.max(rem(0.4), rem(1) - CARD_FRAME * 2),
    columnGap: layout.rowGap,
    paddingHorizontal: pageGutter,
    // Top-aligned, so a longer caption cannot push the other titles down.
    alignItems: 'flex-start',
  },
  // The strip is pinned over this edge when it is showing.
  gridIndexed: {
    paddingRight: pageGutter + alphabetStripWidth,
  },
});
