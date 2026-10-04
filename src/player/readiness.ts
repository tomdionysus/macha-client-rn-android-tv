import { probeHlsReadiness, type PlaybackSource } from '@machafoundation/core';
import {
  firstFragmentTimeoutMs,
  HOLD_RETRY_BASE_MS,
  HOLD_RETRY_CEILING_MS,
} from './timingBudgets';

/**
 * Wait for a node to serve the first fragment before the player gets the URL.
 * `500 segment_not_ready` means a healthy node is still producing it; failing
 * over would only cold-start the next node, and `expo-video`'s loader cannot
 * be made to retry the same one. The walk is core's (`probeHlsReadiness`);
 * only the retry budget is here.
 */

export interface FirstFragmentReadiness {
  ready: boolean;
  /** Why not, as the node stated it. */
  reason?: string;
  /** The node's HTTP status, if it answered; the caller maps it with core's `playbackFailureKindForStatus`. */
  status?: number;
  waitedMs: number;
  attempts: number;
}

/**
 * The delay before asking again when the node did not state one: exponential
 * from the base to the ceiling. `attempts` counts those already made.
 */
export function holdBackoffMs(attempts: number): number {
  const grown = HOLD_RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1);
  return Math.min(grown, HOLD_RETRY_CEILING_MS);
}

/**
 * How long to wait before asking this node again: the node's stated hold
 * (`Retry-After`, via core), else the backoff. Core does not bound the stated
 * value, so it is clamped to the ceiling here; exceeding the deadline instead
 * would abandon the node.
 */
export function holdWaitMs(statedMs: number | undefined, attempts: number): number {
  if (statedMs === undefined || !Number.isFinite(statedMs) || statedMs < 0) {
    return holdBackoffMs(attempts);
  }
  return Math.min(statedMs, HOLD_RETRY_CEILING_MS);
}

/**
 * Hold a manifest source until the node serves its first fragment or the
 * budget runs out. Returns rather than throws; the caller reports a refusal.
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
    // The node's stated deadline, else this client's; see `firstFragmentTimeoutMs`.
    timeoutMs = firstFragmentTimeoutMs(source),
    superseded = () => false,
  } = options;

  const started = now();
  const deadline = started + timeoutMs;
  // Bounds all attempts together; core's deadline is per request only.
  const controller = new AbortController();
  const expiry = setTimeout(() => controller.abort(), timeoutMs);

  let attempts = 0;
  let reason = 'superseded before the node was asked';
  let status: number | undefined;
  try {
    while (!superseded()) {
      attempts += 1;
      const outcome = await probeHlsReadiness(source, {
        fetch: fetchImpl,
        signal: controller.signal,
      });

      if (outcome.state === 'ready') return { ready: true, waitedMs: now() - started, attempts };

      // `unassessable` is not a failure: the walk had nothing to measure, so
      // the source goes to the player.
      if (outcome.state === 'unassessable') {
        return { ready: true, waitedMs: now() - started, attempts };
      }

      if (outcome.state === 'unavailable') {
        // `detail` is the transport error when there was no response.
        status = outcome.status;
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
    return { ready: false, reason, status, waitedMs: now() - started, attempts };
  } finally {
    clearTimeout(expiry);
  }
}
