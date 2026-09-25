import { QUALITY_CLASSES, type QualityClass, type QualityPreference } from '@machafoundation/core';
import { nativeStorage } from './storage';

/**
 * The viewer's quality ceiling for automatic play, kept per device.
 *
 * Tom, 2026-09-25, relayed by core: a ceiling in Settings (720p, 1080p, 1440p,
 * 4K), **per device**, and with no setting automatic play caps at the display's
 * class. Core decides from it (`qualityCeiling`) and does not store it; the
 * store is this client's.
 *
 * **The stored shape is core's `QualityPreference`**, `{ "wifi": 1080 }`, not a
 * bare number, so a mobile-data ceiling fits beside it without a new key. A
 * television only ever writes `wifi`: it passes no connection, and core counts
 * an unnamed connection as Wi-Fi.
 *
 * The key is dotted, `macha.<name>.v<n>`, the form core's `storageKeys.ts` says
 * new keys take; it starts with `macha`, so the startup hydrate loads it.
 */
export const QUALITY_PREFERENCE_KEY = 'macha.quality-preference.v1';

/** The ceilings Settings offers, highest first. Tom's list: 720p to 4K. */
export const QUALITY_CEILING_CHOICES: readonly QualityClass[] = [2160, 1440, 1080, 720];

function isQualityClass(value: unknown): value is QualityClass {
  return typeof value === 'number' && (QUALITY_CLASSES as readonly number[]).includes(value);
}

/**
 * What a stored value says, or undefined for anything else.
 *
 * Unreadable means unset rather than a guess: the cap then falls back to the
 * display, which is what a viewer who never opened Settings gets anyway.
 */
export function parseQualityPreference(raw: string | null): QualityPreference | undefined {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const { wifi, cellular } = parsed as Record<string, unknown>;
    const preference: QualityPreference = {
      ...(isQualityClass(wifi) ? { wifi } : {}),
      ...(isQualityClass(cellular) ? { cellular } : {}),
    };
    return preference.wifi !== undefined || preference.cellular !== undefined ? preference : undefined;
  } catch {
    return undefined;
  }
}

export function qualityPreference(): QualityPreference | undefined {
  return parseQualityPreference(nativeStorage.getItem(QUALITY_PREFERENCE_KEY));
}

/** Undefined clears the setting, which hands the ceiling back to the display. */
export function setQualityPreference(quality: QualityClass | undefined): void {
  if (quality === undefined) nativeStorage.removeItem(QUALITY_PREFERENCE_KEY);
  else nativeStorage.setItem(QUALITY_PREFERENCE_KEY, JSON.stringify({ wifi: quality }));
}
