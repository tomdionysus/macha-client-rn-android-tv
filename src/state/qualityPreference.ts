import { QualityPreferenceStore, type QualityClass } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * The viewer's quality ceiling for automatic play, per device; unset, play
 * caps at the display's class. The store is core's. A television only sets
 * `wifi`: core counts an unnamed connection as Wi-Fi.
 *
 * Built on first use so it cannot precede `configureMachaHost`.
 */
let store: QualityPreferenceStore | undefined;

export function qualityPreferenceStore(): QualityPreferenceStore {
  store ??= new QualityPreferenceStore(nativeStorage);
  return store;
}

/** The ceilings Settings offers, highest first. */
export const QUALITY_CEILING_CHOICES: readonly QualityClass[] = [2160, 1440, 1080, 720];
