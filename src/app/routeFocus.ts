import { isMediaFocusId } from '../hooks/useAlphabetIndex';

/**
 * Where focus goes when the screen changes (`App.tsx`'s route effect).
 * - keep: chosen from the top bar, so focus stays on that button.
 * - restore: Back, to the card the viewer came up from.
 * - default: anything else.
 *
 * Not in the web client, which re-seeds to the default on every route.
 */
export function routeFocus({ fromNav, remembered }: { fromNav: boolean; remembered: string | undefined }): 'keep' | 'restore' | 'default' {
  if (fromNav) return 'keep';
  return isMediaFocusId(remembered) ? 'restore' : 'default';
}
