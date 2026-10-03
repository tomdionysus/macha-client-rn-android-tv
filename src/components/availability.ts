import { availableToPlay, type MediaSummary } from '@machafoundation/core';

/** The marker a title carries at its top left, or none. */
export type AvailabilityMarkerKind = 'partial' | 'unavailable' | 'unknown';

/**
 * Which marker a title shows, the same in every client and every context:
 * a yellow warning triangle for `partial`, a red crossed circle for
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

/** The first item that can take focus, for a row or grid's first focus; -1 if none can. */
export function firstAvailableIndex(items: readonly Pick<MediaSummary, 'availability'>[]): number {
  return items.findIndex(availableToPlay);
}
