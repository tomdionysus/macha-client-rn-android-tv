/**
 * Volume and mute. `VolumeStore` persists one number and knows nothing of
 * mute, so the unmuted volume is persisted and mute stays in memory: a stored
 * `0` would bring the next launch up silent.
 */

/** Clamp to the store's 0–1 range. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

export interface VolumeState {
  /** What the player should be set to now — 0 while muted. */
  effective: number;
  /** What to persist, and what unmuting restores. Never 0 because of a mute. */
  setting: number;
  muted: boolean;
}

export function initialVolume(stored: number): VolumeState {
  const setting = clampVolume(stored);
  return { effective: setting, setting, muted: false };
}

/** Adjusting while muted unmutes. */
export function adjustVolume(state: VolumeState, delta: number): VolumeState {
  const setting = clampVolume(state.setting + delta);
  return { effective: setting, setting, muted: false };
}

/** Mute zeroes only `effective`. Unmuting a setting of zero restores `MINIMUM_AUDIBLE`. */
export function toggleMute(state: VolumeState): VolumeState {
  if (state.muted) {
    const restored = state.setting > 0 ? state.setting : MINIMUM_AUDIBLE;
    return { effective: restored, setting: restored, muted: false };
  }
  return { effective: 0, setting: state.setting, muted: true };
}

/** One step of the D-pad, and the floor an unmute restores to. */
export const VOLUME_STEP = 0.05;
const MINIMUM_AUDIBLE = 0.1;

/** 0–1 as a whole percentage. */
export function volumePercent(state: VolumeState): number {
  return Math.round(state.effective * 100);
}
