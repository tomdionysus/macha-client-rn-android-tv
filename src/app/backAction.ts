/** The sections the top bar reaches; the root of every stack is one of them. */
export const TOP_LEVEL: ReadonlySet<string> = new Set(['home', 'movies', 'shows', 'music', 'search', 'status', 'settings']);

export type BackAction = 'pop' | 'home' | 'exit';

/**
 * What Back does on a screen that is not the player (the player has its own
 * ladder, `PlayerScreen.tsx`).
 *
 * A level to go back to is always taken. Otherwise every screen goes Home, and
 * **only Home leaves the app**, with no confirmation; the exit waits for
 * storage first (`appExit.ts`). A screen alone on the stack that is not a
 * section goes Home too, since there is nothing to pop to.
 */
export function backAction(route: string, depth: number): BackAction {
  if (depth > 1) return 'pop';
  return route === 'home' ? 'exit' : 'home';
}
