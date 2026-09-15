import { AppState } from 'react-native';
import type { MediaWatchdogEnvironment } from '@machafoundation/core';

/**
 * The host bindings core's media watchdogs need.
 *
 * All four are small, and `visible()` is the one with a rule attached: only a
 * positive "nobody is looking" may count as hidden. A host that cannot answer
 * must return `true`, because a watchdog that quietly stops watching is worse
 * than one that never existed.
 *
 * On a television the question is simpler than in a browser tab. Chromium
 * throttles media loading in a backgrounded tab, which is the confound the
 * watchdogs were designed around; Android does not throttle a foreground TV
 * app, and a backgrounded TV app is genuinely not being watched. So `active`
 * maps to visible and everything else does not.
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
      // Returning the cancel keeps the handle type from escaping, which is what
      // lets core stay free of any platform's timer type.
      return () => clearTimeout(handle);
    },
  };
}
