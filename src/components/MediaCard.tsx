import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@machafoundation/core';
import { cardLines } from './cardLines';
import { Focusable } from './Focusable';
import { LazyArtwork } from './LazyArtwork';
import { mediaFocusId } from '../hooks/useAlphabetIndex';
import { tvFocus } from '../hooks/tvFocus';
import { useMacha } from '../app/MachaProvider';
import { colour, focusFrame, font, layout, px, radius, rem, type } from '../styles/theme';

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
  squareInPosterHeight = false,
  onRemove,
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
  /**
   * Centre square music art in the height of a 2:3 poster, so a grid mixing
   * the two starts every title on the same line. Search does this
   * (`.search-results .music-artwork { margin-top: 25%; margin-bottom: 25% }`)
   * and the music rows, which are all square, do not.
   */
  squareInPosterHeight?: boolean;
  /** 0–1, drawn as `.progress-track` / `.progress-value` across the poster foot. */
  progress?: number;
  onFocusChange?: (focused: boolean) => void;
  /** This card's box, for a scroller that has to follow focus. */
  onExtent?: (box: { x: number; y: number; width: number; height: number }) => void;
  /**
   * Draw `.card-close-button` over the card, for Continue Watching's "Remove
   * … from Continue Watching". Its own focus target, above the card, as on
   * the web client, whose focus weights this client's scorer reproduces.
   */
  onRemove?: () => void;
}): React.JSX.Element {
  const { services } = useMacha();
  const mediaApi = services.mediaApi;
  const artwork = media.artwork?.poster ?? media.artwork?.thumbnail;
  const isSquare = media.kind === 'album' || media.kind === 'artist' || media.kind === 'track';
  const lines = cardLines(media);
  // The remove button's focus pairing; see `CardCloseButton`.
  const [cardFocused, setCardFocused] = useState(false);
  const [closeFocused, setCloseFocused] = useState(false);
  const cardId = addressable ? mediaFocusId(media.id) : onRemove ? `card:${media.id}` : undefined;
  const closeId = `remove:${media.id}`;

  const card = (
    <Focusable
      ring={false}
      {...(cardId ? { focusId: cardId } : {})}
      onSelect={onSelect}
      defaultFocus={defaultFocus}
      onFocusChange={(focused) => {
        setCardFocused(focused);
        onFocusChange?.(focused);
      }}
      // Up from a card with a remove button goes to that button: the
      // scorer cannot, because the button's centre is inside the card.
      {...(onRemove
        ? {
            ownsDirection: (direction: string) => direction === 'up',
            onDirection: (direction: string) => direction === 'up' && tvFocus.select(closeId),
          }
        : {})}
      onExtent={onExtent}
      style={styles.card}
      focusedStyle={styles.cardFocused}
    >
      {({ focused }) => (
        <>
          {/*
            * In a grid that mixes shapes, square art sits centred in a box
            * with a poster's 2:3 shape, so its title starts on the same line
            * as the posters' beside it. A plain wrapper otherwise.
            */}
          <View style={isSquare && squareInPosterHeight ? styles.posterSlot : null}>
          <View
            style={[
              styles.poster,
              isSquare && styles.posterSquare,
              focused && styles.posterFocused,
            ]}
          >
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
          </View>
          <Text style={styles.title} numberOfLines={1}>
            {media.title}
          </Text>
          {lines.map((line) => (
            <Text key={line} style={styles.subtitle} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </>
      )}
    </Focusable>
  );

  if (!onRemove) return card;
  return (
    <View>
      {card}
      <CardCloseButton
        focusId={closeId}
        reachable={cardFocused || closeFocused}
        onSelect={onRemove}
        onFocusChange={setCloseFocused}
        onDown={() => cardId && tvFocus.select(cardId)}
      />
    </View>
  );
}

/**
 * `.card-close-button.continue-card-remove`: a small × at the card's top
 * right. The web client's label ("Remove … from Continue Watching") is for a
 * screen reader, which a television has none of here, so none is drawn.
 *
 * **Reached from its card, not by the scorer.** It sits inside the card, so
 * the scorer, which moves only to a centre beyond the current edge, cannot
 * reach it with Up or Right from the card; and coming down onto the row, it
 * is nearer than the card and would take focus meant for the poster. So it is
 * a candidate only while its card or it has focus, Up from the card selects
 * it, and Down from it returns. Always drawn, as on the web client.
 */
function CardCloseButton({
  focusId,
  reachable,
  onSelect,
  onFocusChange,
  onDown,
}: {
  focusId: string;
  reachable: boolean;
  onSelect: () => void;
  onFocusChange: (focused: boolean) => void;
  onDown: () => void;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      focusId={focusId}
      disabled={!reachable}
      onFocusChange={onFocusChange}
      ownsDirection={(direction) => direction === 'down'}
      onDirection={(direction) => direction === 'down' && onDown()}
      onSelect={onSelect}
      style={styles.close}
      focusedStyle={styles.closeFocused}
    >
      {({ focused }) => <Text style={[styles.closeGlyph, focused && styles.closeGlyphFocused]}>×</Text>}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  /**
   * `.card-close-button { position: absolute; width: 1.8rem; height: 1.8rem;
   * border: 1px solid #ffffff18; border-radius: .48rem; background: #08080ac9;
   * color: #dedee2; font-size: 1.25rem; opacity: .78 }` and
   * `.continue-card-remove { top: .78rem; right: .78rem }`.
   */
  close: {
    position: 'absolute',
    top: rem(0.78),
    right: rem(0.78),
    width: rem(1.8),
    height: rem(1.8),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ffffff18',
    borderRadius: rem(0.48),
    backgroundColor: '#08080ac9',
    opacity: 0.78,
  },
  /**
   * `:focus-visible { opacity: 1; border-color: #8a303b; background: #30070be8;
   * color: #fff; box-shadow: 0 0 0 1px var(--focus) }` — the ring as the
   * border, in the focus colour, since the shadow does not draw here.
   */
  closeFocused: {
    opacity: 1,
    borderColor: colour.focus,
    backgroundColor: '#30070be8',
  },
  closeGlyph: {
    color: '#dedee2',
    fontSize: rem(1.25),
    lineHeight: rem(1.25),
  },
  closeGlyphFocused: {
    color: '#ffffff',
  },
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
    transform: [{ scale: focusFrame.scale }],
  },
  // `.poster { aspect-ratio: 2/3; border-radius: .55rem; background: var(--surface-2) }`
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: radius.poster,
    overflow: 'hidden',
    /**
     * **No fill of its own.** It had `surface-2`, which is the colour a poster
     * with no artwork shows — and once this element gained padding to hold the
     * focus border off the picture, that fill became a grey frame around every
     * card on screen, focused or not. The fill belongs to what it stands in
     * for, so it now sits on the artwork and the placeholder rather than on the
     * frame around them.
     */
    backgroundColor: 'transparent',
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
    borderWidth: focusFrame.border,
    padding: focusFrame.gap,
    borderColor: 'transparent',
  },
  /** `.music-artwork { aspect-ratio: 1 }` — albums, artists and tracks. */
  posterSquare: {
    aspectRatio: 1,
  },
  /**
   * `.search-results .music-artwork { margin-top: 25%; margin-bottom: 25% }` —
   * the web centres a square in a poster's height with percentage margins.
   * Measured on `.133`, 2026-09-24, those do not resolve here as they do in
   * CSS: the art came out at about half size and its title started higher
   * than the posters'. A box of the poster's own shape, centring the square,
   * gives the same result without depending on how margins resolve.
   */
  posterSlot: {
    width: '100%',
    aspectRatio: 2 / 3,
    justifyContent: 'center',
  },
  posterFocused: {
    borderColor: colour.focus,
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: radius.poster,
    backgroundColor: colour.surface2,
  },
  placeholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.poster,
    backgroundColor: colour.surface2,
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
