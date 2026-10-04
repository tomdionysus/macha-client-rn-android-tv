/** The sections the top bar reaches; the root of every stack is one of them. */
export const TOP_LEVEL: ReadonlySet<string> = new Set(['home', 'movies', 'shows', 'music', 'search', 'status', 'settings']);

export type BackAction = 'pop' | 'home' | 'exit';

/**
 * Back on any screen but the player (`PlayerScreen.tsx` has its own ladder):
 * pop if there is a level below, otherwise go Home. Only Home exits, after
 * the storage flush (`appExit.ts`).
 */
export function backAction(route: string, depth: number): BackAction {
  if (depth > 1) return 'pop';
  return route === 'home' ? 'exit' : 'home';
}
