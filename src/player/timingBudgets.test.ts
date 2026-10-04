import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BROKEN_GENERATION_STATUS,
  generationAttemptBudgetMs,
  MEDIA_STALL_TIMEOUT_MS,
  SEGMENT_NOT_READY_STATUS,
  SOURCE_NOT_FOUND_STATUS,
  SOURCE_SUPERSEDED_STATUS,
  playbackFailureKindForStatus,
  type PlaybackSource,
} from '@machafoundation/core';
import {
  CONTINUE_WATCHING_TICK_MS,
  CONTINUE_WATCHING_WRITE_INTERVAL_MS,
  FIRST_FRAGMENT_TIMEOUT_MS,
  FRAGMENT_READ_TIMEOUT_MS,
  firstFragmentTimeoutMs,
  HOLD_RETRY_BASE_MS,
  HOLD_RETRY_CEILING_MS,
  REBUFFER_SPINNER_DELAY_MS,
  SERVER_SEGMENT_HOLD_MS,
  START_WAIT_NOTICE_MS,
} from './timingBudgets';

/** These assert relationships, never values, so a deliberate retune passes and a wrong one fails. */
describe('timing budgets against the server segment hold', () => {
  it('waits longer for a fragment than the node may hold it', () => {
    // A held request sends no bytes: a deadline at or below the hold aborts a working node.
    expect(FRAGMENT_READ_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
  });

  it("calls a stall only after the node has failed to answer its own hold", () => {
    // Core's constant, guarded from the consumer side too.
    expect(MEDIA_STALL_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
  });

  it('does not retry a hold sooner than a hold costs', () => {
    // Retrying faster than the node can produce is only load.
    expect(HOLD_RETRY_BASE_MS).toBeGreaterThanOrEqual(1_000);
    expect(HOLD_RETRY_CEILING_MS).toBeGreaterThan(HOLD_RETRY_BASE_MS);
  });

  it('keeps the retry ceiling inside the read deadline', () => {
    // A backoff longer than the deadline it retries within can never complete.
    expect(HOLD_RETRY_CEILING_MS).toBeLessThan(FRAGMENT_READ_TIMEOUT_MS);
  });
});

/** Kotlin cannot import the TypeScript constants and holds copies; this reads them back from the source. */
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
    // The calibration must be stated beside the number.
    expect(engine).toMatch(/segment hold/i);
    expect(engine).toContain(String(SERVER_SEGMENT_HOLD_MS));
  });
});

/** Core owns when to stop acquiring a source: this client neither overrules a stated deadline nor goes without one. */
describe('the acquisition deadline a node states for itself', () => {
  const withBudgets = (deadlineMs: number): PlaybackSource => ({
    mediaId: 'macha:one',
    url: 'https://node-a.test/generation/index.m3u8',
    isManifest: true,
    mode: 'remux',
    budgets: { deadlineMs, segmentHoldMs: SERVER_SEGMENT_HOLD_MS },
  } as PlaybackSource);

  it('takes the node at its word even when that is less time than the default', () => {
    // Preferring the larger would overrule the node on the question it is the authority for.
    const shorter = FIRST_FRAGMENT_TIMEOUT_MS - SERVER_SEGMENT_HOLD_MS;
    expect(firstFragmentTimeoutMs(withBudgets(shorter))).toBe(shorter);
  });

  it('takes a longer stated deadline whole as well', () => {
    const longer = FIRST_FRAGMENT_TIMEOUT_MS + SERVER_SEGMENT_HOLD_MS;
    expect(firstFragmentTimeoutMs(withBudgets(longer))).toBe(longer);
  });

  it('gives a node that cannot say the full local budget, never a shorter one', () => {
    // A node that cannot state a deadline does not need less time.
    expect(firstFragmentTimeoutMs(undefined)).toBe(FIRST_FRAGMENT_TIMEOUT_MS);
    expect(firstFragmentTimeoutMs(withBudgets(0))).toBe(FIRST_FRAGMENT_TIMEOUT_MS);
    expect(firstFragmentTimeoutMs(withBudgets(Number.NaN))).toBe(FIRST_FRAGMENT_TIMEOUT_MS);
  });

  it('still clears the hold it must outlast, for a node that cannot say', () => {
    // Waiting less than a hold aborts a node that is answering correctly.
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
  });

  it('is core\'s figure for a node that cannot state one, not a local multiple', () => {
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBe(generationAttemptBudgetMs());
  });
});

/**
 * media3's `LoadErrorHandlingPolicy` decides retries inside the loader, on a
 * thread that cannot call JavaScript, so the "hold status means retry the same
 * node" rule exists in Kotlin as well as core. This asserts the copy agrees.
 */
describe('the unavoidable Kotlin copy of the hold rule', () => {
  const engine = readFileSync(
    join(__dirname, '..', '..', 'modules', 'macha-player', 'android', 'src', 'main', 'java',
      'foundation', 'macha', 'player', 'PlayerEngine.kt'),
    'utf8',
  );

  it('retries on exactly the status core calls a hold', () => {
    const match = engine.match(/responseCode == (\d{3})/);
    expect(match?.[1], 'PlayerEngine.kt should key its hold retry on a status').toBeDefined();
    const kotlinHoldStatus = Number(match![1]);

    expect(playbackFailureKindForStatus(kotlinHoldStatus)).toBe('not-ready');
    // And it is the status core names: the test imports what Kotlin cannot.
    expect(kotlinHoldStatus).toBe(SEGMENT_NOT_READY_STATUS);
  });

  it('does not treat the terminal statuses as holds', () => {
    // A retry arm on `SOURCE_SUPERSEDED_STATUS` would retry a superseded
    // generation until the loader gave up.
    for (const status of [
      BROKEN_GENERATION_STATUS,
      SOURCE_NOT_FOUND_STATUS,
      SOURCE_SUPERSEDED_STATUS,
    ]) {
      expect(playbackFailureKindForStatus(status)).not.toBe('not-ready');
      expect(engine).not.toMatch(new RegExp(`responseCode == ${status}`));
    }
  });

  it('keeps the two terminal statuses saying different things about the node', () => {
    // A `503` is endpoint evidence; a `404` is one session's existence and must
    // not cost the node. `ExpoVideoAdapter.nodeWillServe` depends on the difference.
    expect(playbackFailureKindForStatus(BROKEN_GENERATION_STATUS)).toBe('stream');
    expect(playbackFailureKindForStatus(SOURCE_NOT_FOUND_STATUS)).toBe('not-found');
  });

  it('inherits the superseded-generation tolerance from core rather than branching locally', () => {
    // Core answers `410 generation_superseded` as `not-found`: the object is
    // gone, the node is fine. `ExoPlayerAdapter.ts` hands core the raw status,
    // so this client inherits that.
    expect(playbackFailureKindForStatus(SOURCE_SUPERSEDED_STATUS)).toBe('not-found');

    // As relationships: a `410` agrees with a `404` and differs from a `503`.
    expect(playbackFailureKindForStatus(SOURCE_SUPERSEDED_STATUS)).toBe(
      playbackFailureKindForStatus(SOURCE_NOT_FOUND_STATUS),
    );
    expect(playbackFailureKindForStatus(SOURCE_SUPERSEDED_STATUS)).not.toBe(
      playbackFailureKindForStatus(BROKEN_GENERATION_STATUS),
    );
  });

  it('maps no statuses to kinds in Kotlin', () => {
    // The mapping is core's.
    expect(engine).not.toContain('"not-ready"');
  });
});

/** Both figures are choices; these pin what a careless change would break. */
describe('the resume-point cadence', () => {
  const timingBudgetsSource = readFileSync(join(__dirname, 'timingBudgets.ts'), 'utf8');

  it('is not tied to anything the server states', () => {
    // The server's session idle figure is a default a node may override
    // (`macha-ts` `src/playback/streamProtocol.ts`), so the interval must be
    // arithmetic on literals. Asserted on the declaration, because the
    // docblock names the server constant.
    const declaration = /export const CONTINUE_WATCHING_WRITE_INTERVAL_MS = ([^;]+);/
      .exec(timingBudgetsSource)?.[1];
    expect(declaration).toBeDefined();
    expect(declaration).toMatch(/^[\d_\s*+]+$/);
  });

  it('evaluates the interval far more often than the interval itself', () => {
    // A write lands within one tick of being due, so the tick stays well under the interval.
    expect(CONTINUE_WATCHING_TICK_MS).toBeLessThan(CONTINUE_WATCHING_WRITE_INTERVAL_MS);
    expect(CONTINUE_WATCHING_WRITE_INTERVAL_MS / CONTINUE_WATCHING_TICK_MS).toBeGreaterThanOrEqual(4);
  });

  it('does not tick faster than the stall watchdog it shares a device with', () => {
    // A cost coupling: this timer runs for the whole of every film, on a set
    // whose load average reaches 30 (measured).
    expect(CONTINUE_WATCHING_TICK_MS).toBeGreaterThanOrEqual(MEDIA_STALL_TIMEOUT_MS);
  });
});

describe('what the viewer is shown while waiting', () => {
  it('raises the rebuffer spinner before a stall is called', () => {
    expect(REBUFFER_SPINNER_DELAY_MS).toBeLessThan(MEDIA_STALL_TIMEOUT_MS);
  });

  it("tells the viewer a start is slow before one node's attempt runs out", () => {
    expect(START_WAIT_NOTICE_MS).toBeLessThan(FIRST_FRAGMENT_TIMEOUT_MS);
  });
});
