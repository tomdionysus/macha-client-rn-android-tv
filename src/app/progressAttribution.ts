import { progressFor, type MediaSummary, type PlaybackCoordinatorSnapshot, type PlaybackProgress } from '@machafoundation/core';

/**
 * The progress to record for `media`, or nothing if the player is not on it.
 *
 * The route says what the viewer asked for; the snapshot's session says what
 * the player is actually playing, and for a moment after a switch they differ.
 * Measured on `.133` 2026-09-24: next from *Our Mrs. Reynolds* at 29:31, then
 * previous, resumed it at 0:16. A write in that gap stored the new episode's
 * position near 0 under the old one, and core, which keeps nothing below 30 s,
 * dropped the entry and the place with it. So a position is only ever
 * attributed to the media the session names, and before a new generation has
 * a session nothing is written at all.
 */
export function attributableProgress(
  snapshot: PlaybackCoordinatorSnapshot | undefined,
  media: MediaSummary | undefined,
): PlaybackProgress | undefined {
  if (!snapshot || !media || !(snapshot.event.durationMs > 0)) return undefined;
  if (snapshot.session?.mediaId !== media.id) return undefined;
  return progressFor(media, snapshot.event.positionMs, snapshot.event.durationMs);
}
