import { Image } from 'expo-image';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { MediaSummary, VersionStep } from '@machafoundation/core';
import { usePlaybackVersions } from '../app/usePlaybackVersions';
import { Focusable } from '../components/Focusable';
import { PlayerIcon, type PlayerIconName } from '../components/PlayerIcons';
import { clamp, colour, font, pageGutter, px, radius, rem, type, vw } from '../styles/theme';
import { ceilingText, qualityLabel, versionHowLabel } from '../text/viewerText';

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
  /** With a version, that version as the viewer's choice; without, core decides. */
  onPlay: (positionMs: number, version?: VersionStep) => void;
  onBack: () => void;
}): React.JSX.Element {
  const poster = media.artwork?.poster ?? media.artwork?.thumbnail;
  const backdrop = media.artwork?.backdrop;
  const canResume = resumePositionMs > 0;
  const versions = usePlaybackVersions(media);
  // Tom, 2026-09-25: the quality buttons show only when there is a choice.
  const steps = versions && versions.steps.length > 1 ? versions.steps : [];

  return (
    <ScrollView contentContainerStyle={styles.page} scrollEnabled={false}>
      {/* `.detail-backdrop { height: 58vh; opacity: .28 }` */}
      {backdrop?.url ? (
        <Image source={{ uri: backdrop.url }} style={styles.backdrop} contentFit="cover" />
      ) : null}

      {/* `.back-button`, which shares the nav link's shape and sits above the copy. */}
      <Focusable
        ring={false}
        onSelect={onBack}
        style={styles.backButton}
        focusedStyle={styles.backButtonFocused}
      >
        <Text style={styles.backLabel}>← Back</Text>
      </Focusable>

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

          {/*
            `.play-actions.detail-play-controls` — **round icon buttons, not
            labelled pills**. The web client draws a play glyph, and a restart
            glyph beside it when there is a position to resume from; this had
            "Resume", "Play from start" and "Back" as text, which is a different
            control in the same place. Same `.media-control-button` the transport
            row uses, which is why they look alike there and now here.
          */}
          <View style={styles.actions}>
            <ControlButton
              icon="play"
              defaultFocus
              onSelect={() => onPlay(canResume ? resumePositionMs : 0)}
            />
            {canResume ? <ControlButton icon="restart" onSelect={() => onPlay(0)} /> : null}
            {/*
              Per-quality Play (Tom, 2026-09-25): the generic Play above means
              "decide for me", and beside it one button per quality, each playing
              that version as the viewer's choice. One row, crossed with
              Left/Right, Play first and focused. Each plays from the same place
              Play would.
            */}
            {steps.map((step) => (
              <VersionButton
                key={step.quality}
                step={step}
                onSelect={() => onPlay(canResume ? resumePositionMs : 0, step)}
              />
            ))}
          </View>
          {steps.length > 0 && versions?.limitedBy ? (
            <Text style={styles.versionNote}>{ceilingText(versions.limitedBy)}</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * `.media-control-button`: a 3.25rem circle with a glyph in it.
 *
 * The same rule as the transport row — `border: 1px solid #48484f`, background
 * `#080809d6`, and on focus the accent fill with the focus border — because on
 * the web they are literally the same selector.
 */
function ControlButton({
  icon,
  onSelect,
  defaultFocus,
}: {
  icon: PlayerIconName;
  onSelect: () => void;
  defaultFocus?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      onSelect={onSelect}
      defaultFocus={defaultFocus}
      style={styles.controlButton}
      focusedStyle={styles.controlButtonFocused}
    >
      <PlayerIcon name={icon} />
    </Focusable>
  );
}

/**
 * One version: its quality, and how this set would play it.
 *
 * No web rule to port yet; no client had drawn these when this was written.
 * It takes the transport button's frame and fill so the row reads as one
 * control group, at the same height, stretched to a pill for its two words.
 */
function VersionButton({ step, onSelect }: { step: VersionStep; onSelect: () => void }): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      onSelect={onSelect}
      style={styles.versionButton}
      focusedStyle={styles.controlButtonFocused}
    >
      <Text style={styles.versionQuality}>{qualityLabel(step.quality)}</Text>
      <Text style={styles.versionHow}>{versionHowLabel(step)}</Text>
    </Focusable>
  );
}

/** `.movie-detail-poster { width: clamp(190px, 22vw, 310px) }`. */
const POSTER_WIDTH = clamp(px(190), vw(22), px(310));

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
    gap: rem(0.7),
    marginTop: rem(1),
  },
  /**
   * `.media-control-button { width: 3.25rem; height: 3.25rem; border-radius: 50%;
   * border: 1px solid #48484f; background: #080809d6 }`.
   */
  controlButton: {
    width: rem(3.25),
    height: rem(3.25),
    borderRadius: rem(3.25) / 2,
    borderWidth: 1,
    borderColor: '#48484f',
    backgroundColor: '#080809d6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.media-control-button`'s frame, as a pill; see `VersionButton`. */
  versionButton: {
    height: rem(3.25),
    paddingHorizontal: rem(1.1),
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#48484f',
    backgroundColor: '#080809d6',
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.45),
  },
  versionQuality: {
    color: colour.heading,
    fontSize: type.body,
    fontWeight: font.weightSemibold,
  },
  versionHow: {
    color: colour.textDim,
    fontSize: type.small,
  },
  /** The same size and colour as `.player-option-note`. */
  versionNote: {
    marginTop: rem(0.6),
    color: colour.textFaint,
    fontSize: type.faint,
  },
  /** `:focus-visible { background: #160004e8; border-color: #620014 }`. */
  controlButtonFocused: {
    backgroundColor: '#160004e8',
    borderColor: '#620014',
  },
  /** `.back-button` shares `.topbar nav a`: `padding: .65rem .9rem; radius: .55rem`. */
  backButton: {
    alignSelf: 'flex-start',
    marginLeft: pageGutter,
    marginBottom: rem(0.6),
    paddingVertical: rem(0.65),
    paddingHorizontal: rem(0.9),
    borderRadius: radius.control,
  },
  backButtonFocused: {
    backgroundColor: colour.accentSurface,
  },
  backLabel: {
    color: colour.textDim,
    fontSize: type.body,
    fontWeight: font.weightMedium,
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
