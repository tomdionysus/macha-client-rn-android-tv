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
 * relationships between them can be asserted by a test: two independently
 * chosen timeouts can collide, so the test guards the *relationship* rather
 * than the number. A test pinning `7000` fails when someone deliberately
 * retunes it, whereas a test pinning "longer than the server's hold" fails
 * only when someone breaks it.
 *
 * The Kotlin side holds its own copies of the two player-facing numbers, since
 * it cannot import this. `timingBudgets.test.ts` reads them back out of
 * `PlayerEngine.kt` and asserts they still agree, so the duplication cannot
 * drift silently.
 */

/**
 * Re-exported from core, which owns it: the server's
 * `streaming.segment_timeout`, which every client is calibrated against.
 * **It is the server's default, not a negotiated value.** No node reports its
 * real figure at runtime, so treat it as a floor to stay above with margin,
 * never a number to match.
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
 * **Core's figure, for a node that cannot state its own.**
 * `generationAttemptBudgetMs()` answers from the server's numbers rather than
 * from this client's reasoning: the node's `startup_timeout_ms` — what it is
 * entitled to spend bringing a stream up — plus core's allowance for the
 * distance to it. A client that applied its own multiple of the hold instead
 * would be overruling the node with arithmetic.
 *
 * **Its relationship to `MEDIA_START_STARVATION_MS` (20 s) is not what makes
 * it safe — where it runs is.** The wait happens in
 * `ExpoVideoAdapter.play()` *before* the start watchdog is armed, so the two
 * budgets never overlap: the watchdog measures "no bytes ever arrived after
 * the player was given the source", which cannot begin until this has
 * finished. Arming the watchdog first and then waiting here would have the
 * watchdog fire at 20 s and report a spurious `stream` failure against a node
 * that was behaving exactly as the protocol says it should.
 */
export const FIRST_FRAGMENT_TIMEOUT_MS = generationAttemptBudgetMs();

/**
 * How long to spend acquiring a source from **this** node before the wait
 * becomes evidence against it.
 *
 * Both branches are core's. A node states its own on
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

/**
 * How often a resume point is written while a film is playing.
 *
 * A chosen bound on loss rather than a deadline: nothing goes wrong when it
 * elapses, and what it buys is that a process killed without warning discards
 * at most one interval — plus one tick — of the viewer's place. Such kills
 * happen (measured: a system WebView update force-stopped this app in the
 * foreground with no teardown of any kind). The rule that spends this interval
 * is core's `progressWriteDue`.
 *
 * **It is deliberately not calibrated against anything the server states, and
 * `SERVER_SESSION_IDLE_MS` in particular.** Core documents that constant
 * (`macha-ts` `src/playback/streamProtocol.ts`) as the server's default, which
 * a node may override, and says never to let correctness depend on it. Nor
 * would a relationship do any work: the stored position is stale by at most
 * one interval whether the node reaps a session at thirty minutes, at five, or
 * never. Session reaping is the node reclaiming a transcode slot; this is the
 * device surviving a process kill.
 *
 * So the question it answers is how much progress a viewer may lose, and that
 * has no counterpart in the protocol. The relationships worth guarding are with
 * the tick below, and those are what the test asserts.
 */
export const CONTINUE_WATCHING_WRITE_INTERVAL_MS = 5 * 60_000;

/**
 * How often that interval is *evaluated*.
 *
 * The interval cannot be its own timer. A pause has to be recorded when it
 * happens rather than up to five minutes later, and playback snapshots alone
 * cannot be relied on to arrive while a film simply plays — so the decision is
 * re-taken on this tick as well as on every snapshot, and
 * `progressWriteDue` decides. Granularity, therefore: the write lands within
 * one tick of its due time, which is why this must stay well under the
 * interval it measures.
 */
export const CONTINUE_WATCHING_TICK_MS = 30_000;

/**
 * How long a rebuffer mid-film runs before the spinner shows. The web
 * client's `playerSeekSpinnerDelayMs`, unchanged, so the two clients hesitate
 * alike.
 *
 * A presentation delay: a brief hesitation has the picture behind it to say
 * what is going on, and a spinner over every one would be noise. The
 * relationship worth guarding is with core's `MEDIA_STALL_TIMEOUT_MS` (7 s):
 * the spinner must be up before a stall is called, or a viewer sees a frozen
 * picture turn straight into a failover with nothing in between.
 */
export const REBUFFER_SPINNER_DELAY_MS = 3_000;

/**
 * How long a start runs before the viewer is told how long it is taking. The
 * web client's `playerStartWaitNoticeMs`, unchanged.
 *
 * Above an ordinary start, so the sentence does not flash on every title, and
 * below the budget that bounds one node's attempt (`FIRST_FRAGMENT_TIMEOUT_MS`,
 * core's generation budget), so a viewer waiting on a cold node hears about it
 * before the client gives that node up — the guarded relationship.
 */
export const START_WAIT_NOTICE_MS = 5_000;

/**
 * How long Back from Home waits for queued storage writes before leaving
 * anyway (`src/app/appExit.ts`).
 *
 * **Not calibrated against a measurement.** Nobody has timed an AsyncStorage
 * write on either set, so this is a bound on a stuck write, not a figure the
 * write is known to need: an ordinary queue of one or two small values is
 * expected to drain far inside it (asserted, not measured). The relationship
 * guarded is with `ANDROID_KEY_DISPATCH_TIMEOUT_MS`: a viewer who pressed Back
 * and saw nothing happen for longer than Android lets an app ignore a key
 * would reasonably take the app for hung.
 */
export const EXIT_FLUSH_BUDGET_MS = 2_000;

/**
 * Android's input-dispatch timeout, after which it reports an app as not
 * responding to a key. The platform's figure (5 s in AOSP's
 * `InputDispatcher`), asserted from its documentation and not read off either
 * set. The exit wait is asynchronous and cannot itself trigger it; it is the
 * yardstick for how long a press may go unanswered.
 */
export const ANDROID_KEY_DISPATCH_TIMEOUT_MS = 5_000;
