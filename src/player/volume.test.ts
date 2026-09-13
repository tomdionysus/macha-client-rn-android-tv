import { describe, expect, it } from 'vitest';
import {
  adjustVolume,
  clampVolume,
  initialVolume,
  setVolumeLevel,
  toggleMute,
  volumePercent,
  VOLUME_STEP,
} from './volume';

/**
 * `VolumeStore` persists a single number and knows nothing about mute, so what
 * gets written on a mute is a decision rather than a detail — and the wrong
 * answer is one a viewer cannot diagnose from the sofa.
 */
describe('what a mute persists', () => {
  it('keeps the setting behind a mute, so the player is silent and the setting is not', () => {
    const muted = toggleMute(initialVolume(0.6));
    expect(muted.effective).toBe(0);
    expect(muted.setting).toBe(0.6);
    expect(muted.muted).toBe(true);
  });

  it('restores the level it was muted from', () => {
    const restored = toggleMute(toggleMute(initialVolume(0.6)));
    expect(restored.effective).toBe(0.6);
    expect(restored.muted).toBe(false);
  });

  it('never leaves a viewer with a control that does nothing', () => {
    // Unmuting a setting of zero would restore silence: the button would
    // visibly toggle and nothing would be heard, which reads as broken.
    const fromSilence = toggleMute(toggleMute(initialVolume(0)));
    expect(fromSilence.effective).toBeGreaterThan(0);
    expect(fromSilence.muted).toBe(false);
  });
});

describe('adjusting the level', () => {
  it('unmutes, because asking for a level is asking to hear something', () => {
    const muted = toggleMute(initialVolume(0.5));
    const raised = adjustVolume(muted, VOLUME_STEP);
    expect(raised.muted).toBe(false);
    expect(raised.effective).toBeGreaterThan(0);
  });

  it('steps up and down by the same amount', () => {
    const start = initialVolume(0.5);
    expect(adjustVolume(start, VOLUME_STEP).setting).toBeCloseTo(0.55);
    expect(adjustVolume(start, -VOLUME_STEP).setting).toBeCloseTo(0.45);
  });

  it('stops at the ends rather than wrapping or overshooting', () => {
    expect(adjustVolume(initialVolume(1), VOLUME_STEP).setting).toBe(1);
    expect(adjustVolume(initialVolume(0), -VOLUME_STEP).setting).toBe(0);
  });

  it('keeps effective and setting together while unmuted', () => {
    const state = adjustVolume(initialVolume(0.5), VOLUME_STEP);
    expect(state.effective).toBe(state.setting);
  });
});

describe('reading a stored value', () => {
  it('defaults to full volume when the store has nothing sensible', () => {
    expect(clampVolume(Number.NaN)).toBe(1);
    expect(initialVolume(Number.NaN).setting).toBe(1);
  });

  it('clamps a value from outside the range rather than trusting it', () => {
    expect(clampVolume(4)).toBe(1);
    expect(clampVolume(-1)).toBe(0);
  });

  it('comes up unmuted whatever was stored', () => {
    // Mute is never persisted, so a stored 0 is a viewer's setting and comes
    // back as one — quiet, but not in a state that hides its own cause.
    expect(initialVolume(0).muted).toBe(false);
  });
});

describe('showing the level', () => {
  it('reads as a percentage across a room', () => {
    expect(volumePercent(initialVolume(0.35))).toBe(35);
  });

  it('shows zero while muted, whatever the setting behind it', () => {
    expect(volumePercent(toggleMute(initialVolume(0.8)))).toBe(0);
  });

  it('takes an explicit level without going through steps', () => {
    expect(setVolumeLevel(initialVolume(0.2), 0.75).setting).toBe(0.75);
  });
});
