import {
  generationAttemptBudgetMs,
  SERVER_SEGMENT_HOLD_MS,
  type PlaybackSource,
} from '@machafoundation/core';

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
 * **Core's figure, for a node that cannot state its own** (Tom, 2026-09-19).
 * `generationAttemptBudgetMs()` is the same question answered from the server's
 * numbers rather than from this client's reasoning: the node's
 * `startup_timeout_ms` — what it is entitled to spend bringing a stream up —
 * plus core's allowance for the distance to it.
 *
 * *It was `SERVER_SEGMENT_HOLD_MS * 5` until then, and the five was mine.* The
 * argument was sound and the authority was not: a `500 segment_not_ready` is
 * the node stating it is already working on a fragment it promised, abandoning
 * it costs a cold start on a node that does not have it either, so the budget
 * should be generous — but "five holds" was a multiple chosen because the hold
 * was the only server figure a client could see. Now a node states the figure
 * that actually bounds it, and a client that keeps its own multiple is
 * overruling the node with arithmetic.
 *
 * **Its relationship to `MEDIA_START_STARVATION_MS` (20 s) is not what makes
 * it safe — where it runs is.** The wait happens in
 * `ExpoVideoAdapter.play()` *before* the start watchdog is armed, so the two
 * budgets never overlap: the watchdog measures "no bytes ever arrived after
 * the player was given the source", which cannot begin until this has
 * finished. Arming the watchdog first and then waiting here would have the
 * watchdog fire at 20 s and report a spurious `stream` failure against a node
 * that was behaving exactly as the protocol says it should — which is the
 * precise bug this walk exists to remove, reintroduced by ordering.
 */
export const FIRST_FRAGMENT_TIMEOUT_MS = generationAttemptBudgetMs();

/**
 * How long to spend acquiring a source from **this** node before the wait
 * becomes evidence against it.
 *
 * Both branches are core's now. A node states its own on
 * `PlaybackSource.budgets.deadlineMs`, and a node that cannot gets
 * `generationAttemptBudgetMs()` — the same derivation against the server's
 * published defaults. Core is explicit that **a host must not shorten either on
 * its own authority**: of two deadlines the shorter silently wins and the other
 * layer then looks broken.
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
