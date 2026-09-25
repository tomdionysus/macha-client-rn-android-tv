import { describe, expect, it, vi } from 'vitest';

// `storage.ts` imports AsyncStorage at module scope; nothing here touches it.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

const { parseQualityPreference, QUALITY_PREFERENCE_KEY } = await import('./qualityPreference');
const { shouldHydrate } = await import('./storage');

describe('quality preference', () => {
  it('is loaded by the startup hydrate, or it would read as unset after every restart', () => {
    expect(shouldHydrate(QUALITY_PREFERENCE_KEY)).toBe(true);
  });

  it("reads core's preference shape", () => {
    expect(parseQualityPreference('{"wifi":1080}')).toEqual({ wifi: 1080 });
    expect(parseQualityPreference('{"wifi":2160,"cellular":720}')).toEqual({ wifi: 2160, cellular: 720 });
  });

  it('treats anything that is not a quality class as unset', () => {
    expect(parseQualityPreference(null)).toBeUndefined();
    expect(parseQualityPreference('')).toBeUndefined();
    expect(parseQualityPreference('1080')).toBeUndefined();
    expect(parseQualityPreference('{"wifi":1000}')).toBeUndefined();
    expect(parseQualityPreference('{"wifi":"1080"}')).toBeUndefined();
    expect(parseQualityPreference('not json')).toBeUndefined();
  });
});
