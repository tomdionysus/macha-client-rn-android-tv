import type { StorageLike } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * The playback sessions this install has open, persisted so the next run can
 * hand them to core to close. A process killed without `terminateForPageExit`
 * leaves its session holding the node's single video slot (measured on the TCL
 * set). The ids (`${endpoint.id}::${nodeSessionId}`, from `macha-ts`
 * `ClusterPlaybackResolver.ts`) are what tell this install's orphan from
 * another device's live session on the same account.
 *
 * Core's reconcile call is not wired yet: it takes `orphanedSessions()` and
 * clears with `forgetSessions()`.
 */
const KEY = 'macha-playback-live-sessions-v1';

/**
 * Stops an unreconciled record growing without end. The server's
 * `max_sessions_per_account` (measured: 32 on every node), which is per node
 * (asserted), so this is a sanity limit and not a true ceiling.
 */
const MAX_REMEMBERED = 32;

function read(storage: StorageLike): string[] {
  const raw = storage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    // Unreadable is the same as absent.
    return [];
  }
}

function write(storage: StorageLike, ids: readonly string[]): void {
  if (ids.length === 0) storage.removeItem(KEY);
  else storage.setItem(KEY, JSON.stringify(ids.slice(-MAX_REMEMBERED)));
}

/**
 * The id live now. A lifecycle update reports only the current session, so
 * this is what lets a regenerate drop the id it replaced.
 */
let current: string | undefined;

/** What a previous run left behind, read once before this run writes. */
let carried: readonly string[] | undefined;

export interface LiveSessionStore {
  storage?: StorageLike;
}

/** The ids a previous run did not close. Call after `hydrateStorage()`; before it this reports none. */
export function orphanedSessions({ storage = nativeStorage }: LiveSessionStore = {}): readonly string[] {
  if (carried === undefined) carried = read(storage);
  return carried;
}

/**
 * Follow the runtime's current session. `undefined` (clean stop) or a different
 * id (regenerate, failover) drops the previous id: core has closed it.
 */
export function trackLiveSession(
  sessionId: string | undefined,
  { storage = nativeStorage }: LiveSessionStore = {},
): void {
  if (sessionId === current) return;
  const previous = current;
  current = sessionId;

  const ids = read(storage).filter((id) => id !== previous && id !== sessionId);
  if (sessionId !== undefined) ids.push(sessionId);
  write(storage, ids);
}

/** Drop ids a reconcile has dealt with. Anything not named is left alone. */
export function forgetSessions(
  closed: readonly string[],
  { storage = nativeStorage }: LiveSessionStore = {},
): void {
  const gone = new Set(closed);
  write(storage, read(storage).filter((id) => !gone.has(id)));
  if (carried !== undefined) carried = carried.filter((id) => !gone.has(id));
}

/** Test seam: forget what this module is holding between cases. */
export function resetLiveSessionTracking(): void {
  current = undefined;
  carried = undefined;
}
