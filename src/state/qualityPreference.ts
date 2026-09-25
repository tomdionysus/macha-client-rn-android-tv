import { QualityPreferenceStore, type QualityClass } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * The viewer's quality ceiling for automatic play, kept per device.
 *
 * Tom, 2026-09-25, relayed by core: a ceiling in Settings (720p, 1080p, 1440p,
 * 4K), **per device**, and with no setting automatic play caps at the display's
 * class. The store is core's (`edef8bf`, key `macha.qualityPreference.v1`, in
 * its registry, so the startup hydrate's contract test covers it); every
 * client keeps the setting in one shape. A television only ever sets `wifi`:
 * it passes no connection, and core counts an unnamed connection as Wi-Fi.
 *
 * Built on first use with `nativeStorage` named, rather than at import from
 * the host's default, so it cannot be constructed before `configureMachaHost`.
 */
let store: QualityPreferenceStore | undefined;

export function qualityPreferenceStore(): QualityPreferenceStore {
  store ??= new QualityPreferenceStore(nativeStorage);
  return store;
}

/** The ceilings Settings offers, highest first. Tom's list: 720p to 4K. */
export const QUALITY_CEILING_CHOICES: readonly QualityClass[] = [2160, 1440, 1080, 720];
