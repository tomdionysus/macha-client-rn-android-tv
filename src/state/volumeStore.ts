import { machaHost, type ReadWriteStorageLike } from '@machafoundation/core';

/**
 * Where the volume level is remembered.
 *
 * **Client-owned, not core's.** Volume is player logic: if the viewer muted,
 * or starts at zero, that is what the client does. The storage key is
 * per-client, so there is nothing to share; the web client keeps its own copy.
 *
 * **It persists a bare level, and that is deliberate.** The model above it —
 * `{ effective, setting, muted }` in `player/volume.ts` — is this client's.
 * The rule that matters when writing here is stated there and repeated here:
 *
 * > **Persist `setting`, never `effective`.** `effective` is 0 while muted, so
 * > writing it makes the next launch come up silent with nothing on screen
 * > explaining why — and the obvious remedy, pressing volume up, is not
 * > obvious at all to someone who thinks the television is broken.
 *
 * Mute itself is in-memory and does not persist, for the same reason. This
 * store stays a bare level so it cannot express a muted state at all.
 */

/** The store's own range. Anything outside it is a bug upstream, not a preference. */
function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
}

export class VolumeStore {
  private readonly key: string;

  constructor(
    clientId: string,
    private readonly storage: ReadWriteStorageLike = machaHost().storage,
  ) {
    /**
     * **The key core used, on purpose.** Renaming it would silently reset
     * every set to full volume on the next launch — the
     * comes-up-wrong-with-no-explanation failure this file's own rule argues
     * against.
     */
    this.key = `macha.volume.v1.${clientId}`;
  }

  /**
   * Absent or unreadable both mean full volume, which is also the default.
   *
   * **An empty string is absent, not zero.** `Number('')` is `0` and `0` is
   * finite, so without the emptiness check a corrupted or half-written entry
   * parses as a deliberate mute — the one input that produces precisely the
   * come-up-silent failure this store exists to prevent, and the hardest for a
   * viewer to diagnose because the control looks fine and the television looks
   * broken. `0` is a level a viewer may genuinely choose and must keep
   * meaning silence; `''` is not a value at all.
   *
   * Whitespace goes the same way, for the same reason. The web client's copy
   * matches; keep the two in step, because a divergence would be invisible
   * until a viewer's storage reached that state.
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
