import {
  resumePreferences,
  versionPreferences,
  type PlaybackPreferencesUpdate,
  type PlaybackProgress,
  type VersionStep,
} from '@machafoundation/core';

/**
 * The preferences a play starts with. A picked version plays as picked; a
 * resume restores the Continue Watching entry's file and choices; a play from
 * the start carries nothing over.
 */
export function startPreferences(
  startPositionMs: number,
  entry: PlaybackProgress | undefined,
  version?: VersionStep,
): PlaybackPreferencesUpdate | undefined {
  if (version) return versionPreferences(version);
  if (startPositionMs > 0 && entry) return resumePreferences(entry);
  return undefined;
}
