import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEDIA_STALL_TIMEOUT_MS, playbackFailureKindForStatus } from '@machafoundation/core';
import {
  FRAGMENT_READ_TIMEOUT_MS,
  HOLD_RETRY_BASE_MS,
  HOLD_RETRY_CEILING_MS,
  SERVER_SEGMENT_HOLD_MS,
} from './timingBudgets';

/**
 * These assert *relationships*, never values.
 *
 * A test pinning `15000` fails the moment someone deliberately retunes the
 * read deadline, which teaches people to update the number and move on. A test
 * pinning "must clear the server's hold" fails only when the retune is wrong,
 * which is the failure worth having. This is the pattern core uses to guard
 * `MEDIA_STALL_TIMEOUT_MS` against the same server constant.
 */
describe('timing budgets against the server segment hold', () => {
  it('waits longer for a fragment than the node may hold it', () => {
    // A held request sends no bytes. A deadline at or below the hold aborts
    // mid-hold and reports a working node as a network fault.
    expect(FRAGMENT_READ_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
  });

  it("calls a stall only after the node has failed to answer its own hold", () => {
    // Core's constant, guarded here from the consumer side too: below the hold
    // the watchdog can expire while a node is mid-hold and about to deliver.
    expect(MEDIA_STALL_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
  });

  it('does not retry a hold sooner than a hold costs', () => {
    // Retrying faster than the node can produce is pure load on a node that
    // already waited six seconds before answering.
    expect(HOLD_RETRY_BASE_MS).toBeGreaterThanOrEqual(1_000);
    expect(HOLD_RETRY_CEILING_MS).toBeGreaterThan(HOLD_RETRY_BASE_MS);
  });

  it('keeps the retry ceiling inside the read deadline', () => {
    // A backoff longer than the deadline it retries within can never complete.
    expect(HOLD_RETRY_CEILING_MS).toBeLessThan(FRAGMENT_READ_TIMEOUT_MS);
  });
});

/**
 * The Kotlin side cannot import the TypeScript constants, so it holds its own
 * copies. Duplication is fine; *silent* duplication is not — this reads the
 * real values back out of the source and fails if the two ever disagree.
 */
describe('Kotlin player engine agrees with the declared budgets', () => {
  const engine = readFileSync(
    join(__dirname, '..', '..', 'modules', 'macha-player', 'android', 'src', 'main', 'java',
      'foundation', 'macha', 'player', 'PlayerEngine.kt'),
    'utf8',
  );

  function kotlinInt(declaration: string): number {
    const match = engine.match(new RegExp(`${declaration}\\s*=\\s*([0-9_]+)`));
    if (!match?.[1]) throw new Error(`could not find ${declaration} in PlayerEngine.kt`);
    return Number(match[1].replace(/_/g, ''));
  }

  it('uses the declared fragment read timeout', () => {
    expect(kotlinInt('private val readTimeoutMs')).toBe(FRAGMENT_READ_TIMEOUT_MS);
  });

  it('documents what the read timeout is calibrated against', () => {
    // The number alone is not the point — the reasoning has to travel with it,
    // or the next person retunes it against a round number instead of the hold.
    expect(engine).toMatch(/segment hold/i);
    expect(engine).toContain(String(SERVER_SEGMENT_HOLD_MS));
  });
});

/**
 * The one protocol duplication that cannot be removed.
 *
 * media3's `LoadErrorHandlingPolicy` decides whether to retry *inside the
 * loader*, synchronously, on a thread that cannot call into JavaScript. So the
 * "a 500 is a hold, retry the same node" rule has to exist in Kotlin as well as
 * in core, and no amount of restructuring changes that.
 *
 * Everything else moved: the native side now reports the raw status and the
 * adapter applies `playbackFailureKindForStatus`. This asserts the residue
 * still agrees with core, so if core ever reassigns the hold status the Kotlin
 * copy fails loudly rather than silently retrying the wrong thing.
 */
describe('the unavoidable Kotlin copy of the hold rule', () => {
  const engine = readFileSync(
    join(__dirname, '..', '..', 'modules', 'macha-player', 'android', 'src', 'main', 'java',
      'foundation', 'macha', 'player', 'PlayerEngine.kt'),
    'utf8',
  );

  it('retries on exactly the status core calls a hold', () => {
    // Find the status the retry policy keys on.
    const match = engine.match(/responseCode == (\d{3})/);
    expect(match?.[1], 'PlayerEngine.kt should key its hold retry on a status').toBeDefined();
    const kotlinHoldStatus = Number(match![1]);

    expect(playbackFailureKindForStatus(kotlinHoldStatus)).toBe('not-ready');
  });

  it('does not treat the terminal statuses as holds', () => {
    for (const status of [503, 404]) {
      expect(playbackFailureKindForStatus(status)).toBe('stream');
      expect(engine).not.toMatch(new RegExp(`responseCode == ${status}`));
    }
  });

  it('no longer maps statuses to kinds in Kotlin', () => {
    // The mapping moved to core. If these strings come back, protocol knowledge
    // has leaked into the platform layer again.
    expect(engine).not.toContain('"not-ready"');
  });
});
