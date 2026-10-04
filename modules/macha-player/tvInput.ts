import { requireNativeModule } from 'expo-modules-core';

/**
 * Remote key events. Shares the `macha-player` Gradle module; the Kotlin is in
 * its own `foundation.macha.tvinput` package. `MachaTvInputModule.kt` says why
 * React Native cannot deliver these itself in a bridgeless build.
 */

export interface TvKeyEvent {
  /** The web client's command vocabulary: up/down/left/right/select and the transport keys. */
  eventType: string;
  /** 0 on the first press; increments while a direction is held. */
  repeatCount: number;
}

interface MachaTvInputNativeModule {
  addListener(event: 'onTvKey', listener: (payload: TvKeyEvent) => void): { remove(): void };
}

const MachaTvInput = requireNativeModule<MachaTvInputNativeModule>('MachaTvInput');

/** Returns the unsubscribe. */
export function addTvKeyListener(listener: (event: TvKeyEvent) => void): () => void {
  const subscription = MachaTvInput.addListener('onTvKey', listener);
  return () => subscription.remove();
}
