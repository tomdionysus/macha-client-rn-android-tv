import { nativeStorage } from '../state/storage';
import { applyDiagnosticsLevel } from './playbackLog';

/**
 * Whether the failure overlay prints the diagnostics trail or only the message.
 * Off by default. Rule and storage key match the web client's
 * `diagnostics/failureTrailSetting.ts`.
 */
const FAILURE_TRAIL_KEY = 'macha-playback-failure-trail-v1';

/** Read when a failure lands. `null` before `hydrateStorage()` completes means off. */
export function failureTrailEnabled(): boolean {
  return nativeStorage.getItem(FAILURE_TRAIL_KEY) === 'on';
}

export function setFailureTrailEnabled(enabled: boolean): void {
  if (enabled) nativeStorage.setItem(FAILURE_TRAIL_KEY, 'on');
  else nativeStorage.removeItem(FAILURE_TRAIL_KEY);
  applyDiagnosticsLevel(enabled);
}

/**
 * Call once after storage hydrates: `playbackLog` configures itself at import,
 * before the setting can be read.
 */
export function syncDiagnosticsLevel(): void {
  applyDiagnosticsLevel(failureTrailEnabled());
}
