import { describe, expect, it } from 'vitest';
import type { MediaSummary, PlaybackCoordinatorSnapshot } from '@machafoundation/core';
import { attributableProgress } from './progressAttribution';

const episode = (id: string) => ({ id, title: id, kind: 'episode' }) as unknown as MediaSummary;

function snapshot(sessionMediaId: string | undefined, positionMs: number): PlaybackCoordinatorSnapshot {
  return {
    intent: { positionMs, paused: false },
    event: { positionMs, durationMs: 2_600_000 },
    session: sessionMediaId ? { mediaId: sessionMediaId } : undefined,
    starting: false,
    preparingSource: false,
  } as unknown as PlaybackCoordinatorSnapshot;
}

/**
 * Measured on `.133` 2026-09-24: next from *Our Mrs. Reynolds* at 29:31, then
 * previous, resumed it at 0:16. Between the switch and React's next render the
 * route still named the old episode while the player reported the new one near
 * 0, and a write in that gap stored 0 under the old episode, which core then
 * drops (nothing below 30 s is kept) — erasing the place.
 */
describe('attributableProgress', () => {
  it('attributes the position to the episode actually playing', () => {
    expect(attributableProgress(snapshot('e03', 1_771_000), episode('e03'))?.positionMs).toBe(1_771_000);
  });

  it('writes nothing when the player is on a different episode from the route', () => {
    expect(attributableProgress(snapshot('e04', 9_000), episode('e03'))).toBeUndefined();
  });

  it('writes nothing before the new generation has a session to name its media', () => {
    expect(attributableProgress(snapshot(undefined, 0), episode('e03'))).toBeUndefined();
  });
});
