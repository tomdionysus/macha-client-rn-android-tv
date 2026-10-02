import {
  resumePreferences,
  versionPreferences,
  type PlaybackPreferencesUpdate,
  type PlaybackProgress,
  type VersionStep,
} from '@machafoundation/core';

/**
 * The preferences a play starts with, for `runtime.play(request, ...)`.
 *
 * - A version the viewer picked starts as their choice (`versionPreferences`).
 * - A resume starts as it was left: the same file, the viewer's mode where
 *   they chose one, the cap, the audio and the subtitles, from the Continue
 *   Watching entry (`resumePreferences`). Where core chose the mode, it chooses
 *   again for the set and node of now, on that file.
 * - A play from the start is a fresh one: nothing is carried over, so Restart
 *   means what it says.
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
