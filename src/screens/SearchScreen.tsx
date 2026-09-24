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
} from '@machafoundation/core';
import { MediaCard } from '../components/MediaCard';
import { TvTextInput } from '../components/TvTextInput';
import { SortControl } from '../components/SortControl';
import { CategoryToggles } from '../components/CategoryToggles';
import { Focusable } from '../components/Focusable';
import { RefreshIcon } from '../components/NavIcons';
import { AlphabetIndex, alphabetStripWidth } from '../components/AlphabetIndex';
import { mediaFocusId, useAlphabetIndex } from '../hooks/useAlphabetIndex';
import { ErrorMessage, Loading, PageTitle } from '../components/Status';
import { scrollTarget } from '../hooks/focusScroll';
import { tvFocus } from '../hooks/tvFocus';
import { CARD_FRAME, colour, controlRow, focusFrame, layout, pageGutter, px, rem, screenSize } from '../styles/theme';

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
  const [sort, setSort] = useState<MediaSortKey>(DEFAULT_SEARCH_SORT);
  const [categories, setCategories] = useState<SearchCategoryKey[]>([...DEFAULT_SEARCH_CATEGORIES]);
  // Every hit arrives already named by core's search: an episode with its
  // series, a track as "Artist - Album (year)".
  const ordered = useMemo(() => orderMedia(results, sort, SEARCH_SORTS), [results, sort]);
  // Asks the same question again; the row's last control (`.search-bar-refresh`).
  const [refreshToken, setRefreshToken] = useState(0);
  // The A-Z index, as on Movies and TV Shows, and like theirs only in title
  // order, where a letter marks a run of the grid.
  const indexed = sort === 'title';
  const alphabet = useAlphabetIndex(indexed ? ordered : []);

  const scroller = useRef<ScrollView | null>(null);
  const viewportHeight = useRef(0);
  const scrollY = useRef(0);
  const gridY = useRef(0);
  const cards = useRef(new Map<number, { y: number; height: number }>());

  useEffect(() => {
    const normalised = query.trim();
    // Core's rule, not a local minimum (Tom, 2026-09-24): "the", "an" and "a"
    // do not count towards it, because titles are not ordered by them.
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

        {/*
          * `.search-bar { --search-control-height: 3.5rem; display: flex;
          * gap: 1rem; width: 100% }`: field, sort, type toggles, refresh, in
          * that order, every one the same height and shape (`controlRow`).
          * The field takes whatever width the others leave.
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
          // One line for every way a query can come back empty — no match,
          // every toggle off, or only words titles are not ordered by — and
          // nothing at all while the field is empty (the web's `.search-empty`).
          <Text style={styles.empty}>Nothing found. Try different search terms or filters.</Text>
        ) : (
          <View
            style={[styles.grid, indexed && styles.gridIndexed]}
            onLayout={(event) => {
              gridY.current = event.nativeEvent.layout.y;
              // The grid can report its place after its cards report theirs;
              // a restored card revealed before this would miss by the gap.
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
                onExtent={(box) => {
                cards.current.set(index, { y: box.y, height: box.height });
                // Focus restored by Back lands on a card before it has laid
                // out, when there was nothing to scroll to. Reveal it once its
                // box is known, if it still holds focus (Firefly half below
                // the fold on `.133`, 2026-09-23).
                if (tvFocus.selected() === mediaFocusId(item.id)) revealCard(index);
              }}
                onFocusChange={(focused) => focused && revealCard(index)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {indexed && ordered.length > 0 ? (
        <AlphabetIndex availableKeys={alphabet.availableKeys} onSelect={alphabet.jumpTo} />
      ) : null}
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
   * border-radius: .65rem; font-size: 1.15rem }` in the row's height, with
   * `focusFrame.border` for the 1px so focus reads as it does on every card.
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
  // `.media-grid { gap: 1.4rem 1rem }` — row gap then column gap.
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `.media-grid { gap: 1.4rem 1rem }`, less the focus frame each card holds
    // inside its own box. See `layout.rowGap`.
    // `.search-results { row-gap: 1rem }` — tighter than the libraries' 1.4.
    rowGap: Math.max(rem(0.4), rem(1) - CARD_FRAME * 2),
    columnGap: layout.rowGap,
    paddingHorizontal: pageGutter,
    // Cards align to the top of their row, so one with a longer caption
    // cannot push the others' titles down.
    alignItems: 'flex-start',
  },
  // The strip is pinned over this edge when it is showing.
  gridIndexed: {
    paddingRight: pageGutter + alphabetStripWidth,
  },
});
