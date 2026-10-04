import { ScrollView, StyleSheet, View } from 'react-native';
import {
  currentAvailability,
  newestCatalogueFirst,
  withoutAvailability,
  type CatalogueApi,
  type MediaApi,
  type MediaSummary,
  type PlaybackProgress,
} from '@machafoundation/core';
import { useAsync, useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaRow } from '../components/MediaRow';
import { usePageFocusScroll } from '../hooks/usePageFocusScroll';
import { rem } from '../styles/theme';

/** Home, as the web client's: Continue Watching, then three rails of the fourteen newest. */
export function HomeScreen({
  api,
  catalogue,
  continueWatching,
  onOpen,
  onResume,
  onRemoveFromContinueWatching,
}: {
  api: MediaApi;
  /** For Continue Watching's current availability. */
  catalogue: CatalogueApi;
  continueWatching: PlaybackProgress[];
  onOpen: (media: MediaSummary) => void;
  onResume: (media: MediaSummary) => void;
  /** Forget this entry. */
  onRemoveFromContinueWatching: (media: MediaSummary) => void;
}): React.JSX.Element {
  const home = useRefreshableAsync(() => api.home(), [api]);
  /**
   * Entries store no availability, so markers come from a fresh read of each
   * title. Without an answer a card has no marker and stays playable.
   */
  const continueIds = continueWatching.flatMap((entry) => (entry.media ? [entry.media.id] : []));
  const continueKey = continueIds.join('\n');
  const current = useAsync((signal) => currentAvailability(continueIds, catalogue, signal), [catalogue, continueKey]);
  const { scroller, measureViewport, measureRow, revealRow } = usePageFocusScroll(rem(1));

  if (!home.value) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <PageTitle>Home</PageTitle>
        {home.loading ? <Loading /> : home.error ? <ErrorMessage error={home.error} /> : null}
      </ScrollView>
    );
  }

  const progressItems = continueWatching.flatMap((entry) =>
    entry.media ? [{ ...withoutAvailability(entry.media), ...current.value?.get(entry.media.id) }] : [],
  );
  const progressById = new Map(continueWatching.map((entry) => [entry.itemId, entry]));

  const progressFor = (media: MediaSummary): number | undefined => {
    const entry = progressById.get(media.id);
    if (!entry || entry.durationMs <= 0) return undefined;
    return entry.positionMs / entry.durationMs;
  };

  return (
    <View style={styles.fill} onLayout={measureViewport}>
    <ScrollView
      ref={scroller}
      contentContainerStyle={styles.page}
      // No touch: the page follows focus instead.
      scrollEnabled={false}
    >
      <PageTitle>Home</PageTitle>
      {home.error ? <RefreshError error={home.error} /> : null}
      <View onLayout={measureRow('continue')}>
        <MediaRow
          title="Continue Watching"
          rail="continue"
          items={progressItems}
          onSelect={onResume}
          onRemove={onRemoveFromContinueWatching}
          progressFor={progressFor}
          defaultFocusFirst
          onRowFocus={() => revealRow('continue')}
        />
      </View>
      <View onLayout={measureRow('movies')}>
        <MediaRow
          title="Movies"
          rail="movies"
          items={newestCatalogueFirst(home.value.movies).slice(0, 14)}
          onSelect={onOpen}
          defaultFocusFirst={progressItems.length === 0}
          onRowFocus={() => revealRow('movies')}
        />
      </View>
      <View onLayout={measureRow('shows')}>
        <MediaRow
          title="TV Shows"
          rail="shows"
          items={newestCatalogueFirst(home.value.shows).slice(0, 14)}
          onSelect={onOpen}
          onRowFocus={() => revealRow('shows')}
        />
      </View>
      <View onLayout={measureRow('music')}>
        <MediaRow
          title="Music"
          rail="music"
          items={newestCatalogueFirst(home.value.albums).slice(0, 14)}
          onSelect={onOpen}
          onRowFocus={() => revealRow('music')}
        />
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  // `main { padding: 1rem 3vw 4rem }`. The rails apply the horizontal gutter
  // themselves so a focused card can scroll flush to the screen edge.
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
    paddingHorizontal: 0,
  },
});
