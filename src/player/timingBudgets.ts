import { SERVER_SEGMENT_HOLD_MS, type PlaybackSource } from '@machafoundation/core';

/**
 * The timing budgets this client chooses, in one place, with what each is
 * calibrated against.
 *
 * They are declared here rather than only at their use sites so the
 * relationships between them can be asserted by a test. Four separate bugs in
 * this project have been two independently-chosen timeouts colliding, and the
 * pattern core uses for its own budgets is to guard the *relationship* rather
 * than the number — a test pinning `7000` fails when someone deliberately
 * retunes it, whereas a test pinning "longer than the server's hold" fails
 * only when someone breaks it.
 *
 * The Kotlin side holds its own copies of the two player-facing numbers, since
 * it cannot import this. `timingBudgets.test.ts` reads them back out of
 * `PlayerEngine.kt` and asserts they still agree, so the duplication cannot
 * drift silently.
 */

/**
 * Re-exported from core, which now owns it.
 *
 * It is the server's `streaming.segment_timeout` and every client is calibrated
 * against it, so it was never ours to declare — it briefly lived here only
 * because core had no home for it. Core's docblock carries the reasoning and
 * one qualification worth repeating: **it is the server's default, not a
 * negotiated value.** No node reports its real figure at runtime, so treat it
 * as a floor to stay above with margin, never a number to match.
 */
export { SERVER_SEGMENT_HOLD_MS };

/**
 * The read deadline for a fragment request, in `PlayerEngine.kt`.
 *
 * Must clear the hold: a held request sends no bytes, so a deadline below it
 * means the client aborts first and takes its timeout path — which looks like
 * a network fault and fails over a node that was working correctly and about
 * to deliver.
 */
export const FRAGMENT_READ_TIMEOUT_MS = 15_000;

/** First retry delay after a hold, in `PlayerEngine.kt`. */
export const HOLD_RETRY_BASE_MS = 1_000;

/** Ceiling of the exponential backoff after a hold, in `PlayerEngine.kt`. */
export const HOLD_RETRY_CEILING_MS = 8_000;

/**
 * How long a node is given to produce the first fragment of a fresh
 * generation before the wait becomes evidence against it.
 *
 * Generous deliberately, and expressed as a multiple of the hold rather than
 * as a round number. A `500 segment_not_ready` is the node stating it is
 * already working on a fragment it promised; abandoning it costs more than
 * waiting does, because the replacement node starts its own generation from
 * nothing and the viewer waits out a cold start instead of the tail of a warm
 * one. Five holds is long enough for a node at its production frontier and
 * short enough that a genuinely dead one is still caught.
 *
 * **It is deliberately larger than `MEDIA_START_STARVATION_MS` (20 s), and
 * that is only safe because of where it runs.** The wait happens in
 * `ExpoVideoAdapter.play()` *before* the start watchdog is armed, so the two
 * budgets never overlap: the watchdog measures "no bytes ever arrived after
 * the player was given the source", which cannot begin until this has
 * finished. Arming the watchdog first and then waiting here would have the
 * watchdog fire at 20 s and report a spurious `stream` failure against a node
 * that was behaving exactly as the protocol says it should — which is the
 * precise bug this walk exists to remove, reintroduced by ordering.
 */
export const FIRST_FRAGMENT_TIMEOUT_MS = SERVER_SEGMENT_HOLD_MS * 5;

/**
 * How long to spend acquiring a source from **this** node before the wait
 * becomes evidence against it.
 *
 * `FIRST_FRAGMENT_TIMEOUT_MS` above is a figure this client chose from the one
 * server constant it could see, and it applies to every node identically —
 * which was the only option until core 0.14.0. A node now states its own on
 * `PlaybackSource.budgets.deadlineMs`, derived from that node's
 * `startup_timeout_ms` plus core's allowance for the distance to it, and core
 * is explicit that **a host must not shorten it on its own authority**: of two
 * deadlines the shorter silently wins and the other layer then looks broken.
 *
 * So a stated figure is taken whole, including when it is *shorter* than the
 * local constant. Preferring the larger of the two would be this client
 * overriding the node on the one question the node is the authority for, and
 * would keep a viewer in front of a node core has already decided is worth
 * leaving. The constant is what a node that cannot say gets, and a node that
 * cannot say is not a node that needs less time.
 *
 * The ordering invariant is unaffected either way, because it is structural
 * rather than numeric: this wait completes before the start watchdog is armed.
 */
export function firstFragmentTimeoutMs(source?: PlaybackSource): number {
  const stated = source?.budgets?.deadlineMs;
  if (stated === undefined || !Number.isFinite(stated) || stated <= 0) {
    return FIRST_FRAGMENT_TIMEOUT_MS;
  }
  return stated;
}
