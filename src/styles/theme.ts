/**
 * The Macha appearance, ported from the web client's `src/styles/base.css`.
 *
 * The web client sets `html { font-size: 87.5% }`, so one rem is 14 CSS px,
 * and every size in that stylesheet is expressed in rem.
 *
 * **This file claimed dp and the web client's CSS px were the same unit, and
 * that was wrong on the hardware.** The claim was that Android TV runs its UI
 * on a 1920x1080 dp grid whatever the panel is. Measured on the TCL
 * `G10_4K_GB_NF_32BIT` (Android 12) on 2026-09-19: `wm size` reports a 1920x1080
 * surface and `wm density` reports **320**, so React Native's viewport is
 * **960x540 dp** — half the web client's CSS px viewport in each axis. Every
 * `rem()` therefore drew at twice its intended size, and every `clamp()` floor
 * expressed in px won where the web client's ceiling wins, so the cards were
 * both too large and too few to a row. Reported by Tom from the set as
 * "all too big", which is exactly what a factor of two looks like when nothing
 * is blurry.
 *
 * So there is one conversion and everything goes through it: `px()` takes a
 * length as `base.css` states it and returns dp for **this** viewport,
 * against the 1920 CSS px viewport the stylesheet's clamps were read at.
 * `vw()` and `vh()` need no conversion — a percentage of the viewport is the
 * same fraction in either unit, which is why the two families must not be
 * mixed by hand.
 *
 * Keep this file the single source of appearance. A colour written inline in a
 * component is a colour that will not follow when base.css changes.
 */
import { Dimensions } from 'react-native';

const screen = Dimensions.get('window');

/**
 * The viewport `base.css` is read against: the TV WebView's CSS px width.
 *
 * Not a guess — the web client's own clamps resolve against it, and this file
 * already documented which side of each `clamp()` wins "at a 1920-wide TV
 * viewport". Those resolutions are only correct if the conversion below is.
 */
export const DESIGN_WIDTH = 1920;

/**
 * CSS px to dp for this set.
 *
 * `1` on a device whose dp grid really is 1920 wide, which is what this file
 * used to assume of every television; `0.5` on the 4K TCL, which reports a
 * 1920x1080 surface at density 320.
 */
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
  /** `.player-option-group button { background: #09090ab8 }`. */
  optionSurface: '#09090ab8',
  /** `.player-option-group button { color: #bcbcc2 }`. */
  optionText: '#bcbcc2',
  scrubberTrack: '#e7e7ea',
  scrubberBuffered: '#d7a3af',
  scrubberPlayed: '#620014',

  /**
   * `.modal-backdrop { background: #000b }`.
   *
   * The web rule also carries `backdrop-filter: blur(7px)`, which React Native
   * has no equivalent for. Not approximated: the scrim alone is what separates
   * the dialogue from what is behind it, and a wrong blur would be a difference
   * from the web client rather than a missing one.
   */
  scrim: '#000000b8',
  /** `.modal-panel { background: #171719f7 }`. */
  modalSurface: '#171719f7',
  /** `.modal-danger-action { border-color: #8a303b }`. */
  dangerBorder: '#8a303b',
  /** `.modal-danger-action { background: #39080e }`. */
  dangerSurface: '#39080e',
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

/**
 * How faint a control is drawn when it cannot act.
 *
 * `.player-button-row button:disabled { opacity: .35 }` — the player's own row,
 * which is where the episode buttons live and which greys them out rather than
 * hiding them (Tom, 2026-09-23: the buttons always appear).
 */
export const disabledOpacity = {
  playerButton: 0.35,
} as const;

/**
 * How far a card's artwork stands inside the card's own box.
 *
 * The focus border plus its offset — see `MediaCard`'s `poster`. Declared here
 * because the gaps between cards have to account for it, and two files reading
 * the same three numbers by eye is how they stop agreeing.
 */
export const CARD_FRAME = 3 + px(2);

export const layout = {
  /** `.topbar { min-height: 62px }`. */
  topbarHeight: px(62),
  /** `.section-nav-slot { top: 62px }`. */
  sectionNavTop: px(62),
  /**
   * `.media-card { flex: 0 0 clamp(145px, 13vw, 225px) }`.
   *
   * **The bound is in CSS px and the preferred value is in viewport units**, so
   * only one of the three converts. Getting that wrong is what made the cards
   * too wide: unconverted, the 145 floor is 145 dp — 290 px on this set — and
   * beats a `13vw` that is already correct, so the row drew cards larger than
   * the web client's ceiling and fitted fewer of them.
   */
  mediaCardWidth: clamp(px(145), vw(13), px(225)),
  /** `.episode-rail-item { flex: 0 0 clamp(300px, 31vw, 480px) }`. */
  episodeCardWidth: clamp(px(300), vw(31), px(480)),
  /**
   * `.media-row { gap: 1rem }`, less what the focus frame takes.
   *
   * **The declared gap is no longer the visible one.** Each card carries a 3 dp
   * focus border and 2 CSS px of padding *inside* its width, so the artwork
   * stands about 4 dp in from the card's edge on every side and two neighbours
   * sit eight dp further apart than the stylesheet says. That is what Tom read
   * as too much space between titles, and it appeared the moment the border was
   * thickened rather than being there all along.
   *
   * So the gap is stated against the *artwork*, which is what a viewer actually
   * sees the space between. A negative result would mean the frame alone
   * exceeds the web client's gap, which is a sign the frame has grown too far
   * rather than something to lay out with — hence the floor.
   */
  rowGap: Math.max(rem(0.25), rem(1) - CARD_FRAME * 2),
  /** `.episode-rail { gap: 1.15rem }`. */
  episodeRailGap: rem(1.15),
} as const;

export const screenSize = screen;
