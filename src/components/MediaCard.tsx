import { StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { LazyArtwork } from './LazyArtwork';
import { mediaFocusId } from '../hooks/useAlphabetIndex';
import { useMacha } from '../app/MachaProvider';
import { px, colour, font, layout, radius, rem, type } from '../styles/theme';

/**
 * A poster card, from `.media-card` / `.poster` / `.card-title` in base.css.
 *
 * The focus treatment is the card's own rather than the shared ring:
 * `.media-card:focus-visible` scales to 1.04 and washes the background, which
 * is the strongest focus signal in the interface and the main way a viewer
 * tracks where they are on a wall of posters.
 */
export function MediaCard({
  media,
  onSelect,
  defaultFocus,
  progress,
  onFocusChange,
  onExtent,
  addressable = false,
}: {
  media: MediaSummary;
  onSelect?: () => void;
  defaultFocus?: boolean;
  /**
   * Give this card a focus id derived from its media id, so something else can
   * move focus to it by name — the alphabet strip jumping to a letter.
   *
   * Off by default: two rows showing the same title (Continue Watching and a
   * library row, say) would otherwise register the same id twice and the
   * registry would keep only one of them.
   */
  addressable?: boolean;
  /** 0–1, drawn as `.progress-track` / `.progress-value` across the poster foot. */
  progress?: number;
  onFocusChange?: (focused: boolean) => void;
  /** This card's box, for a scroller that has to follow focus. */
  onExtent?: (box: { x: number; y: number; width: number; height: number }) => void;
}): React.JSX.Element {
  const { services } = useMacha();
  const mediaApi = services.mediaApi;
  const artwork = media.artwork?.poster ?? media.artwork?.thumbnail;
  const isSquare = media.kind === 'album' || media.kind === 'artist' || media.kind === 'track';

  return (
    <Focusable
      ring={false}
      {...(addressable ? { focusId: mediaFocusId(media.id) } : {})}
      onSelect={onSelect}
      defaultFocus={defaultFocus}
      onFocusChange={onFocusChange}
      onExtent={onExtent}
      style={styles.card}
      focusedStyle={styles.cardFocused}
    >
      {({ focused }) => (
        <>
          <View style={[styles.poster, isSquare && styles.posterSquare, focused && styles.posterFocused]}>
            {artwork ? (
              // Not `<Image source={{ uri: artwork.url }} />`: the server
              // re-signs that URL on every catalogue fetch, so handing it
              // straight to a URL-keyed image cache re-downloads every poster
              // on every revisit. `LazyArtwork` remembers what loaded, and
              // walks to another node when one refuses.
              <LazyArtwork api={mediaApi} artwork={artwork} style={styles.image} />
            ) : null}
            {artwork ? null : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderGlyph}>{media.title.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {progress !== undefined && progress > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressValue, { width: `${Math.min(100, progress * 100)}%` }]} />
              </View>
            )}
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {media.title}
          </Text>
          {media.subtitle || media.year ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {media.subtitle ?? String(media.year)}
            </Text>
          ) : null}
        </>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  // `.media-card { flex: 0 0 clamp(145px, 13vw, 225px); border-radius: .75rem; padding: .35rem }`
  card: {
    width: layout.mediaCardWidth,
    padding: rem(0.35),
    borderRadius: radius.card,
    backgroundColor: 'transparent',
  },
  // `.media-card:focus-visible { transform: scale(1.04); background: var(--accent-focus-wash) }`
  cardFocused: {
    backgroundColor: colour.accentFocusWash,
    transform: [{ scale: 1.04 }],
  },
  // `.poster { aspect-ratio: 2/3; border-radius: .55rem; background: var(--surface-2) }`
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: 'hidden',
    backgroundColor: colour.surface2,
    /**
     * Thicker than the web client's, and standing off the artwork.
     *
     * `outline: 1px solid var(--focus); outline-offset: 1px` is what base.css
     * draws, and React Native has no outline at all — so the border was on the
     * poster itself, one dp wide, touching the picture. At three metres that
     * read as nothing: a hairline against a lit poster is the one place a thin
     * line cannot be seen. Three dp with the artwork inset by two reproduces
     * the *offset*, which is the part that makes it legible — a gap of
     * background between the line and the image, so the line has something to
     * be seen against. Tom's call off the set, twice.
     *
     * The border and the padding are both always present and only the colour
     * changes, so nothing moves on focus: the scorer reads these rectangles,
     * and a card that grew when focused would shift its neighbours.
     */
    borderWidth: 3,
    padding: px(2),
    borderColor: 'transparent',
  },
  /** `.music-artwork { aspect-ratio: 1 }` — albums, artists and tracks. */
  posterSquare: {
    aspectRatio: 1,
  },
  posterFocused: {
    borderColor: colour.focus,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.poster,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `.poster-placeholder { font-size: 4rem; font-weight: 700; color: #ffffff16 }`
  placeholderGlyph: {
    fontSize: rem(4),
    fontWeight: font.weightBold,
    color: colour.placeholderGlyph,
  },
  // `.card-title { margin-top: .65rem; font-weight: 600; color: #dcdce0 }`
  title: {
    marginTop: rem(0.65),
    fontWeight: font.weightSemibold,
    color: colour.cardTitle,
    fontSize: type.body,
  },
  // `.card-subtitle { margin-top: .15rem; color: var(--text-dim); font-size: .85rem }`
  subtitle: {
    marginTop: rem(0.15),
    color: colour.textDim,
    fontSize: type.cardSubtitle,
  },
  // `.progress-track { left/right/bottom: .4rem; height: 4px; border-radius: 99px; background: #000b }`
  progressTrack: {
    position: 'absolute',
    left: rem(0.4),
    right: rem(0.4),
    bottom: rem(0.4),
    height: px(4),
    borderRadius: radius.pill,
    backgroundColor: '#000000bb',
    overflow: 'hidden',
  },
  // `.progress-value { background: var(--red-400) }`
  progressValue: {
    height: '100%',
    backgroundColor: colour.red400,
  },
});
