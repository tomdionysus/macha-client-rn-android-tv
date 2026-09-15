import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StorageLike } from '@machafoundation/core';

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

/**
 * Which keys the startup hydrate must load.
 *
 * **Both of core's conventions, deliberately.** Core names state stores with a
 * dotted `macha.<name>.v<n>` and its runtime and cluster layers with a
 * hyphenated `macha-<name>`; `MACHA_STORAGE_KEY_PREFIXES` lists both. This
 * filter was `macha.` alone, which is one convention exactly and the other not
 * at all — the same filter, and the same fault, core's `storageKeys.ts`
 * attributes to the phone client.
 *
 * **What it cost here is worse than a missing value.** `macha-client-id` is
 * hyphenated, so it was written on every launch and never read back;
 * `MachaClientConfiguration.clientId()` cannot tell an unhydrated key from an
 * absent one and mints a fresh id. Every per-client store — Continue Watching,
 * volume, playlists, the playback queue — is keyed `…v1.<clientId>`, so those
 * keys hydrated correctly and were then read under an identity that changed
 * every cold start. The endpoint registry, the bandwidth evidence the routing
 * cascade ranks on, and this client's own failure-trail setting went the same
 * way.
 *
 * **A caching host has an obligation a read-through host does not.** Core's
 * `StorageLike` is synchronous, so on React Native the store must be hydrated
 * into memory before core reads anything — and core's read-time migrations
 * (`macha-client-progress:` adopted when the current Continue Watching key is
 * empty, `macha-server-url` folded into the endpoint list) ask for keys that
 * a narrow filter never loaded. Core reads `null` and concludes "absent", so
 * the migration silently does not run. Anything core may read has to be here,
 * not merely anything core currently writes.
 *
 * `isMachaStorageKey` is not sufficient on its own: it answers "is this one of
 * core's", and `macha-playback-failure-trail-v1` is ours. Matching the bare
 * word covers both conventions, every key either side owns, and any key added
 * later — which is the point, since the failure mode is silent.
 */
const KEY_PREFIX = 'macha';

/** Exported for the test that pins this against core's own registry. */
export function shouldHydrate(key: string): boolean {
  return key.startsWith(KEY_PREFIX);
}

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
    const keys = (await AsyncStorage.getAllKeys()).filter(shouldHydrate);
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
