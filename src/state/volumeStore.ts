import { machaHost, type ReadWriteStorageLike } from '@machafoundation/core';

/**
 * The remembered volume level. Client-owned; the web client keeps its own copy
 * and the two stay in step. Persists `setting`, never `effective`
 * (`player/volume.ts`): `effective` is 0 while muted, and storing it would
 * bring the next launch up silent. Mute is in-memory only.
 */

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

export class VolumeStore {
  private readonly key: string;

  constructor(
    clientId: string,
    private readonly storage: ReadWriteStorageLike = machaHost().storage,
  ) {
    // The key core used; renaming it resets every set to full volume.
    this.key = `macha.volume.v1.${clientId}`;
  }

  /**
   * Absent, empty, whitespace or unreadable all mean full volume. `Number('')`
   * is 0, so the emptiness check stops a corrupt entry reading as a mute.
   */
  load(): number {
    const raw = this.storage.getItem(this.key);
    if (raw === null || raw.trim() === '') return 1;
    const value = Number(raw);
    return Number.isFinite(value) ? clampVolume(value) : 1;
  }

  /** Returns the clamped value actually stored, not the one requested. */
  save(volume: number): number {
    const value = clampVolume(volume);
    this.storage.setItem(this.key, String(value));
    return value;
  }
}
