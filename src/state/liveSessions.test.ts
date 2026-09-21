import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageLike } from '@machafoundation/core';

// `liveSessions` imports `storage`, which imports AsyncStorage at module scope.
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));

const { orphanedSessions, trackLiveSession, forgetSessions, resetLiveSessionTracking } =
  await import('./liveSessions');

function fakeStorage(seed: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

const KEY = 'macha-playback-live-sessions-v1';

/**
 * The record exists so that a session which outlived its process can be closed
 * by the run that follows it. Everything here is about that one property: what
 * is on disk when the process dies is what core gets to reconcile.
 *
 * The reclaim itself is core's — a client cannot tell its own orphan from
 * another device's live session on the same account, and closing the wrong one
 * kills someone else's film. These ids are the discriminator, and they are ids
 * this install was handed rather than ids it found.
 */
describe('the live-session record', () => {
  beforeEach(() => resetLiveSessionTracking());

  it('writes the session down as soon as the runtime reports one', () => {
    const storage = fakeStorage();
    trackLiveSession('node-a::abc', { storage });
    expect(JSON.parse(storage.map.get(KEY)!)).toEqual(['node-a::abc']);
  });

  it('forgets it on a clean stop, which is the whole difference from a crash', () => {
    const storage = fakeStorage();
    trackLiveSession('node-a::abc', { storage });
    trackLiveSession(undefined, { storage });
    expect(storage.map.has(KEY)).toBe(false);
  });

  it('drops the id a regenerate replaced rather than accumulating both', () => {
    const storage = fakeStorage();
    trackLiveSession('node-a::gen1', { storage });
    trackLiveSession('node-a::gen2', { storage });
    expect(JSON.parse(storage.map.get(KEY)!)).toEqual(['node-a::gen2']);
  });

  it('survives the process: what a previous run left is what this one reports', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify(['node-a::orphan']) });
    expect(orphanedSessions({ storage })).toEqual(['node-a::orphan']);
  });

  /**
   * The case the whole module is for. A run records a session and dies without
   * ever reporting `undefined`; the next run must still find it.
   */
  it('keeps a session a killed process never got to close', () => {
    const storage = fakeStorage();
    trackLiveSession('node-a::killed', { storage });

    resetLiveSessionTracking(); // the process died here
    expect(orphanedSessions({ storage })).toEqual(['node-a::killed']);
  });

  it('does not report this run\'s own live session as an orphan', () => {
    const storage = fakeStorage();
    orphanedSessions({ storage });
    trackLiveSession('node-a::mine', { storage });
    expect(orphanedSessions({ storage })).toEqual([]);
  });

  it('clears only what a reconcile says it closed', () => {
    const storage = fakeStorage({ [KEY]: JSON.stringify(['a::1', 'b::2', 'c::3']) });
    forgetSessions(['a::1', 'c::3'], { storage });
    expect(JSON.parse(storage.map.get(KEY)!)).toEqual(['b::2']);
  });

  /**
   * Bounded against the server's own per-account cap, so a reconcile that never
   * arrives cannot grow the record without end. Asserted as the relationship —
   * the record never describes more sessions than an account may hold.
   */
  it('never remembers more sessions than an account may have open', () => {
    const storage = fakeStorage();
    for (let i = 0; i < 50; i += 1) {
      resetLiveSessionTracking(); // each one a run that died
      trackLiveSession(`node-a::s${i}`, { storage });
    }
    const remembered: string[] = JSON.parse(storage.map.get(KEY)!);
    expect(remembered.length).toBeLessThanOrEqual(32);
    // And it keeps the newest, which are the ones most likely still live.
    expect(remembered).toContain('node-a::s49');
  });

  it('treats an unreadable record as an empty one rather than throwing', () => {
    const storage = fakeStorage({ [KEY]: 'not json' });
    expect(orphanedSessions({ storage })).toEqual([]);
  });
});
