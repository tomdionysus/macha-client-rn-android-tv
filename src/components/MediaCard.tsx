import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { MediaSummary } from '@machafoundation/core';
import { cardLines, contextLinks, linkStep, type CardLink } from './cardLines';
import { Focusable } from './Focusable';
import { AvailabilityMarker } from './AvailabilityMarker';
import { cardInteraction } from './availability';
import { LazyArtwork } from './LazyArtwork';
import { mediaFocusId } from '../hooks/useAlphabetIndex';
import { tvFocus } from '../hooks/tvFocus';
import { useMacha } from '../app/MachaProvider';
import { colour, focusFrame, font, layout, px, radius, rem, type } from '../styles/theme';

/**
 * A poster card, from `.media-card` / `.poster` / `.card-title` in base.css,
 * with its own focus treatment rather than the shared ring.
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
  onOpenLink,
  rail,
}: {
  media: MediaSummary;
  onSelect?: () => void;
  defaultFocus?: boolean;
  /**
   * Give the card a focus id derived from its media id. Off by default: ids
   * must be unique on screen, and two rows can show the same title.
   */
  addressable?: boolean;
  /** Centre square music art in a 2:3 poster's height, for a grid mixing both (Search). */
  squareInPosterHeight?: boolean;
  /** 0–1, drawn across the poster foot. */
  progress?: number;
  onFocusChange?: (focused: boolean) => void;
  /** This card's box, for a scroller following focus. */
  onExtent?: (box: { x: number; y: number; width: number; height: number }) => void;
  /** Draw a remove button over the card, as its own focus target (Continue Watching). */
  onRemove?: () => void;
  /**
   * Show an episode's series and season as links under its title, each its
   * own focus target (the web client's Continue Watching and Search cards).
   */
  onOpenLink?: (target: MediaSummary) => void;
  /** The card's row, making its focus id unique per row; see `mediaFocusId`. */
  rail?: string;
}): React.JSX.Element {
  const { services } = useMacha();
  const mediaApi = services.mediaApi;
  const artwork = media.artwork?.poster ?? media.artwork?.thumbnail;
  const isSquare = media.kind === 'album' || media.kind === 'artist' || media.kind === 'track';
  const links = onOpenLink ? contextLinks(media) : undefined;
  // The links replace the lines they would repeat.
  const lines = links ? [] : cardLines(media);
  // OK does nothing on an unavailable title; see `cardInteraction` for when
  // it may still take focus.
  const interaction = cardInteraction(media, Boolean(onRemove));
  const playable = interaction.selectable;
  // The remove button's focus pairing; see `CardCloseButton`.
  const [cardFocused, setCardFocused] = useState(false);
  const [closeFocused, setCloseFocused] = useState(false);
  const [focusedLink, setFocusedLink] = useState<number | undefined>(undefined);
  const cardId = addressable || rail ? mediaFocusId(media.id, rail) : onRemove || links ? `card:${media.id}` : undefined;
  const closeId = `remove:${media.id}`;
  const linkId = (index: number) => `${cardId}:link:${index}`;
  const stepTo = (step: 'card' | number) => tvFocus.select(step === 'card' ? cardId : linkId(step));

  const card = (
    <Focusable
      ring={false}
      {...(cardId ? { focusId: cardId } : {})}
      onSelect={playable ? onSelect : undefined}
      disabled={!interaction.focusable}
      defaultFocus={defaultFocus}
      onFocusChange={(focused) => {
        setCardFocused(focused);
        onFocusChange?.(focused);
      }}
      // Up goes to the remove button and Down to the links; the scorer
      // cannot reach a centre inside the card.
      {...(onRemove || links
        ? {
            ownsDirection: (direction: string) =>
              (direction === 'up' && Boolean(onRemove)) || (links !== undefined && linkStep('card', direction, links.length) !== undefined),
            onDirection: (direction: string) => {
              if (direction === 'up' && onRemove) tvFocus.select(closeId);
              const step = links && linkStep('card', direction, links.length);
              if (step !== undefined) stepTo(step);
            },
          }
        : {})}
      onExtent={onExtent}
      style={styles.card}
      focusedStyle={styles.cardFocused}
    >
      {({ focused }) => (
        <>
          {/* Square art centred in a 2:3 box in mixed grids; otherwise a plain wrapper. */}
          <View style={isSquare && squareInPosterHeight ? styles.posterSlot : null}>
          <View
            style={[
              styles.poster,
              isSquare && styles.posterSquare,
              focused && styles.posterFocused,
            ]}
          >
            <View style={[styles.fill, !playable && styles.greyed]}>
            {artwork ? (
              // Not a plain `Image`: the URL is re-signed on every catalogue
              // fetch, which defeats a URL-keyed cache.
              <LazyArtwork api={mediaApi} artwork={artwork} style={styles.image} />
            ) : null}
            {artwork ? null : (
              <View style={styles.placeholder}>
                <Text style={styles.placeholderGlyph}>{media.title.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            </View>
            {progress !== undefined && progress > 0 && (
              <View style={styles.progressTrack}>
                <View style={[styles.progressValue, { width: `${Math.min(100, progress * 100)}%` }]} />
              </View>
            )}
            <AvailabilityMarker media={media} overlay />
          </View>
          </View>
          <Text style={[styles.title, !playable && styles.greyed]} numberOfLines={1}>
            {media.title}
          </Text>
          {lines.map((line) => (
            <Text key={line} style={[styles.subtitle, !playable && styles.greyed]} numberOfLines={1}>
              {line}
            </Text>
          ))}
        </>
      )}
    </Focusable>
  );

  if (!onRemove && !links) return card;
  return (
    <View>
      {card}
      {links && onOpenLink ? (
        <View style={styles.links}>
          {links.map((link, index) => (
            <CardLinkButton
              key={link.target.id}
              link={link}
              focusId={linkId(index)}
              reachable={cardFocused || focusedLink !== undefined}
              onSelect={() => onOpenLink(link.target)}
              onFocusChange={(focused) => setFocusedLink((current) => (focused ? index : current === index ? undefined : current))}
              step={(direction) => linkStep(index, direction, links.length)}
              onStep={stepTo}
            />
          ))}
        </View>
      ) : null}
      {onRemove ? (
        <CardCloseButton
          focusId={closeId}
          reachable={cardFocused || closeFocused}
          onSelect={onRemove}
          onFocusChange={setCloseFocused}
          onDown={() => cardId && tvFocus.select(cardId)}
        />
      ) : null}
    </View>
  );
}

/**
 * `.continue-card-context-link`: one of a card's links. Like the remove
 * button it is a focus candidate only while it, a sibling or its card has
 * focus; Up and Down walk the card and its links (`linkStep`).
 */
function CardLinkButton({
  link,
  focusId,
  reachable,
  onSelect,
  onFocusChange,
  step,
  onStep,
}: {
  link: CardLink;
  focusId: string;
  reachable: boolean;
  onSelect: () => void;
  onFocusChange: (focused: boolean) => void;
  step: (direction: string) => 'card' | number | undefined;
  onStep: (to: 'card' | number) => void;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      focusId={focusId}
      disabled={!reachable}
      onFocusChange={onFocusChange}
      ownsDirection={(direction) => step(direction) !== undefined}
      onDirection={(direction) => {
        const to = step(direction);
        if (to !== undefined) onStep(to);
      }}
      onSelect={onSelect}
      style={styles.link}
      focusedStyle={styles.linkFocused}
    >
      {({ focused }) => (
        <Text style={[styles.linkText, focused && styles.linkTextFocused]} numberOfLines={1}>
          {link.label}
        </Text>
      )}
    </Focusable>
  );
}

/**
 * `.card-close-button.continue-card-remove`: a small × at the card's top
 * right. It sits inside the card, where the scorer cannot reach it and where
 * it would steal focus from the poster, so it is a focus candidate only while
 * it or its card has focus: Up from the card selects it, Down returns.
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
  // `.continue-card-context { display: grid; gap: .08rem; margin-top: .28rem }`,
  // inset by the card's `.35rem` padding, which the links sit inside on the web.
  links: {
    marginTop: rem(0.28),
    paddingHorizontal: rem(0.35),
    gap: rem(0.08),
  },
  /**
   * `.continue-card-context-link:focus-visible { text-decoration: underline;
   * text-decoration-color: var(--focus) }`, drawn as a bottom border because
   * Android cannot colour an underline. Always present, so focus changes only
   * the colour.
   */
  link: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    borderBottomWidth: 1,
    borderBottomColor: 'transparent',
  },
  linkFocused: {
    borderBottomColor: colour.focus,
  },
  // `.continue-card-context-line { color: var(--text-dim); font-size: .82rem; line-height: 1.35 }`
  linkText: {
    color: colour.textDim,
    fontSize: rem(0.82),
    lineHeight: rem(0.82 * 1.35),
  },
  // `.continue-card-context-link:focus-visible { color: #dedee2 }`
  linkTextFocused: {
    color: '#dedee2',
  },
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
   * color: #fff; box-shadow: 0 0 0 1px var(--focus) }`, the shadow ring
   * drawn as the border.
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
  // Unavailable: on the artwork and text, not the card, so the marker keeps its colour.
  greyed: {
    opacity: 0.4,
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
    // The fill is on the artwork and placeholder; here it would show in the
    // padding as a grey frame.
    backgroundColor: 'transparent',
    // `outline: 1px solid var(--focus); outline-offset: 1px`, thickened to
    // be seen at ten feet. Always present, so focus changes only the colour
    // and the rectangles the scorer reads do not move.
    borderWidth: focusFrame.border,
    padding: focusFrame.gap,
    borderColor: 'transparent',
  },
  /** `.music-artwork { aspect-ratio: 1 }` — albums, artists and tracks. */
  posterSquare: {
    aspectRatio: 1,
  },
  /**
   * `.search-results .music-artwork { margin-top: 25%; margin-bottom: 25% }`,
   * as a 2:3 box centring the square: percentage margins halve the art here
   * (measured on the TCL set).
   */
  posterSlot: {
    width: '100%',
    aspectRatio: 2 / 3,
    justifyContent: 'center',
  },
  fill: {
    width: '100%',
    height: '100%',
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
