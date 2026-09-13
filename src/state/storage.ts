import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageLike } from '@macha/core';

/**
 * `AsyncStorage` behind the core's synchronous `StorageLike`.
 *
 * The core's storage interface is synchronous by design — making it async
 * would push `await` into every state read in the core, most of which sit on
 * paths that must not yield — so the bridge belongs here. This is the shape
 * documented in `macha-ts/docs/async-storage.md` and already device-validated
 * in the phone client: hydrate once at startup, read from memory, write
 * through a serialized chain.
 */

const KEY_PREFIX = 'macha.';

let cache = new Map<string, string>();
let hydrated = false;

/**
 * Writes are chained rather than issued concurrently.
 *
 * Two `setItem` calls for one key racing to the device can land in the wrong
 * order, and the losing value is the one that survives the restart. Chaining
 * costs nothing at this write frequency and removes the reordering entirely.
 */
let writes: Promise<unknown> = Promise.resolve();

export async function hydrateStorage(): Promise<void> {
  if (hydrated) return;
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(KEY_PREFIX));
    const entries = keys.length > 0 ? await AsyncStorage.multiGet(keys) : [];
    cache = new Map(entries.filter((entry): entry is [string, string] => entry[1] !== null));
  } catch {
    // A failed hydrate is a cold start with no remembered state, which is a
    // usable app. Failing to start because Continue Watching is unreadable
    // would not be.
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
