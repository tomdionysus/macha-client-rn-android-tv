import { nativeStorage } from '../state/storage';
import { applyDiagnosticsLevel } from './playbackLog';

/**
 * Whether the playback failure overlay prints the evidence behind a failure,
 * or only the message.
 *
 * **Off by default, deliberately.** The trail is a dozen lines of scope,
 * event and truncated JSON: exactly right in front of whoever is debugging a
 * television that has no console, and exactly wrong in front of everyone
 * else, who wanted to know their film stopped and not why the third node
 * refused a fragment. Diagnostics that are on by default stop being
 * diagnostics and start being the product.
 *
 * The rule and the storage key are the web client's
 * (`diagnostics/failureTrailSetting.ts`), so a person who has debugged one
 * client already knows where this lives.
 */
const FAILURE_TRAIL_KEY = 'macha-playback-failure-trail-v1';

/**
 * Read at the moment a failure lands rather than subscribed to.
 *
 * That is the only moment it is consulted, and turning it on mid-failure to
 * inspect a failure already on screen is not a case worth carrying state for.
 *
 * `nativeStorage` reads from a hydrated in-memory cache and cannot throw, but
 * it legitimately answers `null` before `hydrateStorage()` has completed —
 * a cold start racing a very early failure. Absent and unreadable both mean
 * off, which is also the default, so the race has no wrong answer.
 */
export function failureTrailEnabled(): boolean {
  return nativeStorage.getItem(FAILURE_TRAIL_KEY) === 'on';
}

export function setFailureTrailEnabled(enabled: boolean): void {
  if (enabled) nativeStorage.setItem(FAILURE_TRAIL_KEY, 'on');
  else nativeStorage.removeItem(FAILURE_TRAIL_KEY);
  applyDiagnosticsLevel(enabled);
}

/**
 * Bring the buffer's level in line with the stored setting.
 *
 * Called once, after storage has hydrated, because `playbackLog` configures
 * itself at import — before the setting can be read — and a set left with
 * Diagnostics on would otherwise come up at `warn` until somebody visited
 * Settings and pressed the toggle twice.
 */
export function syncDiagnosticsLevel(): void {
  applyDiagnosticsLevel(failureTrailEnabled());
}
