import type { StorageLike } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * The playback sessions this install has open, written down so they survive the
 * process that opened them.
 *
 * **Why this exists.** A session outlives the death of the process that created
 * it: `terminateForPageExit` only runs on a clean exit, so a crash, an OOM kill,
 * or `com.tcl.esticker` taking the foreground leaves the node holding a live
 * session. Measured on the TCL set: an orphaned transcode holds that node's
 * single video slot and refuses the next viewer.
 *
 * **Why the client owns this half and not the reclaim itself.** From outside,
 * this install cannot tell its own orphan from another device's live session on
 * the same account — `GET /api/v1/playback/sessions` lists the account's, and
 * closing the wrong one kills someone else's film. The discriminator is the id
 * core already mints and hands over, `${endpoint.id}::${nodeSessionId}`
 * (`macha-ts` `ClusterPlaybackResolver.ts`). Core reconciles that list against
 * each node and closes what is still there; it cannot store it, because core
 * dies with the process too. **Durable storage is the one thing only the host
 * has.**
 *
 * **Two behaviours, not one, and the second is the easy one to get wrong.** The
 * kill case is why this exists: a process that dies without reporting
 * `undefined` leaves its id on disk, and that is what the next run hands over.
 * The quieter case is a **regenerate or failover**, where core replaces one
 * generation with another under a new id and closes the one it superseded — so
 * the record must drop the old id as the new one arrives, or it accumulates
 * handles to sessions that are already gone and asks core to reconcile noise.
 *
 * **The handback is not wired.** Core owes the reconcile call;
 * `orphanedSessions()` is what it takes and `forgetSessions()` is what clears
 * the ones it closed. Recording runs regardless, because the list has to
 * pre-date the crash it describes.
 */
const KEY = 'macha-playback-live-sessions-v1';

/**
 * Bounded, so a reconcile that never arrives cannot grow this without end.
 *
 * **A sanity limit, not a derived truth, and the difference matters.** The
 * figure is the server's `max_sessions_per_account` off `GET /api/v1/status`
 * (measured: 32 on every node), but that cap is counted **per node** (asserted
 * by the server), so an install holding sessions on several nodes could
 * legitimately have more than 32 ids outstanding. This client plays one thing
 * at a time, so it cannot come near either number; the bound only stops an
 * unreconciled record growing forever, and nothing follows from hitting it.
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
