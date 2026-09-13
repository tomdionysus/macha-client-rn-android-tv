import { describe, expect, it } from 'vitest';
import { VolumeStore } from './volumeStore';

/** A storage that behaves like the hydrated in-memory cache the app supplies. */
function fakeStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  return {
    store: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => { map.set(key, value); },
    },
    map,
  };
}

/**
 * Copied out of core on 2026-09-13. These exist so the copy cannot drift
 * silently — particularly the storage key, which carries a viewer's existing
 * volume across the move.
 */
describe('VolumeStore, now this client\'s own', () => {
  it('keeps core\'s storage key, so nobody\'s volume resets on upgrade', () => {
    const { store, map } = fakeStorage();
    new VolumeStore('client-a', store).save(0.4);
    expect([...map.keys()]).toEqual(['macha.volume.v1.client-a']);
  });

  it('is scoped per client, so two televisions do not share a level', () => {
    const { store } = fakeStorage();
    new VolumeStore('a', store).save(0.2);
    new VolumeStore('b', store).save(0.9);
    expect(new VolumeStore('a', store).load()).toBe(0.2);
    expect(new VolumeStore('b', store).load()).toBe(0.9);
  });

  it('reads full volume when nothing has been stored', () => {
    expect(new VolumeStore('fresh', fakeStorage().store).load()).toBe(1);
  });

  it('reads full volume rather than silence when the stored value is unusable', () => {
    // Coming up silent with nothing explaining why is the failure this whole
    // area is designed against; an unreadable value must not cause it.
    const { store } = fakeStorage({ 'macha.volume.v1.x': 'not-a-number' });
    expect(new VolumeStore('x', store).load()).toBe(1);
  });

  it('reads an empty stored value as absent, not as a deliberate mute', () => {
    // `Number('')` is 0 and 0 is finite, so a corrupted or half-written entry
    // would otherwise parse as silence — the exact failure this store exists
    // to prevent, and the one a viewer cannot diagnose.
    for (const corrupt of ['', '   ', '\n']) {
      const { store } = fakeStorage({ 'macha.volume.v1.x': corrupt });
      expect(new VolumeStore('x', store).load(), JSON.stringify(corrupt)).toBe(1);
    }
  });

  it('still honours a genuine zero, which is a level a viewer may choose', () => {
    const { store } = fakeStorage({ 'macha.volume.v1.x': '0' });
    expect(new VolumeStore('x', store).load()).toBe(0);
  });

  it('clamps to the store\'s own range and reports what it actually stored', () => {
    const { store } = fakeStorage();
    expect(new VolumeStore('c', store).save(5)).toBe(1);
    expect(new VolumeStore('c', store).save(-3)).toBe(0);
    expect(new VolumeStore('c', store).load()).toBe(0);
  });
});
