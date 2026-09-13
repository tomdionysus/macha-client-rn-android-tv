/**
 * The Macha appearance, ported from the web client's `src/styles/base.css`.
 *
 * The web client sets `html { font-size: 87.5% }`, so one rem is 14 CSS px,
 * and every size in that stylesheet is expressed in rem. Android TV runs its
 * UI at 1920x1080 dp regardless of panel resolution (a 4K set reports density
 * 2.0 over the same 1080p dp grid), and the TV WebView reports the same 1920
 * CSS px viewport — so dp and the web client's CSS px are the same unit here
 * and `rem()`/`vw()` reproduce the stylesheet directly rather than by eye.
 *
 * Keep this file the single source of appearance. A colour written inline in a
 * component is a colour that will not follow when base.css changes.
 */
import { Dimensions } from 'react-native';

/** One rem in CSS px, from `html { font-size: 87.5% }` on a 16px root. */
export const REM = 14;

export function rem(value: number): number {
  return value * REM;
}

const screen = Dimensions.get('window');

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

/**
 * The palette, verbatim from `:root` in base.css.
 *
 * React Native accepts `#rrggbbaa` with the same alpha-last ordering as CSS,
 * so the translucent accents carry across unchanged.
 */
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

  // Literals that recur in base.css and deserve names rather than repetition.
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
  scrubberTrack: '#e7e7ea',
  scrubberBuffered: '#d7a3af',
  scrubberPlayed: '#620014',
} as const;

/**
 * Type scale. The web client's headings are `clamp()`ed against viewport
 * width, so they resolve differently on a phone and a television; these are
 * the values that clamp settles on at a 1920-wide TV viewport.
 */
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
  /** base.css uses `font-weight: 650` on primary buttons; RN accepts numeric weights as strings. */
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

export const layout = {
  /** `.topbar { min-height: 62px }`. */
  topbarHeight: 62,
  /** `.section-nav-slot { top: 62px }`. */
  sectionNavTop: 62,
  /** `.media-card { flex: 0 0 clamp(145px, 13vw, 225px) }`. */
  mediaCardWidth: clamp(145, vw(13), 225),
  /** `.episode-rail-item { flex: 0 0 clamp(300px, 31vw, 480px) }`. */
  episodeCardWidth: clamp(300, vw(31), 480),
  /** `.media-row { gap: 1rem }`. */
  rowGap: rem(1),
  /** `.episode-rail { gap: 1.15rem }`. */
  episodeRailGap: rem(1.15),
} as const;

export const screenSize = screen;
