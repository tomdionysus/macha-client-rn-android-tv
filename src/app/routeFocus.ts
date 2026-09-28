import { isMediaFocusId } from '../hooks/useAlphabetIndex';

/**
 * Where focus goes when the screen changes (`App.tsx`'s route effect).
 *
 * - **keep**: the screen was chosen from the top bar, so focus stays on that
 *   button (Tom, 2026-09-29: "the focus needs to stay on the nav button
 *   selected. It's confusing when it hops to the first title"). Before this
 *   the effect re-seeded to the default; the screen's cards had not fetched,
 *   so the fallback took the nav button *provisionally*, and the first card
 *   claimed focus when it registered, which was the hop.
 * - **restore**: Back, to the card the viewer came up from.
 * - **default**: anything else, such as opening a title.
 *
 * **Not in the web client**, whose `hashchange` listener re-seeds to the
 * default on every route; the scoring weights `tvFocus.test.ts` guards are
 * untouched.
 */
export function routeFocus({ fromNav, remembered }: { fromNav: boolean; remembered: string | undefined }): 'keep' | 'restore' | 'default' {
  if (fromNav) return 'keep';
  return isMediaFocusId(remembered) ? 'restore' : 'default';
}
