import { useCallback, useMemo } from 'react';
import {
  alphabetIndexKey,
  availableAlphabetKeys,
  type AlphabetIndexKey,
  type MediaSummary,
} from '@machafoundation/core';
import { tvFocus } from './tvFocus';

/**
 * Jump-to-letter for a long library.
 *
 * The bucketing, ordering and folding are all core's — `alphabetIndexKey`
 * knows about leading articles, combining marks and numeric titles, and
 * `availableAlphabetKeys` decides which letters are offerable. Nothing about
 * that is re-derived here.
 *
 * **Where this parts company with the web client.** There, `jumpTo` calls
 * `scrollIntoView` on the target element and stops. On a television that is
 * not enough and is arguably worse than nothing: focus would still be sitting
 * on whatever card it was on before, so the viewer's next D-pad press would
 * scroll straight back and the jump would appear to undo itself. So this moves
 * *focus* to the first title in the bucket, and the library's existing
 * scroll-on-focus does the revealing.
 *
 * That is why focusables can be addressed by a stable id: the registry has to
 * be able to select a specific card by name.
 */

/** The focus-registry id for a media card. One place, so the strip and the grid agree. */
export function mediaFocusId(mediaId: string): string {
  return `media:${mediaId}`;
}

/**
 * Whether an id names a media card, and therefore survives a screen remount.
 *
 * Every other focusable takes a generated `useId`, which is a different string
 * the next time the screen mounts. That distinction is what `App` needs before
 * it tries to put focus back where Back found it: restoring a generated id
 * selects something that will never exist, and the registry then shows no
 * highlight at all until the next key press. Measured on the television
 * 2026-09-21 — the Home rows, whose cards are deliberately not addressable.
 */
export function isMediaFocusId(id: string | undefined): id is string {
  return id !== undefined && id.startsWith('media:');
}

/**
 * The first title in each bucket, in the order the library renders them.
 *
 * Separate and pure so the jump's one real rule — an empty letter does
 * nothing — is testable without a renderer.
 *
 * Relies on `items` already being in `sortMediaByIndexedTitle` order, which is
 * what the library renders: the first match in render order is the title the
 * viewer sees at the top of the bucket.
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
  /** Move focus to the first title in this bucket. No-op for an empty letter. */
  jumpTo: (key: AlphabetIndexKey) => void;
}

export function useAlphabetIndex(items: readonly MediaSummary[]): AlphabetIndexState {
  const firstItemByKey = useMemo(() => firstMediaIdByKey(items), [items]);

  const availableKeys = useMemo(() => availableAlphabetKeys([...items]), [items]);

  const jumpTo = useCallback(
    (key: AlphabetIndexKey) => {
      const mediaId = firstItemByKey.get(key);
      if (!mediaId) return;
      tvFocus.select(mediaFocusId(mediaId));
    },
    [firstItemByKey],
  );

  return { availableKeys, jumpTo };
}
