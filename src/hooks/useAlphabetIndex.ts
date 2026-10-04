import { useCallback, useMemo } from 'react';
import {
  alphabetIndexKey,
  availableAlphabetKeys,
  type AlphabetIndexKey,
  type MediaSummary,
} from '@machafoundation/core';
import { tvFocus } from './tvFocus';

/**
 * Jump-to-letter for a long library. Bucketing, ordering and folding are
 * core's. Unlike the web client's `scrollIntoView`, a jump moves focus to the
 * bucket's first title: otherwise the next D-pad press scrolls straight back.
 */

/**
 * The focus-registry id for a media card. `rail` names the row, so a title
 * shown in two rails has an id in each and Back returns to the one opened.
 */
export function mediaFocusId(mediaId: string, rail?: string): string {
  return rail ? `media:${rail}:${mediaId}` : `media:${mediaId}`;
}

/**
 * Whether an id names a media card. Only these survive a screen remount: other
 * focusables take a generated `useId`, and restoring one selects nothing and
 * shows no highlight until the next key press.
 */
export function isMediaFocusId(id: string | undefined): id is string {
  return id !== undefined && id.startsWith('media:');
}

/**
 * The first title in each bucket. `items` must already be in
 * `sortMediaByIndexedTitle` order, as the library renders them.
 */
export function firstMediaIdByKey(
  items: readonly MediaSummary[],
): Map<AlphabetIndexKey, string> {
  const result = new Map<AlphabetIndexKey, string>();
  for (const item of items) {
    const key = alphabetIndexKey(item.title);
    if (!result.has(key)) result.set(key, item.id);
  }
  return result;
}

export interface AlphabetIndexState {
  /** Letters with at least one title behind them. The rest render disabled. */
  availableKeys: Set<AlphabetIndexKey>;
  /** Focuses the bucket's first title and answers its id; a no-op, and undefined, for an empty letter. */
  jumpTo: (key: AlphabetIndexKey) => string | undefined;
}

export function useAlphabetIndex(items: readonly MediaSummary[]): AlphabetIndexState {
  const firstItemByKey = useMemo(() => firstMediaIdByKey(items), [items]);

  const availableKeys = useMemo(() => availableAlphabetKeys([...items]), [items]);

  const jumpTo = useCallback(
    (key: AlphabetIndexKey) => {
      const mediaId = firstItemByKey.get(key);
      if (!mediaId) return undefined;
      tvFocus.select(mediaFocusId(mediaId));
      return mediaId;
    },
    [firstItemByKey],
  );

  return { availableKeys, jumpTo };
}
