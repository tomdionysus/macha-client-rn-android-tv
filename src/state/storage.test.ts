import { describe, expect, it, vi } from 'vitest';
import {
  MACHA_STORAGE_KEYS,
  MACHA_STORAGE_KEY_PREFIXES,
  MACHA_STORAGE_PROBE_KEY,
} from '@machafoundation/core';

// `storage.ts` imports AsyncStorage at module scope; nothing here touches it.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

const { shouldHydrate } = await import('./storage');

/**
 * Core cannot tell an unhydrated key from an unset one, so a key this filter
 * misses is a wrong conclusion in core. Driven by core's registry so a key
 * core adds fails here.
 */
describe('hydrate filter, against core\'s key registry', () => {
  it('loads every complete key core owns', () => {
    for (const key of MACHA_STORAGE_KEYS) {
      expect(shouldHydrate(key), `core owns ${key}`).toBe(true);
    }
  });

  it('loads every prefixed key core owns, completed as core completes them', () => {
    for (const prefix of MACHA_STORAGE_KEY_PREFIXES) {
      expect(shouldHydrate(`${prefix}some-client-id`), `core owns ${prefix}*`).toBe(true);
    }
  });

  it('loads the write-probe key, which core expects to enumerate', () => {
    expect(shouldHydrate(MACHA_STORAGE_PROBE_KEY)).toBe(true);
  });

  it('covers both of core\'s naming conventions', () => {
    expect(shouldHydrate('macha.session.v1')).toBe(true);
    expect(shouldHydrate('macha-client-id')).toBe(true);
  });

  it('loads the keys core reads only to migrate from', () => {
    // Unhydrated, the migration silently does not run and resume positions are lost.
    expect(shouldHydrate('macha-client-progress:some-client-id')).toBe(true);
    expect(shouldHydrate('macha-server-url')).toBe(true);
  });

  it('loads this client\'s own keys, which core\'s registry does not cover', () => {
    // `isMachaStorageKey` is false for these. Asserted by literal: core's
    // registry is not a record of this client's keys.
    expect(shouldHydrate('macha-playback-failure-trail-v1')).toBe(true);
    expect(shouldHydrate('macha.volume.v1.some-client-id')).toBe(true);
  });

  it('does not load keys belonging to anything else', () => {
    expect(shouldHydrate('expo-splash')).toBe(false);
    expect(shouldHydrate('RCTAsyncLocalStorage')).toBe(false);
    expect(shouldHydrate('')).toBe(false);
  });
});
