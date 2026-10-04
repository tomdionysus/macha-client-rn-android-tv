import { progressFor, type MediaSummary, type PlaybackCoordinatorSnapshot, type PlaybackProgress } from '@machafoundation/core';

/**
 * The progress to record for `media`, or undefined if the session is not
 * playing it. Just after a switch the route and the session differ, and a
 * near-0 position stored under the old item makes core drop its entry (it
 * keeps nothing below 30 s).
 */
export function attributableProgress(
  snapshot: PlaybackCoordinatorSnapshot | undefined,
  media: MediaSummary | undefined,
): PlaybackProgress | undefined {
  if (!snapshot || !media || !(snapshot.event.durationMs > 0)) return undefined;
  if (!sessionIsFor(snapshot.session, media)) return undefined;
  // The snapshot lets core record the file and mode for resume.
  return progressFor(media, snapshot.event.positionMs, snapshot.event.durationMs, snapshot);
}

/**
 * A session names its file as `mediaId` (`"macha:…"`) and the item as
 * `itemId`. `itemId` decides; otherwise the file must be one of the item's,
 * or (nodes older than 0.58.0) `mediaId` is the item's id.
 */
function sessionIsFor(session: PlaybackCoordinatorSnapshot['session'], media: MediaSummary): boolean {
  if (!session) return false;
  if (session.itemId !== undefined) return session.itemId === media.id;
  return session.mediaId === media.id || media.mediaIds?.includes(session.mediaId) === true;
}
