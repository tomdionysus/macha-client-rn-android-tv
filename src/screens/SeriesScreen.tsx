import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Episode, MediaApi, MediaSummary, SeasonDetails, ShowDetails } from '@macha/core';
import { useRefreshableAsync } from '../hooks/useAsync';
import { ErrorMessage, Loading, PageTitle, RefreshError } from '../components/Status';
import { MediaRow } from '../components/MediaRow';
import { EpisodeCard } from '../components/EpisodeCard';
import { colour, layout, pageGutter, rem, type } from '../styles/theme';

/**
 * A show and its seasons, from `.series-content` in the web client.
 *
 * Seasons are drawn with the same poster rail as everything else, so a viewer
 * arriving from the library sees the same shape of thing they just left.
 */
export function SeriesScreen({
  api,
  show,
  onOpenSeason,
}: {
  api: MediaApi;
  show: MediaSummary;
  onOpenSeason: (season: MediaSummary) => void;
}): React.JSX.Element {
  const details = useRefreshableAsync(() => api.details(show.id), [api, show.id]);
  const seasons = (details.value as ShowDetails | undefined)?.seasons ?? [];

  return (
    <ScrollView contentContainerStyle={styles.page} scrollEnabled={false}>
      <PageTitle>{show.title}</PageTitle>
      {show.synopsis ? (
        <Text style={styles.synopsis} numberOfLines={3}>
          {show.synopsis}
        </Text>
      ) : null}
      {details.error ? (
        details.value ? <RefreshError error={details.error} /> : <ErrorMessage error={details.error} />
      ) : null}
      {!details.value && details.loading ? <Loading /> : null}
      <MediaRow title="Seasons" items={seasons} onSelect={onOpenSeason} defaultFocusFirst />
    </ScrollView>
  );
}

/**
 * One season's episodes, from `.episode-rail`.
 *
 * The rail is horizontal on the web and stays horizontal here: a 10-foot UI
 * reads a row of 16:9 stills far better than a vertical list, and left/right is
 * the natural D-pad gesture for "next episode".
 */
export function SeasonScreen({
  api,
  season,
  onPlayEpisode,
  progressFor,
}: {
  api: MediaApi;
  season: MediaSummary;
  onPlayEpisode: (episode: Episode) => void;
  progressFor?: (mediaId: string) => number | undefined;
}): React.JSX.Element {
  const details = useRefreshableAsync(() => api.details(season.id), [api, season.id]);
  const episodes = (details.value as SeasonDetails | undefined)?.episodes ?? [];
  const scroller = useRef<ScrollView | null>(null);

  const scrollToIndex = (index: number) => {
    const stride = layout.episodeCardWidth + layout.episodeRailGap;
    scroller.current?.scrollTo({ x: Math.max(0, index * stride - stride), animated: true });
  };

  return (
    <ScrollView contentContainerStyle={styles.page} scrollEnabled={false}>
      <PageTitle>{season.title}</PageTitle>
      {details.error ? (
        details.value ? <RefreshError error={details.error} /> : <ErrorMessage error={details.error} />
      ) : null}
      {!details.value && details.loading ? <Loading /> : null}

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        contentContainerStyle={styles.rail}
      >
        {episodes.map((episode, index) => (
          <EpisodeCard
            key={episode.id}
            episode={episode}
            onSelect={() => onPlayEpisode(episode)}
            defaultFocus={index === 0}
            progress={progressFor?.(episode.id)}
            onFocusChange={(focused) => focused && scrollToIndex(index)}
          />
        ))}
      </ScrollView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  synopsis: {
    paddingHorizontal: pageGutter,
    maxWidth: rem(56),
    color: colour.bodyBright,
    fontSize: type.synopsis,
    lineHeight: type.synopsis * 1.65,
  },
  // `.episode-rail { gap: 1.15rem; padding: .65rem 3vw 1.6rem .2rem }`
  rail: {
    gap: layout.episodeRailGap,
    paddingTop: rem(0.65),
    paddingBottom: rem(1.6),
    paddingHorizontal: pageGutter,
  },
});
