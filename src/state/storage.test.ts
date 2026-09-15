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
 * The hydrate filter is a contract with core, not a local convenience.
 *
 * Core's `StorageLike` is synchronous, so this client answers every core read
 * from a cache loaded once at startup. A key absent from that cache reads as
 * `null`, and **core cannot distinguish "not loaded" from "not set"** — so a
 * key this filter misses is not a missing value, it is core drawing a wrong
 * conclusion. `clientId()` mints a fresh identity; the Continue Watching
 * migration decides there is nothing to adopt.
 *
 * The filter previously matched `macha.` and missed every hyphenated key,
 * including the client id. These tests exist so that cannot recur quietly:
 * they are driven by core's own registry rather than by a list copied here,
 * so a key added in a later release fails this suite instead of failing on a
 * television.
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
    // Named explicitly because matching only one of these was the defect.
    expect(shouldHydrate('macha.session.v1')).toBe(true);
    expect(shouldHydrate('macha-client-id')).toBe(true);
  });

  it('loads the keys core reads only to migrate from', () => {
    // Read when the current key is empty and deliberately never deleted. Unread
    // on a cold start, adoption does not happen and resume positions are lost
    // with nothing to attribute it to.
    expect(shouldHydrate('macha-client-progress:some-client-id')).toBe(true);
    expect(shouldHydrate('macha-server-url')).toBe(true);
  });

  it('loads this client\'s own keys, which core\'s registry does not cover', () => {
    // `isMachaStorageKey` answers "is this one of core's" and returns false
    // here, which is why the filter is not delegated to it.
    expect(shouldHydrate('macha-playback-failure-trail-v1')).toBe(true);
  });

  it('does not load keys belonging to anything else', () => {
    expect(shouldHydrate('expo-splash')).toBe(false);
    expect(shouldHydrate('RCTAsyncLocalStorage')).toBe(false);
    expect(shouldHydrate('')).toBe(false);
  });
});
