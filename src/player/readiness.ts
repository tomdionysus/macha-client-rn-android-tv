import { probeHlsReadiness, type PlaybackSource } from '@machafoundation/core';
import {
  FIRST_FRAGMENT_TIMEOUT_MS,
  HOLD_RETRY_BASE_MS,
  HOLD_RETRY_CEILING_MS,
} from './timingBudgets';

/**
 * Wait for a node to actually serve the first fragment, instead of failing
 * over the moment it says it is still producing one.
 *
 * **This is the single largest thing lost when playback moved to
 * `expo-video`.** `PlayerEngine.kt:450` retried an HTTP `500` on the *same*
 * node with exponential backoff, because core's protocol is explicit that
 * `500 segment_not_ready` is the node stating it has not produced this
 * fragment yet and is working correctly. Failing over cannot help: the next
 * node is producing a *different* generation and does not have that fragment
 * either, so it cold-starts and answers the same way. Three of those exhaust
 * a healthy cluster in seconds.
 *
 * `expo-video` builds its own `OkHttpDataSource.Factory` internally with no
 * injection point, so there is no way to reach into its loader and reinstate
 * the rule. The remaining option is to ask the question ourselves, before the
 * player is ever handed the URL.
 *
 * **The walk itself is core's** (`probeHlsReadiness`), and only the retry
 * policy is here. That split is deliberate and was agreed with the core
 * session rather than assumed: what a `500` *means*, how deep to descend and
 * which URI a tag carries are protocol and vary by nothing, while how long
 * this particular client is willing to wait in front of this particular
 * viewer is a budget and belongs to the client. This file briefly contained
 * its own copy of the descent; core absorbed it, along with the same walk
 * from the web client, so there is now one implementation instead of three.
 */

export interface FirstFragmentReadiness {
  ready: boolean;
  /** Why not, in the terms the node stated it. */
  reason?: string;
  waitedMs: number;
  attempts: number;
}

/**
 * The delay before asking again, when the node did not say.
 *
 * Exponential from the declared base to the declared ceiling. `attempts` is
 * the number already made, so the first wait is the base.
 */
export function holdBackoffMs(attempts: number): number {
  const grown = HOLD_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(grown, HOLD_RETRY_CEILING_MS);
}

/**
 * How long to wait before asking this node again.
 *
 * Core's `holding` carries the node's own `Retry-After` where it sent one,
 * falling back to `SERVER_SEGMENT_HOLD_MS`. It is honoured because the node
 * knows what it is doing better than a backoff curve does — **but core does
 * not bound it**, and a node stating `Retry-After: 9999` would otherwise park
 * playback for the rest of the budget on one header. Clamped here rather than
 * left to the deadline check, because hitting the deadline abandons the node
 * whereas clamping keeps asking it.
 */
export function holdWaitMs(statedMs: number | undefined, attempts: number): number {
  if (statedMs === undefined || !Number.isFinite(statedMs) || statedMs < 0) {
    return holdBackoffMs(attempts);
  }
  return Math.min(statedMs, HOLD_RETRY_CEILING_MS);
}

/**
 * Hold a manifest source until the node will serve its first fragment, or
 * until waiting has itself become the evidence.
 *
 * Returns rather than throws: the caller decides what a refusal means, and on
 * this client that decision is core's to make through the failure channel.
 */
export async function awaitFirstFragment(
  source: PlaybackSource,
  options: {
    fetchImpl?: typeof fetch;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    timeoutMs?: number;
    /** Abandons the wait when a later generation has taken over. */
    superseded?: () => boolean;
  } = {},
): Promise<FirstFragmentReadiness> {
  const {
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms: number) => new Promise<void>((resolve) => { setTimeout(resolve, ms); }),
    timeoutMs = FIRST_FRAGMENT_TIMEOUT_MS,
    superseded = () => false,
  } = options;

  const started = now();
  const deadline = started + timeoutMs;
  // One controller for the whole sequence of attempts. Core applies its own
  // per-request deadline inside each walk (`HLS_WALK_TIMEOUT_MS`, which it
  // keeps above the server's hold); this one bounds the total, or a node
  // could hold every attempt right up to core's deadline and never exceed
  // ours.
  const controller = new AbortController();
  const expiry = setTimeout(() => controller.abort(), timeoutMs);

  let attempts = 0;
  let reason = 'superseded before the node was asked';
  try {
    while (!superseded()) {
      attempts += 1;
      const outcome = await probeHlsReadiness(source, {
        fetch: fetchImpl,
        signal: controller.signal,
      });

      if (outcome.state === 'ready') return { ready: true, waitedMs: now() - started, attempts };

      // Not a judgement. Core is explicit that `unassessable` must not be
      // treated as a failure — it means this walk had nothing to measure, not
      // that the node refused — so the source goes to the player rather than
      // being condemned on a question that was never answered.
      if (outcome.state === 'unassessable') {
        return { ready: true, waitedMs: now() - started, attempts };
      }

      if (outcome.state === 'unavailable') {
        // `detail` carries the thrown transport message where there was no
        // response at all, and it is the line that makes the on-screen
        // failure trail worth having: without it every transport fault reads
        // as "the node did not answer", which cannot be told apart from a
        // node that answered badly. Core added it at this client's request.
        reason = outcome.status !== undefined
          ? `the node answered ${outcome.status}`
          : outcome.detail ?? 'the node did not answer';
        break;
      }

      reason = 'the node is still producing the first fragment';
      const retryMs = holdWaitMs(outcome.retryAfterMs, attempts);
      if (now() + retryMs >= deadline) {
        reason = `${reason} after ${Math.round((now() - started) / 1_000)}s`;
        break;
      }
      await sleep(retryMs);
    }
    return { ready: false, reason, waitedMs: now() - started, attempts };
  } finally {
    clearTimeout(expiry);
  }
}
