/** The sections the top bar reaches; the root of every stack is one of them. */
export const TOP_LEVEL: ReadonlySet<string> = new Set(['home', 'movies', 'shows', 'music', 'search', 'status', 'settings']);

export type BackAction = 'pop' | 'home' | 'exit';

/**
 * What Back does on a screen that is not the player (the player has its own
 * ladder, `PlayerScreen.tsx`).
 *
 * A level to go back to is always taken. On a top-level screen Back is the
 * platform's, and that is how a viewer leaves the app, with one exception:
 * **Settings goes Home** (Tom, 2026-09-28: "'Back' on settings should go to
 * Home, not exit the app"). The other sections still leave, as §3.5 of
 * `TODO/ACTIVE.md` records; Tom's ruling named Settings alone.
 */
export function backAction(route: string, depth: number): BackAction {
  if (depth > 1 || !TOP_LEVEL.has(route)) return 'pop';
  return route === 'settings' ? 'home' : 'exit';
}
