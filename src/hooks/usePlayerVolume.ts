import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackRuntime } from '@macha/core';
import type { VolumeStore } from '../state/volumeStore';
import {
  adjustVolume,
  initialVolume,
  toggleMute as toggleMuteState,
  VOLUME_STEP,
  type VolumeState,
} from '../player/volume';

/**
 * The player's volume, persisted across sessions.
 *
 * Wires `VolumeStore`, which has been constructed in `MachaProvider` and read
 * by nothing since the day it was added. The rule about what gets written is in
 * `player/volume.ts`: the setting persists, the mute does not.
 */
export interface PlayerVolume extends VolumeState {
  step: (direction: 'up' | 'down') => void;
  toggleMute: () => void;
}

export function usePlayerVolume(runtime: PlaybackRuntime, store: VolumeStore): PlayerVolume {
  const [state, setState] = useState<VolumeState>(() => initialVolume(store.load()));
  const applied = useRef<number | undefined>(undefined);

  // Apply to the player whenever what it should be hearing changes, including
  // on mount — the stored volume is meaningless until the player is told.
  useEffect(() => {
    if (applied.current === state.effective) return;
    applied.current = state.effective;
    runtime.setVolume(state.effective);
  }, [runtime, state.effective]);

  // Persist the setting rather than what is being heard, so a mute at shutdown
  // does not come back as silence.
  useEffect(() => {
    store.save(state.setting);
  }, [store, state.setting]);

  const step = useCallback((direction: 'up' | 'down') => {
    setState((current) => adjustVolume(current, direction === 'up' ? VOLUME_STEP : -VOLUME_STEP));
  }, []);

  const toggleMute = useCallback(() => setState(toggleMuteState), []);

  return { ...state, step, toggleMute };
}
