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
 * Which deadline applies to acquiring a source, when a node may state its own.
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
    // Waiting less than a hold aborts mid-hold and reports a node answering
    // the protocol correctly as a fault.
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS);
  });

  it('is core\'s figure for a node that cannot state one, not a local multiple', () => {
    // Core answers the question from the server's own numbers; a local
    // multiple of the hold would have no authority beside it.
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBe(generationAttemptBudgetMs());
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
 * Everything else is core's: the native side reports the raw status and the
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
    // The statuses come from core, so this test is not a second copy of the
    // thing it guards. A Kotlin retry arm on `SOURCE_SUPERSEDED_STATUS` would
    // retry a generation this node has already superseded until the loader
    // gave up.
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
    // A `503` is a broken generation and endpoint evidence, while a `404` is
    // one session's existence and must never cost the node that answered it
    // honestly its place in the candidate list. `ExpoVideoAdapter.nodeWillServe`
    // is the consumer that depends on the difference.
    expect(playbackFailureKindForStatus(BROKEN_GENERATION_STATUS)).toBe('stream');
    expect(playbackFailureKindForStatus(SOURCE_NOT_FOUND_STATUS)).toBe('not-found');
  });

  it('inherits the superseded-generation tolerance from core rather than branching locally', () => {
    // Core answers `410 generation_superseded` as `not-found` deliberately
    // rather than as a kind of its own: what a host must do is identical — the
    // object is gone, the node is fine, re-read the session — and a kind no
    // host handles would be read as unhandled and condemn a healthy node.
    //
    // This client inherits that because `ExoPlayerAdapter.ts` hands core the
    // raw status instead of classifying locally; this assertion keeps it so.
    expect(playbackFailureKindForStatus(SOURCE_SUPERSEDED_STATUS)).toBe('not-found');

    // Stated as relationships, because the values are core's to choose: a `410`
    // must agree with a `404` and differ from a `503`. Both of the first two
    // mean one object is gone and neither may cost the node that answered
    // honestly its place in the candidate list; a `503` is endpoint evidence
    // and must. `ExpoVideoAdapter.nodeWillServe` is the consumer that depends
    // on the difference.
    expect(playbackFailureKindForStatus(SOURCE_SUPERSEDED_STATUS)).toBe(
      playbackFailureKindForStatus(SOURCE_NOT_FOUND_STATUS),
    );
    expect(playbackFailureKindForStatus(SOURCE_SUPERSEDED_STATUS)).not.toBe(
      playbackFailureKindForStatus(BROKEN_GENERATION_STATUS),
    );
  });

  it('maps no statuses to kinds in Kotlin', () => {
    // The mapping is core's. If these strings appear, protocol knowledge has
    // leaked into the platform layer.
    expect(engine).not.toContain('"not-ready"');
  });
});

/**
 * The resume-point cadence, as relationships rather than as numbers.
 *
 * Both figures are choices — the five-minute interval and the tick that evaluates it
 * — so what is pinned here is what would actually be broken by changing them
 * carelessly, not the values themselves.
 */
describe('the resume-point cadence', () => {
  const timingBudgetsSource = readFileSync(join(__dirname, 'timingBudgets.ts'), 'utf8');

  it('is not tied to anything the server states', () => {
    // `SERVER_SESSION_IDLE_MS` is the server's *default*, a node states its
    // own, and core says never to let correctness depend on it
    // (`macha-ts` `src/playback/streamProtocol.ts`). And this interval alone
    // bounds what a kill discards, whether the node reaps at thirty minutes or
    // never. Guarded as an absence: the budget must stay a plain number, not a
    // function of a server figure.
    // Asserted on the declaration rather than on the file: the docblock names
    // the constant in order to say why it is not used, and a test that forbade
    // the word would forbid the explanation. What must hold is that the value
    // is arithmetic on literals — derived from nothing the wire can move.
    const declaration = /export const CONTINUE_WATCHING_WRITE_INTERVAL_MS = ([^;]+);/
      .exec(timingBudgetsSource)?.[1];
    expect(declaration).toBeDefined();
    expect(declaration).toMatch(/^[\d_\s*+]+$/);
  });

  it('evaluates the interval far more often than the interval itself', () => {
    // The tick is granularity: a write lands within one tick of being due, so a
    // tick at or above the interval would double the worst-case loss while
    // looking like it had changed nothing.
    expect(CONTINUE_WATCHING_TICK_MS).toBeLessThan(CONTINUE_WATCHING_WRITE_INTERVAL_MS);
    expect(CONTINUE_WATCHING_WRITE_INTERVAL_MS / CONTINUE_WATCHING_TICK_MS).toBeGreaterThanOrEqual(4);
  });

  it('does not tick faster than the stall watchdog it shares a device with', () => {
    // Not a correctness coupling, a cost one: this timer runs for the whole of
    // every film on a television whose load average can reach 30 (measured).
    // It has no business being the busiest thing in the app.
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
