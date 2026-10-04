import {
  generationAttemptBudgetMs,
  SERVER_SEGMENT_HOLD_MS,
  type PlaybackSource,
} from '@machafoundation/core';

/**
 * This client's timing budgets, each with what it is calibrated against.
 * `timingBudgets.test.ts` asserts the relationships between them, not the
 * values, and that `PlayerEngine.kt`'s copies of the player-facing ones agree.
 */

/**
 * Core's: the server's default `streaming.segment_timeout`. No node reports
 * its real figure, so stay above it with margin (asserted).
 */
export { SERVER_SEGMENT_HOLD_MS };

/**
 * Fragment read deadline, in `PlayerEngine.kt`. Must exceed the server's hold:
 * a held request sends no bytes, and timing out first fails over a healthy node.
 */
export const FRAGMENT_READ_TIMEOUT_MS = 15_000;

/** First retry delay after a hold, in `PlayerEngine.kt`. */
export const HOLD_RETRY_BASE_MS = 1_000;

/** Ceiling of the exponential backoff after a hold, in `PlayerEngine.kt`. */
export const HOLD_RETRY_CEILING_MS = 8_000;

/**
 * How long a node has to produce the first fragment of a fresh generation.
 * Core's `generationAttemptBudgetMs()`: the node's `startup_timeout_ms` plus
 * core's network allowance (asserted). The wait runs in
 * `ExpoVideoAdapter.play()` before the start watchdog is armed, so it never
 * overlaps `MEDIA_START_STARVATION_MS`.
 */
export const FIRST_FRAGMENT_TIMEOUT_MS = generationAttemptBudgetMs();

/**
 * The first-fragment budget for this node: its own
 * `PlaybackSource.budgets.deadlineMs` when stated, taken whole even if
 * shorter, else `FIRST_FRAGMENT_TIMEOUT_MS`. A host must not shorten either.
 */
export function firstFragmentTimeoutMs(source?: PlaybackSource): number {
  const stated = source?.budgets?.deadlineMs;
  if (stated === undefined || !Number.isFinite(stated) || stated <= 0) {
    return FIRST_FRAGMENT_TIMEOUT_MS;
  }
  return stated;
}

/**
 * How often a resume point is written during playback: the most progress a
 * killed process may lose. A chosen bound (asserted), calibrated against
 * nothing the server states; the guarded relationship is with the tick below.
 * Do not tie it to core's `SERVER_SESSION_IDLE_MS`: that is the server's
 * default, not what a node states.
 * Spent by core's `progressWriteDue`.
 */
export const CONTINUE_WATCHING_WRITE_INTERVAL_MS = 5 * 60_000;

/**
 * How often the write interval is evaluated, alongside every snapshot. A write
 * lands within one tick of its due time, so this stays well under the interval.
 */
export const CONTINUE_WATCHING_TICK_MS = 30_000;

/**
 * How long a mid-film rebuffer runs before the spinner shows. The web client's
 * `playerSeekSpinnerDelayMs`. Must stay under core's `MEDIA_STALL_TIMEOUT_MS`
 * (7 s) so the spinner is up before a stall is called.
 */
export const REBUFFER_SPINNER_DELAY_MS = 3_000;

/**
 * How long a start runs before the viewer is told it is taking a while. The
 * web client's `playerStartWaitNoticeMs`. Above an ordinary start, below
 * `FIRST_FRAGMENT_TIMEOUT_MS`.
 */
export const START_WAIT_NOTICE_MS = 5_000;

/**
 * How long Back from Home waits for queued storage writes
 * (`src/app/appExit.ts`). Asserted, not measured: a bound on a stuck write.
 * Must stay under `ANDROID_KEY_DISPATCH_TIMEOUT_MS`.
 */
export const EXIT_FLUSH_BUDGET_MS = 2_000;

/**
 * Android's input-dispatch timeout: 5 s in AOSP's `InputDispatcher` (asserted
 * from documentation, not measured). The yardstick for an unanswered press.
 */
export const ANDROID_KEY_DISPATCH_TIMEOUT_MS = 5_000;
