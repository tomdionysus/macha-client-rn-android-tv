import { ScrollView, StyleSheet, View } from 'react-native';
import { newestCatalogueFirst, type MediaApi, type MediaSummary, type PlaybackProgress } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaRow } from '../components/MediaRow';
import { usePageFocusScroll } from '../hooks/usePageFocusScroll';
import { pageGutter, rem } from '../styles/theme';

/**
 * Home, matching the web client's screen of the same name: Continue Watching
 * first, then the three catalogue rails, each trimmed to the fourteen most
 * recently catalogued items by `newestCatalogueFirst` from core.
 */
export function HomeScreen({
  api,
  continueWatching,
  onOpen,
  onResume,
}: {
  api: MediaApi;
  continueWatching: PlaybackProgress[];
  onOpen: (media: MediaSummary) => void;
  onResume: (media: MediaSummary) => void;
}): React.JSX.Element {
  const home = useRefreshableAsync(() => api.home(), [api]);
  const { scroller, viewportHeight, measureRow, revealRow } = usePageFocusScroll(rem(1));

  if (!home.value) {
    return (
      <ScrollView contentContainerStyle={styles.page}>
        <PageTitle>Home</PageTitle>
        {home.loading ? <Loading /> : home.error ? <ErrorMessage error={home.error} /> : null}
      </ScrollView>
    );
  }

  const progressItems = continueWatching.flatMap((entry) => (entry.media ? [entry.media] : []));
  const progressById = new Map(continueWatching.map((entry) => [entry.mediaId, entry]));

  const progressFor = (media: MediaSummary): number | undefined => {
    const entry = progressById.get(media.id);
    if (!entry || entry.durationMs <= 0) return undefined;
    return entry.positionMs / entry.durationMs;
  };

  return (
    <ScrollView
      ref={scroller}
      contentContainerStyle={styles.page}
      // A television has no touch. The page follows focus instead — without
      // this the rows below the fold could be focused and never seen, which is
      // how the selector came to sit on a card cut off by the bottom edge.
      scrollEnabled={false}
      onLayout={(event) => {
        viewportHeight.current = event.nativeEvent.layout.height;
      }}
    >
      <PageTitle>Home</PageTitle>
      {home.error ? <RefreshError error={home.error} /> : null}
      <View onLayout={measureRow('continue')}>
        <MediaRow
          title="Continue Watching"
          items={progressItems}
          onSelect={onResume}
          progressFor={progressFor}
          defaultFocusFirst
          onRowFocus={() => revealRow('continue')}
        />
      </View>
      <View onLayout={measureRow('movies')}>
        <MediaRow
          title="Movies"
          items={newestCatalogueFirst(home.value.movies).slice(0, 14)}
          onSelect={onOpen}
          defaultFocusFirst={progressItems.length === 0}
          onRowFocus={() => revealRow('movies')}
        />
      </View>
      <View onLayout={measureRow('shows')}>
        <MediaRow
          title="TV Shows"
          items={newestCatalogueFirst(home.value.shows).slice(0, 14)}
          onSelect={onOpen}
          onRowFocus={() => revealRow('shows')}
        />
      </View>
      <View onLayout={measureRow('music')}>
        <MediaRow
          title="Music"
          items={newestCatalogueFirst(home.value.albums).slice(0, 14)}
          onSelect={onOpen}
          onRowFocus={() => revealRow('music')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // `main { padding: 1rem 3vw 4rem }`. The rails apply the horizontal gutter
  // themselves so a focused card can scroll flush to the screen edge.
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
    paddingHorizontal: 0,
  },
});
