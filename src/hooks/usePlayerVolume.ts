import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaybackRuntime } from '@machafoundation/core';
import type { VolumeStore } from '../state/volumeStore';
import {
  adjustVolume,
  initialVolume,
  toggleMute as toggleMuteState,
  VOLUME_STEP,
  type VolumeState,
} from '../player/volume';

/**
 * The player's volume, persisted through `VolumeStore`. The setting persists,
 * the mute does not: see `player/volume.ts`.
 */
export interface PlayerVolume extends VolumeState {
  step: (direction: 'up' | 'down') => void;
  toggleMute: () => void;
}

export function usePlayerVolume(runtime: PlaybackRuntime, store: VolumeStore): PlayerVolume {
  const [state, setState] = useState<VolumeState>(() => initialVolume(store.load()));
  const applied = useRef<number | undefined>(undefined);

  // Includes mount: the stored volume means nothing until the player is told.
  useEffect(() => {
    if (applied.current === state.effective) return;
    applied.current = state.effective;
    runtime.setVolume(state.effective);
  }, [runtime, state.effective]);

  // The setting, not what is heard, so a mute at shutdown does not return as silence.
  useEffect(() => {
    store.save(state.setting);
  }, [store, state.setting]);

  const step = useCallback((direction: 'up' | 'down') => {
    setState((current) => adjustVolume(current, direction === 'up' ? VOLUME_STEP : -VOLUME_STEP));
  }, []);

  const toggleMute = useCallback(() => setState(toggleMuteState), []);

  return { ...state, step, toggleMute };
}
