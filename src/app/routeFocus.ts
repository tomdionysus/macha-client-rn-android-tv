import { isMediaFocusId } from '../hooks/useAlphabetIndex';

/**
 * Where focus goes when the screen changes (`App.tsx`'s route effect).
 *
 * - **keep**: the screen was chosen from the top bar, so focus stays on that
 *   button. Re-seeding to the default would let the nav button hold focus only
 *   provisionally, until the first card registered and took it.
 * - **restore**: Back, to the card the viewer came up from.
 * - **default**: anything else, such as opening a title.
 *
 * **Not in the web client**, whose `hashchange` listener re-seeds to the
 * default on every route; the scoring weights `tvFocus.test.ts` guards are
 * unaffected.
 */
export function routeFocus({ fromNav, remembered }: { fromNav: boolean; remembered: string | undefined }): 'keep' | 'restore' | 'default' {
  if (fromNav) return 'keep';
  return isMediaFocusId(remembered) ? 'restore' : 'default';
}
