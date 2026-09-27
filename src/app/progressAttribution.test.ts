import { describe, expect, it } from 'vitest';
import type { MediaSummary, PlaybackCoordinatorSnapshot } from '@machafoundation/core';
import { attributableProgress } from './progressAttribution';

const episode = (id: string) => ({ id, title: id, kind: 'episode' }) as unknown as MediaSummary;

function snapshot(sessionMediaId: string | undefined, positionMs: number): PlaybackCoordinatorSnapshot {
  return {
    intent: { positionMs, paused: false },
    event: { positionMs, durationMs: 2_600_000 },
    session: sessionMediaId ? { mediaId: sessionMediaId, preferences: { mode: 'direct', maxHeight: null, maxBitrate: null, audioStream: 1, subtitleStream: null, audioLanguage: '', subtitleLanguage: '' } } : undefined,
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

/**
 * Since server 0.58.0 a session names the *file* it plays (`mediaId:
 * "macha:…"`) and the item separately (`itemId`). Matching the file against the
 * item's id recorded nothing: measured on `.133` 2026-09-27, *The Martian*
 * watched to 1:24 and closed never reached Continue Watching.
 */
describe('a session that names its file', () => {
  const film = { id: 'tmdb:movie:286217', kind: 'movie', title: 'The Martian', mediaIds: ['macha:uhd', 'macha:hd'] } as unknown as MediaSummary;
  const session = (mediaId: string, itemId?: string) =>
    ({
      intent: { positionMs: 84_000, paused: false },
      event: { positionMs: 84_000, durationMs: 9_080_000 },
      session: { mediaId, ...(itemId ? { itemId } : {}), preferences: { mode: 'direct', maxHeight: null, maxBitrate: null, audioStream: 1, subtitleStream: null, audioLanguage: '', subtitleLanguage: '' } },
      starting: false,
      preparingSource: false,
    }) as unknown as PlaybackCoordinatorSnapshot;

  it("records it under the item the session names, with the file it played", () => {
    const progress = attributableProgress(session('macha:hd', 'tmdb:movie:286217'), film);
    expect(progress?.positionMs).toBe(84_000);
    expect(progress?.itemId).toBe('tmdb:movie:286217');
    expect(progress?.fileMediaId).toBe('macha:hd');
  });

  it("records it when the session's file is one of the item's, with no item named", () => {
    expect(attributableProgress(session('macha:hd'), film)?.positionMs).toBe(84_000);
  });

  it('still writes nothing for a session on another item', () => {
    expect(attributableProgress(session('macha:other', 'tmdb:movie:1'), film)).toBeUndefined();
  });
});
