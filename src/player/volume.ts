/**
 * Volume and mute, and the one decision in them that is not obvious.
 *
 * `VolumeStore` persists a single number and knows nothing about mute. That
 * leaves a choice about what to write when a viewer mutes, and only one answer
 * is safe: **persist the unmuted volume, keep mute in memory.**
 *
 * Writing `0` on mute would be indistinguishable from a viewer who genuinely
 * turned the sound down, so the next launch would come up silent with nothing
 * on screen explaining why — and the obvious fix, pressing volume up, is not
 * obvious at all to someone who thinks the television is broken. A mute is a
 * temporary state; the volume behind it is the setting.
 */

/** The store's own range. Anything outside it is a bug upstream, not a preference. */
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

/**
 * A step of the volume control.
 *
 * Adjusting while muted unmutes: the viewer is asking for a level, and leaving
 * them muted would make the control appear broken — they press up, the number
 * moves, and nothing is heard.
 */
export function adjustVolume(state: VolumeState, delta: number): VolumeState {
  const setting = clampVolume(state.setting + delta);
  return { effective: setting, setting, muted: false };
}

export function setVolumeLevel(state: VolumeState, value: number): VolumeState {
  const setting = clampVolume(value);
  return { effective: setting, setting, muted: false };
}

/**
 * Mute keeps the setting and zeroes only what the player hears.
 *
 * Unmuting a setting of zero would be a control that visibly does nothing, so
 * it restores to a minimum audible level instead — the viewer asked to hear
 * something.
 */
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

/** 0–1 as a percentage a viewer can read across a room. */
export function volumePercent(state: VolumeState): number {
  return Math.round(state.effective * 100);
}
