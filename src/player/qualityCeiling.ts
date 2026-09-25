import { qualityCeiling, type QualityCeiling } from '@machafoundation/core';
import { androidTvPlatform } from '../platform/AndroidTvPlatform';
import { qualityPreferenceStore } from '../state/qualityPreference';

/**
 * The cap on automatic play on this television, and why.
 *
 * Core's `qualityCeiling` from the panel's mode and the viewer's setting. No
 * connection is passed: a television's network is not metered, and core
 * counts an unnamed connection as Wi-Fi. Called at each start (the runtime's
 * `qualityCeiling` option) and by the detail page, so a changed setting
 * applies to the next play without a restart.
 */
export function deviceQualityCeiling(): QualityCeiling | undefined {
  const display = androidTvPlatform.display();
  const preference = qualityPreferenceStore().get();
  return qualityCeiling({
    ...(display ? { display } : {}),
    preference,
  });
}
