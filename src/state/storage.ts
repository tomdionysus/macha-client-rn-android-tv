import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageLike } from '@machafoundation/core';

/**
 * `AsyncStorage` behind core's synchronous `StorageLike`, as in
 * `macha-ts/docs/async-storage.md`: hydrate once at startup, read from memory,
 * write through a serialized chain.
 */

/**
 * Which keys the startup hydrate loads: every key core may read, including
 * ones it only migrates from, plus this client's own. Core reads an unhydrated
 * key as absent, so a miss fails silently (`macha-client-id` would be re-minted
 * every cold start). The bare word covers core's dotted and hyphenated
 * conventions; `isMachaStorageKey` would miss this client's keys.
 */
const KEY_PREFIX = 'macha';

/** Exported for the test that pins this against core's own registry. */
export function shouldHydrate(key: string): boolean {
  return key.startsWith(KEY_PREFIX);
}

let cache = new Map<string, string>();
let hydrated = false;

/** Chained: two concurrent `setItem` calls for one key can land out of order. */
let writes: Promise<unknown> = Promise.resolve();

export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(shouldHydrate);
    const entries = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
    cache = new Map(entries.filter((entry): entry is [string, string] => entry[1] !== null));
  } catch {
    // A failed hydrate is a cold start with no remembered state.
    cache = new Map();
  }
  hydrated = true;
}

export const nativeStorage: StorageLike = {
  getItem: (key) => cache.get(key) ?? null,
  setItem: (key, value) => {
    cache.set(key, value);
    writes = writes.then(() => AsyncStorage.setItem(key, value)).catch(() => undefined);
  },
  removeItem: (key) => {
    cache.delete(key);
    writes = writes.then(() => AsyncStorage.removeItem(key)).catch(() => undefined);
  },
};

/** Resolves once every queued write has reached the device. For app exit and tests. */
export function flushStorage(): Promise<unknown> {
  return writes;
}
