import { SERVER_SEGMENT_HOLD_MS } from '@macha/core';

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
