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
  if (!sessionIsFor(snapshot.session, media)) return undefined;
  // With the snapshot, core records the file and how it was playing (core
  // 89a9d0c: Tom's "resume as if you'd never left").
  return progressFor(media, snapshot.event.positionMs, snapshot.event.durationMs, snapshot);
}

/**
 * Whether the session is playing this item.
 *
 * **Since server 0.58.0 a session names the file it plays**, `mediaId:
 * "macha:…"`, and the item separately as `itemId`. This compared `mediaId`
 * with the item's id, which a file id never equals, so nothing was recorded:
 * measured on `.133` 2026-09-27, *The Martian* played to 1:24 and closed never
 * reached Continue Watching. The item the session names decides; failing
 * that, the session's file being one of the item's; and the old comparison is
 * kept for a node that names neither.
 */
function sessionIsFor(session: PlaybackCoordinatorSnapshot['session'], media: MediaSummary): boolean {
  if (!session) return false;
  if (session.itemId !== undefined) return session.itemId === media.id;
  return session.mediaId === media.id || media.mediaIds?.includes(session.mediaId) === true;
}
