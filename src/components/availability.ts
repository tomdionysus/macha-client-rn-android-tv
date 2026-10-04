import { availableToPlay, type MediaSummary } from '@machafoundation/core';

/** The marker a title carries at its top left, or none. */
export type AvailabilityMarkerKind = 'partial' | 'unavailable' | 'unknown';

/**
 * Which marker a title shows. None for `complete`, for a title with no
 * availability, or for a code this client does not know (core's set is open).
 */
export function availabilityMarker(media: Pick<MediaSummary, 'availability'>): AvailabilityMarkerKind | undefined {
  const code = media.availability;
  return isMarkerKind(code) ? code : undefined;
}

function isMarkerKind(code: string | undefined): code is AvailabilityMarkerKind {
  return code === 'partial' || code === 'unavailable' || code === 'unknown';
}

/** The first item that can take focus, or -1. */
export function firstAvailableIndex(items: readonly Pick<MediaSummary, 'availability'>[]): number {
  return items.findIndex(availableToPlay);
}

/**
 * How a card answers the D-pad. An unavailable title is never selectable, and
 * focusable only to reach its remove button (Continue Watching).
 */
export function cardInteraction(
  media: Pick<MediaSummary, 'availability'>,
  removable: boolean,
): { focusable: boolean; selectable: boolean } {
  const available = availableToPlay(media);
  return { focusable: available || removable, selectable: available };
}
