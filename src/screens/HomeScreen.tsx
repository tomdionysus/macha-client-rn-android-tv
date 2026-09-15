import { ScrollView, StyleSheet } from 'react-native';
import { newestCatalogueFirst, type MediaApi, type MediaSummary, type PlaybackProgress } from '@machafoundation/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaRow } from '../components/MediaRow';
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
    <ScrollView contentContainerStyle={styles.page} scrollEnabled={false}>
      <PageTitle>Home</PageTitle>
      {home.error ? <RefreshError error={home.error} /> : null}
      <MediaRow
        title="Continue Watching"
        items={progressItems}
        onSelect={onResume}
        progressFor={progressFor}
        defaultFocusFirst
      />
      <MediaRow
        title="Movies"
        items={newestCatalogueFirst(home.value.movies).slice(0, 14)}
        onSelect={onOpen}
        defaultFocusFirst={progressItems.length === 0}
      />
      <MediaRow title="TV Shows" items={newestCatalogueFirst(home.value.shows).slice(0, 14)} onSelect={onOpen} />
      <MediaRow title="Music" items={newestCatalogueFirst(home.value.albums).slice(0, 14)} onSelect={onOpen} />
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
