import type { MediaSummary } from '@machafoundation/core';

/** The marker a title carries at its top left, or none. */
export type AvailabilityMarkerKind = 'partial' | 'unavailable' | 'unknown';

/**
 * Which marker a title shows, the same in every client and every context:
 * a red warning triangle for `partial`, a red crossed circle for
 * `unavailable`, a yellow question mark for `unknown`, and nothing for
 * `complete`.
 *
 * Nothing either for a title that carries no availability (a server that does
 * not report it) or a code this client does not know: core keeps the set open,
 * and an unknown code is no reason to warn a viewer off a title.
 */
export function availabilityMarker(media: Pick<MediaSummary, 'availability'>): AvailabilityMarkerKind | undefined {
  const code = media.availability;
  return isMarkerKind(code) ? code : undefined;
}

function isMarkerKind(code: string | undefined): code is AvailabilityMarkerKind {
  return code === 'partial' || code === 'unavailable' || code === 'unknown';
}

/**
 * Whether a title may be played or opened: everything but `unavailable`.
 * Partial and unknown titles play as normal.
 *
 * Has no platform dependency, so it belongs in core beside `Availability`;
 * kept here until core has one, and every client applies the same rule.
 */
export function isPlayable(media: Pick<MediaSummary, 'availability'>): boolean {
  return media.availability !== 'unavailable';
}

/** The first item that can take focus, for a row or grid's first focus; -1 if none can. */
export function firstPlayableIndex(items: readonly Pick<MediaSummary, 'availability'>[]): number {
  return items.findIndex(isPlayable);
}

/**
 * A Continue Watching entry's stored copy of its title, without availability.
 *
 * The entry keeps the title as it was when last watched. Availability changes
 * as nodes come and go, so a stored `unavailable` would lock the card after the
 * node holding the file came back. Until core refreshes it, a stored value is
 * not shown at all.
 */
export function withoutStoredAvailability<T extends MediaSummary>(media: T): T {
  if (media.availability === undefined && media.availabilityMembers === undefined) return media;
  const { availability: _availability, availabilityMembers: _members, ...rest } = media;
  return rest as T;
}
