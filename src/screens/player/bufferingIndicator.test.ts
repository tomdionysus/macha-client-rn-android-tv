import { describe, expect, it } from 'vitest';
import type { PlaybackCoordinatorSnapshot } from '@machafoundation/core';
import { REBUFFER_SPINNER_DELAY_MS, START_WAIT_NOTICE_MS } from '../../player/timingBudgets';
import { bufferingDelayMs, showsBuffering, startWaitNotice } from './bufferingIndicator';

function snapshot(overrides: { starting?: boolean; buffering?: boolean; fatalError?: Error }): PlaybackCoordinatorSnapshot {
  return {
    starting: overrides.starting ?? false,
    event: { positionMs: 0, durationMs: 0, paused: false, ended: false, buffering: overrides.buffering ?? false },
    ...(overrides.fatalError ? { fatalError: overrides.fatalError } : {}),
  } as unknown as PlaybackCoordinatorSnapshot;
}

describe('the player spinner', () => {
  it('shows through a start and through a rebuffer', () => {
    expect(showsBuffering(snapshot({ starting: true }))).toBe(true);
    expect(showsBuffering(snapshot({ buffering: true }))).toBe(true);
    expect(showsBuffering(snapshot({}))).toBe(false);
    expect(showsBuffering(undefined)).toBe(false);
  });

  it('never shows over a failure, which has its own screen', () => {
    expect(showsBuffering(snapshot({ starting: true, fatalError: new Error('x') }))).toBe(false);
  });

  it('shows at once for a start and after a pause for a rebuffer', () => {
    expect(bufferingDelayMs(true)).toBe(0);
    expect(bufferingDelayMs(false)).toBe(REBUFFER_SPINNER_DELAY_MS);
  });

  it('says how long a start is taking only once it is slow, and never for a rebuffer', () => {
    expect(startWaitNotice(true, START_WAIT_NOTICE_MS - 1)).toBeUndefined();
    expect(startWaitNotice(true, 7_400)).toBe('Waiting for the node to start the stream — 7s');
    expect(startWaitNotice(false, 60_000)).toBeUndefined();
  });
});
