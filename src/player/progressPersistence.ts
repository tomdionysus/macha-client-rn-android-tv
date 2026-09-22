/**
 * When a resume point is owed to storage.
 *
 * **The record has to be on disk before it is needed, because nothing runs
 * afterwards.** Measured on `10.35.1.133`, 2026-09-22 20:42:15: the set
 * replaced Android System WebView and force-stopped this app at `adj 0` — in
 * the foreground, mid-use — and `ApplicationExitInfo` recorded
 * `reason=10 (USER REQUESTED)`, not a crash. A kill of that shape runs no
 * teardown at all: no `stop`, no unmount, no final write. Until this existed,
 * the only write was in `closePlayer`, so a viewer killed an hour into a film
 * resumed it from wherever they last pressed Back — which on a first viewing is
 * the beginning.
 *
 * `usePlaybackRuntime` already makes this argument for the live-session record,
 * in the same words: *what survives a kill is what was live when the process
 * died.* This is the same rule applied to the viewer's place in the film rather
 * than to the node's session.
 *
 * Separated from the hook so it can be tested without a renderer, which is how
 * the rest of this client tests its logic.
 *
 * **DELETE THIS FILE when core publishes the rule.** It is dependency-free —
 * two booleans, a duration and a clock — and every client that resumes playback
 * wants it, so by Tom's rule it belongs upstream. It is local only because core
 * has no home for it yet: core owns the *store* (`ContinueWatchingStore`,
 * `progressFor`) and nothing owns the *cadence*.
 *
 * Put to the session that owns `macha-ts` on 2026-09-22, with this shape and
 * the reasoning above, and asked for a TODO and the version it lands in. When
 * that version is published: replace `progressWriteDue` with core's, delete
 * this file and its test, and keep the hook — the timer, the playback
 * subscription and the app-scope placement are platform and stay here. Until
 * then, **do not let the two drift**: a change to the rule here is a change
 * owed upstream, not a local fix.
 *
 * `CONTINUE_WATCHING_WRITE_INTERVAL_MS` in `timingBudgets.ts` may or may not
 * come back with it — core may take an opinion on the cadence or leave it a
 * parameter. Either is fine; what must not survive is two implementations of
 * the decision.
 */

/** Why a write is owed, kept for the trail rather than for the store. */
export type ProgressWrite = 'paused' | 'interval';

export interface ProgressWatermark {
  /** Whether playback was paused when the last decision was taken. */
  paused: boolean;
  /** When a record was last *stored*, on the same clock as `nowMs`. */
  wroteAtMs: number;
  /**
   * When a write was last *attempted*, stored or declined.
   *
   * Separate from `wroteAtMs` because a declined write deliberately does not
   * advance that one, and without this the retry would fire on every snapshot
   * — 4 Hz, per `ExpoVideoAdapter`'s `timeUpdateEventInterval` — for the whole
   * of the first 30 s of every film.
   */
  attemptedAtMs: number;
}

export function progressWriteDue(
  previous: ProgressWatermark,
  current: { paused: boolean; durationMs: number } | undefined,
  nowMs: number,
  intervalMs: number,
  /** Floor between attempts, so a declined write retries on the tick, not at 4 Hz. */
  minAttemptGapMs: number,
): ProgressWrite | undefined {
  // No playback is the clean stop, and it is not a moment to record anything:
  // whoever stopped has already written, and the last event's position would
  // be stamped over it after the viewer left.
  if (!current) return undefined;
  // The guard `closePlayer` has always applied. A zero duration makes the
  // progress fraction meaningless and renders in Continue Watching as an entry
  // with no position at all.
  if (current.durationMs <= 0) return undefined;

  // The edge, not the state. Held paused, position is not advancing, so further
  // writes record nothing new — and this store is backed by AsyncStorage, where
  // a write per playback event is churn on a device that is doing nothing.
  if (current.paused) return previous.paused ? undefined : 'paused';

  // Both must hold: due by the interval since the last *stored* record, and not
  // attempted within the floor. The pause edge above is deliberately exempt —
  // that is a thing the viewer did once, not a timer.
  if (nowMs - previous.wroteAtMs < intervalMs) return undefined;
  return nowMs - previous.attemptedAtMs >= minAttemptGapMs ? 'interval' : undefined;
}

/**
 * Where the watermark lands after an attempted write.
 *
 * **A write that core declined is not a write**, and treating it as one is the
 * bug this function exists to prevent. `ContinueWatchingStore.update` stores
 * nothing for an entry below its own minimum — 30 s of position, so that a film
 * someone opened and left is not offered back to them as unfinished business —
 * and it says so by returning a list the entry is absent from, not by throwing.
 *
 * Advancing the clock on a declined write pushes the next attempt a full
 * interval away, which left a real hole: the first write of a film lands at a
 * second or two, is declined, and nothing is then written until five minutes
 * in. **Measured on the set 2026-09-22** — a film killed at about seventy
 * seconds recorded nothing at all, which is the exact case this feature was
 * built for. Leaving the clock where it was makes the next tick try again, and
 * the attempt after the minimum is the one that sticks.
 *
 * The minimum itself is core's and is deliberately not mirrored here: this
 * reads the outcome rather than re-deriving the rule, so a change to core's
 * floor needs no change here. Same argument as the interval not being anchored
 * to a server figure.
 */
export function nextWatermark(
  previous: ProgressWatermark,
  paused: boolean,
  nowMs: number,
  landed: boolean,
): ProgressWatermark {
  return {
    paused,
    wroteAtMs: landed ? nowMs : previous.wroteAtMs,
    // Always, landed or not. If a declined attempt did not record itself the
    // floor would do nothing and the next snapshot would retry immediately.
    attemptedAtMs: nowMs,
  };
}
