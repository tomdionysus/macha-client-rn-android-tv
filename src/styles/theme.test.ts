import { describe, expect, it, vi } from 'vitest';

/**
 * The unit conversion between `base.css` and this platform.
 *
 * dp and the web client's CSS px are not the same unit on a television: the
 * TCL `G10_4K_GB_NF_32BIT` reports a 1920x1080 surface at density 320, so React
 * Native's viewport is 960x540 dp. The conversion is asserted against both a
 * 1920 dp grid and the 960 dp one the hardware reports.
 */
async function themeAt(width: number, height: number) {
  vi.resetModules();
  vi.doMock('react-native', () => ({
    Dimensions: { get: () => ({ width, height, scale: 1, fontScale: 1 }) },
  }));
  return import('./theme');
}

describe('CSS px to dp', () => {
  it('is one-to-one on a viewport that really is 1920 dp wide', async () => {
    const theme = await themeAt(1920, 1080);
    expect(theme.scale).toBe(1);
    expect(theme.rem(1)).toBe(14);
    expect(theme.px(62)).toBe(62);
  });

  it('halves on the 4K set, which reports 960 dp', async () => {
    // 1920x1080 px at density 320. The panel is 3840x2160 and irrelevant: the
    // compositor's surface is what React Native lays out against.
    const theme = await themeAt(960, 540);
    expect(theme.scale).toBe(0.5);
    expect(theme.rem(1)).toBe(7);
    expect(theme.px(62)).toBe(31);
  });

  it('draws a media card at the size the web client settles on, on both', async () => {
    // `.media-card { flex: 0 0 clamp(145px, 13vw, 225px) }`. At a 1920 viewport
    // 13vw is 249.6, so the 225 ceiling wins — and it must go on winning once
    // converted, or the row fits fewer cards than the web client shows.
    const wide = await themeAt(1920, 1080);
    expect(wide.layout.mediaCardWidth).toBe(225);

    const set = await themeAt(960, 540);
    // Half the dp, therefore the same physical size on the same panel.
    expect(set.layout.mediaCardWidth).toBe(112.5);
  });

  it('does not convert viewport units, which are already a fraction', async () => {
    // `clamp()` mixes CSS px bounds with a vw preferred value, and only the
    // bounds convert. An unconverted 145 floor
    // is 290 px on this set and beats a `13vw` that was already correct.
    const set = await themeAt(960, 540);
    expect(set.vw(13)).toBeCloseTo(124.8, 5);
    expect(set.pageGutter).toBeCloseTo(28.8, 5);
  });
});
