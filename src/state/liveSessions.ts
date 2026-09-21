import type { StorageLike } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * The playback sessions this install has open, written down so they survive the
 * process that opened them.
 *
 * **Why this exists.** A session outlives the death of the process that created
 * it: `terminateForPageExit` only runs on a clean exit, so a crash, an OOM kill,
 * or `com.tcl.esticker` taking the foreground leaves the node holding a live
 * session. Measured on the television 2026-09-21 — ten left open in one
 * afternoon, one of them a transcode holding that node's single video slot and
 * refusing the next viewer until it was deleted by hand.
 *
 * **Why the client owns this half and not the reclaim itself.** From outside,
 * this install cannot tell its own orphan from another device's live session on
 * the same account — `GET /api/v1/playback/sessions` lists the account's, and
 * closing the wrong one kills someone else's film. The discriminator is the id
 * core already mints and hands over, `${endpoint.id}::${nodeSessionId}`
 * (`ClusterPlaybackResolver.ts:767`). Core reconciles that list against each
 * node and closes what is still there; it cannot store it, because core dies
 * with the process too. **Durable storage is the one thing only the host has.**
 * Core's design, put to this session 2026-09-21 after Tom ruled out doing
 * nothing — "We can't lock people out for 30m."
 *
 * **The handback is not wired, and this is inert until it is.** Core owes the
 * reconcile call; when it lands, `orphanedSessions()` is what it takes and
 * `forgetSessions()` is what clears the ones it closed. Recording starts now
 * regardless, because the list has to pre-date the crash it describes — a
 * record written after the fact would describe nothing.
 */
const KEY = 'macha-playback-live-sessions-v1';

/**
 * Bounded, so a reconcile that never arrives cannot grow this without end.
 *
 * At the account cap: a list longer than the sessions an account may hold is
 * describing something that cannot be true, and the oldest entries are the
 * least likely to still be live. This is not a timing budget — it is the
 * server's own `max_sessions_per_account`, read off `GET /api/v1/status` on all
 * three nodes on 2026-09-21. If it stops matching, it is this that is wrong.
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
    // Unreadable is the same as absent: the worst case is a session we do not
    // close, which is where we already are without this.
    return [];
  }
}

function write(storage: StorageLike, ids: readonly string[]): void {
  if (ids.length === 0) storage.removeItem(KEY);
  else storage.setItem(KEY, JSON.stringify(ids.slice(-MAX_REMEMBERED)));
}

/**
 * The state this module keeps beyond storage: which id is live *now*.
 *
 * Held rather than re-derived because a lifecycle update reports the current
 * session, not the transition — knowing the previous one is what lets a
 * regenerate (new id) drop the id it replaced.
 */
let current: string | undefined;

/**
 * Whatever was left behind by a previous run, captured before this one writes.
 *
 * Read once, on the first call, because after that the list is a mixture of the
 * previous run's leftovers and this run's live session, and only the former are
 * candidates to close.
 */
let carried: readonly string[] | undefined;

export interface LiveSessionStore {
  storage?: StorageLike;
}

/**
 * The ids a previous run did not close. Safe to call more than once.
 *
 * Call after `hydrateStorage()`: before that the cache is empty and this would
 * report no orphans rather than an unknown answer.
 */
export function orphanedSessions({ storage = nativeStorage }: LiveSessionStore = {}): readonly string[] {
  if (carried === undefined) carried = read(storage);
  return carried;
}

/**
 * Follow the runtime's current session, remembering it and dropping the last.
 *
 * `undefined` means nothing is playing, which is the clean-exit case: the id is
 * forgotten because core has closed it. A *different* id means a regenerate or
 * a failover, where the one it replaced is likewise core's to have closed.
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
