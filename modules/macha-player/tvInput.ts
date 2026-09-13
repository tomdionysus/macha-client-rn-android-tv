import { requireNativeModule } from 'expo-modules-core';

/**
 * The remote, as this client receives it.
 *
 * Shares the `macha-player` Gradle module rather than standing up a second one:
 * the directory is a build container, and a separate Expo module would be a new
 * `build.gradle`, a new autolinking entry and a new way for the release build
 * to differ from the debug build — which this project has already been bitten
 * by twice. The Kotlin lives in its own `foundation.macha.tvinput` package, so
 * nothing about key input is mixed into the player.
 *
 * See `MachaTvInputModule.kt` for why React Native cannot deliver these events
 * itself in a bridgeless build.
 */

export interface TvKeyEvent {
  /** The web client's command vocabulary: up/down/left/right/select, and the transport keys. */
  eventType: string;
  /** 0 on the first press; increments while a direction is held. */
  repeatCount: number;
}

interface MachaTvInputNativeModule {
  addListener(event: 'onTvKey', listener: (payload: TvKeyEvent) => void): { remove(): void };
}

const MachaTvInput = requireNativeModule<MachaTvInputNativeModule>('MachaTvInput');

/** Subscribe to remote key presses. Returns the unsubscribe. */
export function addTvKeyListener(listener: (event: TvKeyEvent) => void): () => void {
  const subscription = MachaTvInput.addListener('onTvKey', listener);
  return () => subscription.remove();
}
