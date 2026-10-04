/**
 * The Macha appearance, ported from the web client's `src/styles/base.css`;
 * the single source of appearance. `base.css` sizes are rem, and one rem is
 * 14 CSS px (`html { font-size: 87.5% }`).
 *
 * dp is not CSS px: the TCL set reports a 1920x1080 surface at density 320, so
 * the viewport is 960x540 dp (measured). `px()` converts a `base.css` length
 * to dp for this viewport; `vw()` and `vh()` need no conversion.
 */
import { Dimensions } from 'react-native';

const screen = Dimensions.get('window');

/** The viewport `base.css` is read against: the TV WebView's CSS px width. */
export const DESIGN_WIDTH = 1920;

/** CSS px to dp: `0.5` on the TCL set. */
export const scale = screen.width / DESIGN_WIDTH;

/** A length as `base.css` states it, in dp. */
export function px(value: number): number {
  return value * scale;
}

/** One rem in CSS px, from `html { font-size: 87.5% }` on a 16px root. */
export const REM = 14;

export function rem(value: number): number {
  return px(value * REM);
}

export function vw(value: number): number {
  return (screen.width * value) / 100;
}

export function vh(value: number): number {
  return (screen.height * value) / 100;
}

/** CSS `clamp()`: the preferred value bounded by a floor and a ceiling. */
export function clamp(min: number, preferred: number, max: number): number {
  return Math.min(Math.max(preferred, min), max);
}

/** The palette, verbatim from `:root` in base.css. `#rrggbbaa` carries across unchanged. */
export const colour = {
  /** `background: #0e0e0f` on `:root`. */
  background: '#0e0e0f',
  /** `color: #e2e2e5` on `:root`. */
  text: '#e2e2e5',

  surface: '#171719',
  surface2: '#222226',
  surface3: '#2a2a2e',
  textDim: '#aaaab2',
  textFaint: '#77777f',

  // Macha accent palette: near-black, highly saturated crimson.
  red950: '#020000',
  red900: '#050001',
  red800: '#0b0002',
  red700: '#130003',
  red600: '#1e0005',
  red500: '#2c0008',
  red400: '#42000d',

  focus: '#4b000f',
  accent: '#2c0008',
  accentSurface: '#130003a8',
  accentSurfaceStrong: '#260007c2',
  accentFocusWash: '#39000b24',
  accentGlow: '#62001428',

  // Literals that recur in base.css.
  heading: '#dedee2',
  headingDim: '#d7d7db',
  cardTitle: '#dcdce0',
  bodyBright: '#d1d1d5',
  error: '#ffb4b4',
  hairline: '#ffffff1a',
  hairlineFaint: '#ffffff12',
  inputBorder: '#3a3a40',
  inputBackground: '#19191c',
  placeholderGlyph: '#ffffff16',
  /** `.audio-player-placeholder { color: #ffffff22 }`. */
  audioPlaceholderGlyph: '#ffffff22',
  /** `.audio-player-artist { color: #f2f2f4 }`. */
  audioArtist: '#f2f2f4',
  /** `.player-option-group button { background: #09090ab8 }`. */
  optionSurface: '#09090ab8',
  /** `.player-option-group button { color: #bcbcc2 }`. */
  optionText: '#bcbcc2',
  /** `.search-type-pill { color: #9a9aa2 }`. */
  toggleOff: '#9a9aa2',
  /** Red is unavailable, yellow partial or unknown. This client's own: base.css has no rule for them. */
  availabilityRed: '#ff4d4f',
  availabilityYellow: '#ffc53d',
  /** The disc behind a marker: `.card-close-button`'s fill. */
  markerSurface: '#08080ac9',
  scrubberTrack: '#e7e7ea',
  scrubberBuffered: '#d7a3af',
  scrubberPlayed: '#620014',

  /** `.modal-backdrop { background: #000b }`. Its `backdrop-filter: blur(7px)` has no React Native equivalent. */
  scrim: '#000000b8',
  /** `.modal-panel { background: #171719f7 }`. */
  modalSurface: '#171719f7',
  /** `.modal-danger-action { background: #39080e }`. */
  dangerSurface: '#39080e',
} as const;

/** Type scale, from the web client's `clamp()`ed sizes. */
export const type = {
  /** `h1`: clamp(2rem, 4vw, 4rem) — 4vw is 76.8 at 1920, so the 4rem ceiling wins. */
  h1: clamp(rem(2), vw(4), rem(4)),
  /** `h2`: clamp(1.2rem, 2vw, 1.75rem) — 2vw is 38.4, so the 1.75rem ceiling wins. */
  h2: clamp(rem(1.2), vw(2), rem(1.75)),
  /** `.player-titlebar strong`: clamp(1.3rem, 2.2vw, 2rem). */
  playerTitle: clamp(rem(1.3), vw(2.2), rem(2)),
  /** `.synopsis`: clamp(1rem, 1.35vw, 1.25rem). */
  synopsis: clamp(rem(1), vw(1.35), rem(1.25)),

  body: rem(1),
  subtitle: rem(1.1),
  cardSubtitle: rem(0.85),
  small: rem(0.82),
  eyebrow: rem(0.78),
  faint: rem(0.75),
  badge: rem(0.72),
} as const;

/** Font stack. `Roboto` is the Android system font, matching the web client's `Roboto Variable`. */
export const font = {
  family: 'Roboto',
  /** base.css uses `font-weight: 650` on primary buttons. */
  weightSemibold: '600' as const,
  weightMedium: '500' as const,
  weightBold: '700' as const,
};

/** `main { padding: 1rem 3vw 4rem }` — the horizontal page gutter. */
export const pageGutter = vw(3);

export const radius = {
  card: rem(0.75),
  poster: rem(0.55),
  control: rem(0.55),
  small: rem(0.45),
  pill: 999,
} as const;

/** `.player-button-row button:disabled { opacity: .35 }`: dimmed, not hidden. */
export const disabledOpacity = {
  playerButton: 0.35,
} as const;

/**
 * The focus look of every selectable media card: an always-present border
 * that changes colour, a gap reproducing base.css's `outline-offset`, and
 * `.media-card:focus-visible { transform: scale(1.04); background: var(--accent-focus-wash) }`.
 * The border is thicker than base.css's 1px outline, to read at three metres.
 */
export const focusFrame = {
  border: 3,
  gap: px(2),
  scale: 1.04,
} as const;

/** How far a card's artwork stands inside the card's box: the focus border plus its gap. Gaps between cards account for it. */
export const CARD_FRAME = focusFrame.border + focusFrame.gap;

/**
 * One height and radius for every control in Search's row:
 * `.search-bar { --search-control-height: 3.5rem }`, `border-radius: .65rem`.
 */
export const controlRow = {
  height: rem(3.5),
  radius: rem(0.65),
} as const;

export const layout = {
  /** `.topbar { min-height: 62px }`. */
  topbarHeight: px(62),
  /** `.section-nav-slot { top: 62px }`. */
  sectionNavTop: px(62),
  /** `.media-card { flex: 0 0 clamp(145px, 13vw, 225px) }`. Only the px bounds convert; the vw value does not. */
  mediaCardWidth: clamp(px(145), vw(13), px(225)),
  /** `.episode-rail-item { flex: 0 0 clamp(300px, 31vw, 480px) }`. */
  episodeCardWidth: clamp(px(300), vw(31), px(480)),
  /**
   * `.media-row { gap: 1rem }`, less the focus frame each card carries inside
   * its width, so the gap is between artwork. Floored in case the frame
   * exceeds the gap.
   */
  rowGap: Math.max(rem(0.25), rem(1) - CARD_FRAME * 2),
  /** `.episode-rail { gap: 1.15rem }`. */
  episodeRailGap: rem(1.15),
} as const;

export const screenSize = screen;
