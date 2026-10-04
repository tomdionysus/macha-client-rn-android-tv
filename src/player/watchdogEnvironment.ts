import { AppState } from 'react-native';
import type { MediaWatchdogEnvironment } from '@machafoundation/core';

/**
 * Host bindings for core's media watchdogs. `visible()` may report hidden only
 * on a positive answer; Android does not throttle a foreground TV app, so
 * `active` is visible and anything else is not.
 */
export function createWatchdogEnvironment(): MediaWatchdogEnvironment {
  return {
    now: () => Date.now(),
    visible: () => AppState.currentState === 'active',
    onVisibilityChange: (listener) => {
      const subscription = AppState.addEventListener('change', listener);
      return () => subscription.remove();
    },
    schedule: (callback, delayMs) => {
      const handle = setTimeout(callback, delayMs);
      // Returning the cancel keeps the platform timer type out of core.
      return () => clearTimeout(handle);
    },
  };
}
