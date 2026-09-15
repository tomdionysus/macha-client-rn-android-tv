import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@machafoundation/core';
import { Focusable } from '../components/Focusable';
import { clamp, colour, font, pageGutter, radius, rem, type, vw } from '../styles/theme';

/**
 * Movie detail, from `.detail` / `.movie-detail-layout` in base.css.
 *
 * The web layout is a two-column grid — a poster of `clamp(190px, 22vw, 310px)`
 * beside the copy — with the backdrop washed in behind at 28% under a fade
 * mask. React Native has no mask-image, so the backdrop is drawn at a reduced
 * opacity and the copy sits on the page background below it; at three metres
 * the difference is not visible, and inventing a gradient library for one
 * element would not earn its place.
 */
export function DetailScreen({
  media,
  resumePositionMs,
  onPlay,
  onBack,
}: {
  media: MediaSummary;
  resumePositionMs: number;
  onPlay: (positionMs: number) => void;
  onBack: () => void;
}): React.JSX.Element {
  const poster = media.artwork?.poster ?? media.artwork?.thumbnail;
  const backdrop = media.artwork?.backdrop;
  const canResume = resumePositionMs > 0;

  return (
    <ScrollView contentContainerStyle={styles.page} scrollEnabled={false}>
      {/* `.detail-backdrop { height: 58vh; opacity: .28 }` */}
      {backdrop?.url ? (
        <Image source={{ uri: backdrop.url }} style={styles.backdrop} contentFit="cover" />
      ) : null}

      <View style={styles.layout}>
        <View style={styles.poster}>
          {poster?.url ? (
            <Image source={{ uri: poster.url }} style={styles.posterImage} contentFit="cover" />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Text style={styles.posterGlyph}>{media.title.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        <View style={styles.copy}>
          {media.kind ? <Text style={styles.eyebrow}>{media.kind}</Text> : null}
          <Text style={styles.h1} numberOfLines={2}>
            {media.title}
          </Text>
          {media.year ? <Text style={styles.subtitle}>{media.year}</Text> : null}
          {media.synopsis ? (
            <Text style={styles.synopsis} numberOfLines={6}>
              {media.synopsis}
            </Text>
          ) : null}

          {/* `.play-actions { display: flex; gap: .65rem }` */}
          <View style={styles.actions}>
            {canResume ? (
              <ActionButton
                label="Resume"
                primary
                defaultFocus
                onSelect={() => onPlay(resumePositionMs)}
              />
            ) : null}
            <ActionButton
              label={canResume ? 'Play from start' : 'Play'}
              primary={!canResume}
              defaultFocus={!canResume}
              onSelect={() => onPlay(0)}
            />
            <ActionButton label="Back" onSelect={onBack} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/** `.primary-button` and `.secondary-button`. */
function ActionButton({
  label,
  onSelect,
  primary,
  defaultFocus,
}: {
  label: string;
  onSelect: () => void;
  primary?: boolean;
  defaultFocus?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      onSelect={onSelect}
      defaultFocus={defaultFocus}
      style={[styles.button, primary ? styles.primaryButton : styles.secondaryButton]}
      focusedStyle={styles.buttonFocused}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Focusable>
  );
}

const POSTER_WIDTH = clamp(190, vw(22), 310);

const styles = StyleSheet.create({
  page: {
    paddingTop: rem(1),
    paddingBottom: rem(4),
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: '58%',
    opacity: 0.28,
  },
  // `.movie-detail-layout { grid-template-columns: clamp(190px,22vw,310px) minmax(0,1fr); gap: clamp(1.6rem,4vw,3.8rem) }`
  layout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: clamp(rem(1.6), vw(4), rem(3.8)),
    paddingHorizontal: pageGutter,
    marginTop: rem(0.8),
  },
  // `.movie-detail-poster { aspect-ratio: 2/3; border-radius: .7rem }`
  poster: {
    width: POSTER_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: rem(0.7),
    overflow: 'hidden',
    backgroundColor: colour.surface2,
  },
  posterImage: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  posterGlyph: {
    fontSize: rem(5),
    fontWeight: font.weightBold,
    color: colour.placeholderGlyph,
  },
  copy: {
    flex: 1,
  },
  // `.eyebrow { text-transform: uppercase; letter-spacing: .12em; font-size: .78rem }`
  eyebrow: {
    color: colour.textDim,
    textTransform: 'uppercase',
    letterSpacing: type.eyebrow * 0.12,
    fontSize: type.eyebrow,
  },
  h1: {
    fontSize: type.h1,
    lineHeight: type.h1 * 1.02,
    letterSpacing: -type.h1 * 0.025,
    marginTop: rem(0.6),
    marginBottom: rem(0.6),
    color: colour.heading,
    fontWeight: font.weightMedium,
  },
  // `.subtitle { color: var(--text-dim); font-size: 1.1rem }`
  subtitle: {
    color: colour.textDim,
    fontSize: type.subtitle,
  },
  // `.synopsis { max-width: 70ch; line-height: 1.65; font-size: clamp(1rem,1.35vw,1.25rem) }`
  synopsis: {
    marginTop: rem(1),
    maxWidth: rem(46),
    lineHeight: type.synopsis * 1.65,
    fontSize: type.synopsis,
    color: colour.bodyBright,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: rem(0.65),
    marginTop: rem(1),
  },
  // `.primary-button { padding: .8rem 1.25rem; border-radius: .55rem; font-weight: 650 }`
  button: {
    paddingVertical: rem(0.8),
    paddingHorizontal: rem(1.25),
    borderRadius: radius.control,
    borderWidth: 1,
  },
  primaryButton: {
    backgroundColor: colour.accentSurfaceStrong,
    borderColor: 'transparent',
  },
  // `.secondary-button { background: #0b0b0dcf; border: 1px solid #ffffff18 }`
  secondaryButton: {
    backgroundColor: '#0b0b0dcf',
    borderColor: '#ffffff18',
  },
  buttonFocused: {
    backgroundColor: colour.accentFocusWash,
    borderColor: colour.focus,
  },
  buttonLabel: {
    color: '#e5e5e8',
    fontWeight: font.weightSemibold,
    fontSize: type.body,
  },
});
