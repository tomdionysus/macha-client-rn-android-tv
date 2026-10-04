import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { Episode } from '@machafoundation/core';
import { AvailabilityMarker } from './AvailabilityMarker';
import { availableToPlay } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { mediaFocusId } from '../hooks/useAlphabetIndex';
import { px, colour, focusFrame, font, layout, radius, rem, type } from '../styles/theme';
import { episodeLabel } from '../text/viewerText';

/** One episode in the rail, from `.episode-card` / `.episode-still` in base.css. */
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
  // An unavailable episode takes no focus, so OK cannot play it.
  const playable = availableToPlay(episode);

  return (
    <Focusable
      ring={false}
      // `App.tsx` seeds focus memory with this id, so Back from the player
      // lands on the episode that was playing.
      focusId={mediaFocusId(episode.id)}
      onSelect={onSelect}
      disabled={!playable}
      defaultFocus={defaultFocus}
      onFocusChange={onFocusChange}
      style={styles.card}
      focusedStyle={styles.cardFocused}
    >
      {({ focused }) => (
        <>
          <View style={[styles.still, focused && styles.stillFocused]}>
            <View style={[styles.fill, !playable && styles.greyed]}>
              {still?.url ? (
                <Image source={{ uri: still.url }} style={styles.image} contentFit="cover" transition={120} />
              ) : (
                <View style={styles.placeholder}>
                  <Text style={styles.placeholderGlyph}>{episode.episodeNumber}</Text>
                </View>
              )}
            </View>
            {progress !== undefined && progress > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressValue, { width: `${Math.min(100, progress * 100)}%` }]} />
              </View>
            )}
            <AvailabilityMarker media={episode} overlay />
          </View>

          <View style={[styles.copy, !playable && styles.greyed]}>
            <View style={styles.heading}>
              <Text style={styles.title} numberOfLines={1}>
                {episode.title}
              </Text>
              <Text style={styles.number}>
                {episodeLabel(episode)}
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
  /** Unavailable: everything but the marker. */
  greyed: {
    opacity: 0.4,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  // `.episode-card { padding: .45rem }` at `.episode-rail-item` width.
  card: {
    width: layout.episodeCardWidth,
    padding: rem(0.45),
    borderRadius: radius.card,
    backgroundColor: 'transparent',
  },
  // `MediaCard`'s focus (`focusFrame`), not `.episode-still-link`'s 1px
  // outline, which is too thin at ten feet.
  cardFocused: {
    backgroundColor: colour.accentFocusWash,
    transform: [{ scale: focusFrame.scale }],
  },
  // `.episode-still { aspect-ratio: 16/9; border-radius: .62rem }`. The
  // border is always present, so focus changes only its colour.
  still: {
    aspectRatio: 16 / 9,
    borderRadius: rem(0.62),
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: focusFrame.border,
    padding: focusFrame.gap,
    borderColor: 'transparent',
  },
  stillFocused: {
    borderColor: colour.focus,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: rem(0.45),
    backgroundColor: colour.surface2,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: rem(0.45),
    backgroundColor: colour.surface2,
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
