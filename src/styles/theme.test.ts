import { describe, expect, it, vi } from 'vitest';

/**
 * The TCL set reports a 1920x1080 surface at density 320, so React Native's
 * viewport is 960x540 dp: CSS px and dp differ by a factor of two.
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
    // 1920x1080 px at density 320; the 3840x2160 panel is irrelevant to layout.
    const theme = await themeAt(960, 540);
    expect(theme.scale).toBe(0.5);
    expect(theme.rem(1)).toBe(7);
    expect(theme.px(62)).toBe(31);
  });

  it('draws a media card at the size the web client settles on, on both', async () => {
    // .media-card { flex: 0 0 clamp(145px, 13vw, 225px) }: at 1920, 13vw is
    // 249.6, so the 225 ceiling wins.
    const wide = await themeAt(1920, 1080);
    expect(wide.layout.mediaCardWidth).toBe(225);

    const set = await themeAt(960, 540);
    // Half the dp: the same physical size.
    expect(set.layout.mediaCardWidth).toBe(112.5);
  });

  it('does not convert viewport units, which are already a fraction', async () => {
    // In `clamp()` only the px bounds convert; the vw value is already a fraction.
    const set = await themeAt(960, 540);
    expect(set.vw(13)).toBeCloseTo(124.8, 5);
    expect(set.pageGutter).toBeCloseTo(28.8, 5);
  });
});
