import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { Episode } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { mediaFocusId } from '../hooks/useAlphabetIndex';
import { px, colour, font, layout, rem, type } from '../styles/theme';

/**
 * One episode in the rail, from `.episode-card` / `.episode-still` in base.css.
 *
 * The still is 16:9 rather than the 2:3 of a poster, and the copy below it is a
 * heading row — title on the left, runtime or number on the right — over a
 * four-line synopsis.
 */
export function EpisodeCard({
  episode,
  onSelect,
  defaultFocus,
  progress,
  onFocusChange,
}: {
  episode: Episode;
  onSelect: () => void;
  defaultFocus?: boolean;
  progress?: number;
  onFocusChange?: (focused: boolean) => void;
}): React.JSX.Element {
  const still = episode.artwork?.thumbnail ?? episode.artwork?.backdrop ?? episode.artwork?.poster;

  return (
    <Focusable
      ring={false}
      // Addressable by the episode's id, so Back out of the player can hand
      // focus to the episode that was playing rather than to the season's
      // first — `App.tsx` seeds the season level's focus memory with it.
      focusId={mediaFocusId(episode.id)}
      onSelect={onSelect}
      defaultFocus={defaultFocus}
      onFocusChange={onFocusChange}
      style={styles.card}
    >
      {({ focused }) => (
        <>
          <View style={[styles.still, focused && styles.stillFocused]}>
            {still?.url ? (
              <Image source={{ uri: still.url }} style={styles.image} contentFit="cover" transition={120} />
            ) : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderGlyph}>{episode.episodeNumber}</Text>
              </View>
            )}
            {progress !== undefined && progress > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressValue, { width: `${Math.min(100, progress * 100)}%` }]} />
              </View>
            )}
          </View>

          <View style={styles.copy}>
            <View style={styles.heading}>
              <Text style={styles.title} numberOfLines={1}>
                {episode.title}
              </Text>
              <Text style={styles.number}>
                {episode.seasonNumber}×{String(episode.episodeNumber).padStart(2, '0')}
              </Text>
            </View>
            {episode.synopsis ? (
              <Text style={styles.synopsis} numberOfLines={4}>
                {episode.synopsis}
              </Text>
            ) : null}
          </View>
        </>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  // `.episode-card { padding: .45rem }` at `.episode-rail-item` width.
  card: {
    width: layout.episodeCardWidth,
    padding: rem(0.45),
  },
  // `.episode-still { aspect-ratio: 16/9; border-radius: .62rem; background: var(--surface-2) }`
  still: {
    aspectRatio: 16 / 9,
    borderRadius: rem(0.62),
    overflow: 'hidden',
    backgroundColor: colour.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // `.episode-still-link:focus-visible { outline: 1px solid var(--focus); transform: scale(1.018) }`
  stillFocused: {
    borderColor: colour.focus,
    transform: [{ scale: 1.018 }],
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderGlyph: {
    fontSize: rem(4),
    fontWeight: font.weightBold,
    color: '#ffffff17',
  },
  // `.episode-progress-track { left/right/bottom: .45rem; height: 3px }`
  progressTrack: {
    position: 'absolute',
    left: rem(0.45),
    right: rem(0.45),
    bottom: rem(0.45),
    height: px(3),
    borderRadius: 99,
    backgroundColor: '#000000bb',
    overflow: 'hidden',
  },
  progressValue: {
    height: '100%',
    backgroundColor: colour.red400,
  },
  // `.episode-copy { padding: .8rem .25rem .4rem }`
  copy: {
    paddingTop: rem(0.8),
    paddingHorizontal: rem(0.25),
    paddingBottom: rem(0.4),
  },
  // `.episode-heading { display: flex; align-items: baseline; gap: .8rem; justify-content: space-between }`
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: rem(0.8),
  },
  // `.episode-heading strong { font-size: 1.03rem; font-weight: 600; color: #dcdce0 }`
  title: {
    flexShrink: 1,
    fontSize: rem(1.03),
    fontWeight: font.weightSemibold,
    color: colour.cardTitle,
  },
  // `.episode-heading span { color: var(--text-faint); font-size: .78rem }`
  number: {
    color: colour.textFaint,
    fontSize: type.eyebrow,
  },
  // `.episode-copy p { margin: .55rem 0 0; color: var(--text-dim); line-height: 1.45 }`
  synopsis: {
    marginTop: rem(0.55),
    color: colour.textDim,
    fontSize: type.body,
    lineHeight: type.body * 1.45,
  },
});
