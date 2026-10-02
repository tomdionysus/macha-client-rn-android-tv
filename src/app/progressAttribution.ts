import { progressFor, type MediaSummary, type PlaybackCoordinatorSnapshot, type PlaybackProgress } from '@machafoundation/core';

/**
 * The progress to record for `media`, or nothing if the player is not on it.
 *
 * The route says what the viewer asked for; the snapshot's session says what
 * the player is actually playing, and for a moment after a switch they differ.
 * A write in that gap would store the new episode's position near 0 under the
 * old one, and core, which keeps nothing below 30 s, would drop the entry and
 * the place with it. So a position is only ever attributed to the media the
 * session names, and before a new generation has a session nothing is written
 * at all.
 */
export function attributableProgress(
  snapshot: PlaybackCoordinatorSnapshot | undefined,
  media: MediaSummary | undefined,
): PlaybackProgress | undefined {
  if (!snapshot || !media || !(snapshot.event.durationMs > 0)) return undefined;
  if (!sessionIsFor(snapshot.session, media)) return undefined;
  // With the snapshot, core records the file and how it was playing, so a
  // resume plays as if the viewer never left.
  return progressFor(media, snapshot.event.positionMs, snapshot.event.durationMs, snapshot);
}

/**
 * Whether the session is playing this item.
 *
 * A session names the file it plays as `mediaId` (`"macha:…"`), which never
 * equals the item's id, and the item separately as `itemId`. The item the
 * session names decides; failing that, the session's file being one of the
 * item's; and a direct `mediaId` match covers a node older than 0.58.0, which
 * names neither.
 */
function sessionIsFor(session: PlaybackCoordinatorSnapshot['session'], media: MediaSummary): boolean {
  if (!session) return false;
  if (session.itemId !== undefined) return session.itemId === media.id;
  return session.mediaId === media.id || media.mediaIds?.includes(session.mediaId) === true;
}
