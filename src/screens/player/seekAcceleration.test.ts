import { describe, expect, it } from 'vitest';
import {
  accelerateSeek,
  SEEK_HOLD_RELEASE_MS,
  SEEK_LADDER_MS,
  SEEK_RUNG_ADVANCE_MS,
  seekLadderStepMs,
  type SeekHold,
} from './seekAcceleration';

/**
 * Ported with the implementation, so the two TV clients cannot drift on the
 * numbers a viewer feels. The same reason `tvFocus.test.ts` pins the focus
 * weights: the requirement is that this behaves like the web TV client, and a
 * ladder that differs by a rung is a different remote in the hand.
 */
describe('seek acceleration', () => {
  it('starts at one second so a single tap is a nudge, not a jump', () => {
    expect(seekLadderStepMs(0)).toBe(1_000);
    expect(accelerateSeek(undefined, 1, 1_000).deltaMs).toBe(1_000);
    expect(accelerateSeek(undefined, -1, 1_000).deltaMs).toBe(-1_000);
  });

  it('climbs one rung per hold interval and stops at the top of the ladder', () => {
    for (const [rung, step] of SEEK_LADDER_MS.entries()) {
      expect(seekLadderStepMs(rung * SEEK_RUNG_ADVANCE_MS)).toBe(step);
    }
    // Held far beyond the ladder: the largest step, not an ever-growing one.
    expect(seekLadderStepMs(SEEK_RUNG_ADVANCE_MS * 500)).toBe(SEEK_LADDER_MS[SEEK_LADDER_MS.length - 1]);
  });

  it('accelerates across a sustained hold, measuring elapsed time not event count', () => {
    let hold: SeekHold | undefined;
    const steps: number[] = [];
    // A TV repeating every 100ms: the ladder must still climb on the clock.
    for (let now = 0; now <= 1_800; now += 100) {
      const result = accelerateSeek(hold, 1, now);
      hold = result.hold;
      steps.push(result.deltaMs);
    }
    const first = steps[0]!;
    const last = steps[steps.length - 1]!;
    expect(first).toBe(1_000);
    expect(last).toBe(seekLadderStepMs(1_800));
    expect(last).toBeGreaterThan(first);
    // Monotonic: a hold never gets slower while it is being held.
    for (let index = 1; index < steps.length; index += 1) {
      expect(steps[index]!).toBeGreaterThanOrEqual(steps[index - 1]!);
    }
  });

  /** Auto-repeat: events every 100ms, as a held remote key actually delivers them. */
  function hold(direction: 1 | -1, durationMs: number, from: SeekHold | undefined = undefined, startAtMs = 0) {
    let current = from;
    let deltaMs = 0;
    for (let now = startAtMs; now <= startAtMs + durationMs; now += 100) {
      const result = accelerateSeek(current, direction, now);
      current = result.hold;
      deltaMs = result.deltaMs;
    }
    return { hold: current as SeekHold, deltaMs };
  }

  it('restarts at one second after a real pause between presses', () => {
    const held = hold(1, SEEK_RUNG_ADVANCE_MS * 4);
    expect(held.deltaMs).toBeGreaterThan(1_000);

    // Released and pressed again: a fresh search, not a continuation.
    const afterRelease = accelerateSeek(held.hold, 1, held.hold.lastEventAtMs + SEEK_HOLD_RELEASE_MS + 1);
    expect(afterRelease.deltaMs).toBe(1_000);
  });

  it('treats auto-repeat as one continuous hold across the release threshold', () => {
    const first = accelerateSeek(undefined, 1, 0);
    const repeated = accelerateSeek(first.hold, 1, SEEK_HOLD_RELEASE_MS);
    expect(repeated.hold.startedAtMs).toBe(0);
  });

  it('restarts the ladder when the viewer reverses direction', () => {
    const fast = hold(1, SEEK_RUNG_ADVANCE_MS * 5);
    expect(fast.deltaMs).toBeGreaterThan(10_000);

    // Overshot and coming back: at minutes per press this would be unusable.
    const reversed = accelerateSeek(fast.hold, -1, fast.hold.lastEventAtMs + 100);
    expect(reversed.deltaMs).toBe(-1_000);
    expect(reversed.hold.startedAtMs).toBe(fast.hold.lastEventAtMs + 100);
  });
});
