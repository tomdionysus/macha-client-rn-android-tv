import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BROKEN_GENERATION_STATUS,
  MEDIA_STALL_TIMEOUT_MS,
  SEGMENT_NOT_READY_STATUS,
  SOURCE_NOT_FOUND_STATUS,
  playbackFailureKindForStatus,
  type PlaybackSource,
} from '@machafoundation/core';
import {
  FIRST_FRAGMENT_TIMEOUT_MS,
  FRAGMENT_READ_TIMEOUT_MS,
  firstFragmentTimeoutMs,
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
 * Which deadline applies to acquiring a source, now that nodes state their own.
 *
 * The division core draws is that it owns *when to stop* and this client owns
 * *what happens until then*. These assert this client's side of that line: it
 * does not overrule a stated figure, and it does not go without one when the
 * node cannot say.
 */
describe('the acquisition deadline a node states for itself', () => {
  const withBudgets = (deadlineMs: number): PlaybackSource => ({
    mediaId: 'macha:one',
    url: 'https://node-a.test/generation/index.m3u8',
    isManifest: true,
    mode: 'remux',
    budgets: { deadlineMs, segmentHoldMs: SERVER_SEGMENT_HOLD_MS },
  } as PlaybackSource);

  it('takes the node at its word even when that is less time than the default', () => {
    // The trap core names: of two deadlines the shorter silently wins and the
    // other layer looks broken. Preferring the larger would be this client
    // overruling the node on the one question the node is the authority for,
    // and would hold a viewer in front of a node core has decided to leave.
    const shorter = FIRST_FRAGMENT_TIMEOUT_MS - SERVER_SEGMENT_HOLD_MS;
    expect(firstFragmentTimeoutMs(withBudgets(shorter))).toBe(shorter);
  });

  it('takes a longer stated deadline whole as well', () => {
    const longer = FIRST_FRAGMENT_TIMEOUT_MS + SERVER_SEGMENT_HOLD_MS;
    expect(firstFragmentTimeoutMs(withBudgets(longer))).toBe(longer);
  });

  it('gives a node that cannot say the full local budget, never a shorter one', () => {
    // A node that cannot state a deadline is not a node that needs less time,
    // and budgeting under the real figure is the failure this exists to stop.
    expect(firstFragmentTimeoutMs(undefined)).toBe(FIRST_FRAGMENT_TIMEOUT_MS);
    expect(firstFragmentTimeoutMs(withBudgets(0))).toBe(FIRST_FRAGMENT_TIMEOUT_MS);
    expect(firstFragmentTimeoutMs(withBudgets(Number.NaN))).toBe(FIRST_FRAGMENT_TIMEOUT_MS);
  });

  it('still clears the hold it must outlast, for a node that cannot say', () => {
    // The original relationship, unchanged: waiting less than a hold reports a
    // node answering the protocol correctly as a fault.
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
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
    // And it is the status core names, not merely one core happens to call a
    // hold: the Kotlin literal cannot import this, so the test does the
    // importing.
    expect(kotlinHoldStatus).toBe(SEGMENT_NOT_READY_STATUS);
  });

  it('does not treat the terminal statuses as holds', () => {
    // The statuses themselves come from core now. They were written here as
    // literals, which made this test a second copy of the thing it was guarding
    // — core 0.14.0 exports them precisely because adapters were restating them
    // (four copies of one server fact, by its count).
    for (const status of [BROKEN_GENERATION_STATUS, SOURCE_NOT_FOUND_STATUS]) {
      expect(playbackFailureKindForStatus(status)).not.toBe('not-ready');
      expect(engine).not.toMatch(new RegExp(`responseCode == ${status}`));
    }
  });

  it('keeps the two terminal statuses saying different things about the node', () => {
    // This asserted `stream` for both until core 0.13.0, and the pair being
    // indistinguishable was the defect: a `503` is a broken generation and
    // endpoint evidence, while a `404` is one session's existence and must
    // never cost the node that answered it honestly its place in the candidate
    // list. `ExpoVideoAdapter.nodeWillServe` is the consumer that depends on
    // the difference.
    expect(playbackFailureKindForStatus(BROKEN_GENERATION_STATUS)).toBe('stream');
    expect(playbackFailureKindForStatus(SOURCE_NOT_FOUND_STATUS)).toBe('not-found');
  });

  it('no longer maps statuses to kinds in Kotlin', () => {
    // The mapping moved to core. If these strings come back, protocol knowledge
    // has leaked into the platform layer again.
    expect(engine).not.toContain('"not-ready"');
  });
});
