import { beforeEach, describe, expect, it } from 'vitest';
import { pickTvCandidate, scoreTvCandidate, tvFocus, type FocusRect } from './tvFocus';

function rect(left: number, top: number, width = 50, height = 50): FocusRect {
  return { left, top, width, height };
}

/**
 * The scorer is a port of the web client's `scoreTvCandidate`, so these assert
 * the behaviour that port has to preserve rather than an implementation of it.
 * If the web client's weights change, these should fail.
 */
describe('spatial focus scoring', () => {
  it('rejects candidates behind the direction of travel', () => {
    const current = rect(100, 100);
    expect(scoreTvCandidate(current, rect(100, 0), 'down')).toBeNull();
    expect(scoreTvCandidate(current, rect(100, 200), 'up')).toBeNull();
    expect(scoreTvCandidate(current, rect(0, 100), 'right')).toBeNull();
    expect(scoreTvCandidate(current, rect(200, 100), 'left')).toBeNull();
  });

  it('rejects a candidate exactly on top of the current element', () => {
    const current = rect(100, 100);
    for (const direction of ['up', 'down', 'left', 'right'] as const) {
      expect(scoreTvCandidate(current, current, direction)).toBeNull();
    }
  });

  it('prefers the nearer of two candidates in the same lane', () => {
    const current = rect(0, 0);
    const near = scoreTvCandidate(current, rect(0, 100), 'down');
    const far = scoreTvCandidate(current, rect(0, 300), 'down');
    expect(near).not.toBeNull();
    expect(far).not.toBeNull();
    expect(near!).toBeLessThan(far!);
  });

  /**
   * The lane-gap penalty is the weight that keeps focus inside a row or column
   * rather than cutting diagonally across a grid. A candidate slightly further
   * away but in the same lane must beat a closer one in a different lane.
   */
  it('penalises leaving the current lane six-fold', () => {
    const current = rect(0, 0);
    const sameLaneFurther = scoreTvCandidate(current, rect(0, 140), 'down');
    const otherLaneNearer = scoreTvCandidate(current, rect(400, 100), 'down');
    expect(sameLaneFurther!).toBeLessThan(otherLaneNearer!);
  });

  it('discounts cross-axis drift to a fifth of primary distance', () => {
    const current = rect(0, 0);
    // Both candidates are 100 below; one is offset horizontally but still
    // overlapping the lane, so only the secondary term separates them.
    const aligned = scoreTvCandidate(current, rect(0, 100), 'down')!;
    const drifted = scoreTvCandidate(current, rect(40, 100), 'down')!;
    expect(drifted - aligned).toBeCloseTo(40 * 0.2, 5);
  });

  it('scores horizontally using the same rules on the other axis', () => {
    const current = rect(0, 0);
    const near = scoreTvCandidate(current, rect(100, 0), 'right')!;
    const far = scoreTvCandidate(current, rect(300, 0), 'right')!;
    expect(near).toBeLessThan(far);
  });
});

describe('suspension', () => {
  beforeEach(() => {
    // The registry is a module singleton; a leaked suspension would make every
    // later test in this file silently pass by doing nothing.
    while (tvFocus.suspended) tvFocus.suspend()();
  });

  it('is not suspended by default', () => {
    expect(tvFocus.suspended).toBe(false);
  });

  it('reports suspension while a token is held', () => {
    const resume = tvFocus.suspend();
    expect(tvFocus.suspended).toBe(true);
    resume();
    expect(tvFocus.suspended).toBe(false);
  });

  it('refuses every command while suspended, so the platform gets the key', () => {
    const resume = tvFocus.suspend();
    expect(tvFocus.handle('down')).toBe(false);
    expect(tvFocus.handle('activate')).toBe(false);
    resume();
  });

  it('does not even notify command observers, which would wake player chrome', () => {
    const seen: string[] = [];
    const stop = tvFocus.onCommand((command) => seen.push(command));
    const resume = tvFocus.suspend();
    tvFocus.handle('down');
    expect(seen).toEqual([]);
    resume();
    tvFocus.handle('down');
    expect(seen).toEqual(['down']);
    stop();
  });

  it('nests, so a menu over a search field resumes independently', () => {
    const outer = tvFocus.suspend();
    const inner = tvFocus.suspend();
    inner();
    expect(tvFocus.suspended).toBe(true);
    outer();
    expect(tvFocus.suspended).toBe(false);
  });

  it('recovers from a suspension whose holder went away', () => {
    // The 0.3.0 failure, as a test. Android TV keeps a ReactEditText natively
    // focused after the IME closes, so `onBlur` never fired, the token stayed
    // in a ref on an unreachable component, and the remote stopped working
    // entirely with nothing on screen to explain it. Reference counting cannot
    // recover from a lost token by construction, so there has to be a way out.
    tvFocus.suspend();
    tvFocus.suspend();
    expect(tvFocus.suspended).toBe(true);

    tvFocus.resumeAll();

    expect(tvFocus.suspended).toBe(false);
  });

  it('is idempotent per token, so a double resume cannot lift another suspension', () => {
    const first = tvFocus.suspend();
    const second = tvFocus.suspend();
    first();
    first();
    expect(tvFocus.suspended).toBe(true);
    second();
    expect(tvFocus.suspended).toBe(false);
  });

  it('leaves selection alone, unlike a scope', () => {
    const stop = tvFocus.register({ id: 'a', activate: () => undefined });
    tvFocus.select('a');
    const resume = tvFocus.suspend();
    resume();
    expect(tvFocus.selected()).toBe('a');
    stop();
  });
});

/**
 * The bug these exist for: on the first device run all 46 focusables measured
 * *before* they registered, every rectangle was discarded, and the scorer never
 * ran — focus fell back to registration order for the whole session. Nothing in
 * this file could have caught it, because nothing here exercised the order in
 * which the two arrive.
 */
describe('geometry arriving out of order', () => {
  beforeEach(() => {
    while (tvFocus.suspended) tvFocus.suspend()();
  });

  it('keeps a rectangle that arrives before registration', () => {
    tvFocus.measure('early', { left: 10, top: 20, width: 100, height: 50 });
    const stop = tvFocus.register({ id: 'early' });
    // Proven through behaviour rather than a getter: a scored move only happens
    // when the current element has geometry.
    expect(tvFocus.debugGeometry()).toContain('measured=1');
    stop();
  });

  it('keeps geometry across a re-registration', () => {
    const stop = tvFocus.register({ id: 'again' });
    tvFocus.measure('again', { left: 0, top: 0, width: 10, height: 10 });
    const stopAgain = tvFocus.register({ id: 'again', disabled: false });
    expect(tvFocus.debugGeometry()).toContain('measured=1');
    stopAgain();
    stop();
  });

  it('keeps geometry when an element is disabled and enabled again in place', () => {
    // React re-runs a registration by calling the old cleanup *first*, which
    // deletes the entry and its rectangle; the element then comes back with no
    // geometry and the scorer cannot move from it. So `useFocusable` patches
    // `disabled` through `update` instead of re-registering, and this is the
    // contract it relies on. (The hook itself has no renderer to run under here.)
    const card = tvFocus.register({ id: 'toggle-card' });
    const button = tvFocus.register({ id: 'toggle-button', disabled: true });
    tvFocus.measure('toggle-card', { left: 0, top: 0, width: 100, height: 100 });
    tvFocus.measure('toggle-button', { left: 200, top: 0, width: 50, height: 50 });

    tvFocus.select('toggle-card');
    expect(tvFocus.handle('right')).toBe(false);

    tvFocus.update('toggle-button', { disabled: false });
    expect(tvFocus.handle('right')).toBe(true);
    expect(tvFocus.selected()).toBe('toggle-button');
    // Moving back needs the button's own rectangle, which a re-registration lost.
    expect(tvFocus.handle('left')).toBe(true);
    expect(tvFocus.selected()).toBe('toggle-card');
    card();
    button();
  });

  it('forgets a held rectangle when the focusable never arrives', () => {
    tvFocus.measure('ghost', { left: 0, top: 0, width: 10, height: 10 });
    const stop = tvFocus.register({ id: 'ghost' });
    stop();
    // Re-registering must not resurrect geometry from a previous mount, which
    // would place the element where it used to be.
    const again = tvFocus.register({ id: 'ghost' });
    expect(tvFocus.debugGeometry()).toContain('measured=0');
    again();
  });

  it('scores by geometry rather than registration order once measured', () => {
    // Registered right-to-left, laid out left-to-right: a sequential fallback
    // would move the wrong way, which is precisely what the television did.
    const right = tvFocus.register({ id: 'right' });
    const left = tvFocus.register({ id: 'left' });
    tvFocus.measure('right', { left: 500, top: 0, width: 100, height: 100 });
    tvFocus.measure('left', { left: 0, top: 0, width: 100, height: 100 });

    tvFocus.select('left');
    expect(tvFocus.handle('right')).toBe(true);
    expect(tvFocus.selected()).toBe('right');

    expect(tvFocus.handle('left')).toBe(true);
    expect(tvFocus.selected()).toBe('left');
    right();
    left();
  });

  it('prefers the element below over the next one registered, for a down press', () => {
    // The exact television symptom: from a nav item, Down went sideways to the
    // next nav item because that was next in registration order.
    const navA = tvFocus.register({ id: 'nav-a' });
    const navB = tvFocus.register({ id: 'nav-b' });
    const card = tvFocus.register({ id: 'card' });
    tvFocus.measure('nav-a', { left: 0, top: 0, width: 80, height: 40 });
    tvFocus.measure('nav-b', { left: 100, top: 0, width: 80, height: 40 });
    tvFocus.measure('card', { left: 0, top: 300, width: 150, height: 250 });

    tvFocus.select('nav-a');
    tvFocus.handle('down');
    expect(tvFocus.selected()).toBe('card');
    navA();
    navB();
    card();
  });
});

/**
 * Revealing focus before moving it.
 *
 * `current()` invents an answer when `selectedId` names nothing reachable —
 * after a scope change, or after the screen that owned the selection
 * unmounted. Moving *from* that invented element skipped it, and in a
 * direction with no candidate selected nothing at all, which is a screen whose
 * D-pad does nothing and shows no focus ring.
 */
describe('the first press on a screen with no selection', () => {
  /** Two focusables side by side, with geometry, in the default scope. */
  function mountRow(): () => void {
    const offs = [
      tvFocus.register({ id: 'left-button', activate: () => undefined }),
      tvFocus.register({ id: 'right-button', activate: () => undefined }),
    ];
    tvFocus.measure('left-button', rect(0, 100));
    tvFocus.measure('right-button', rect(200, 100));
    // `register` queues a default focus on a microtask; clear it so these
    // assert the no-selection case deliberately rather than by accident.
    tvFocus.select(undefined);
    return () => { for (const off of offs) off(); };
  }

  beforeEach(() => {
    while (tvFocus.suspended) tvFocus.suspend()();
  });

  it('reveals focus rather than doing nothing, even with no candidate that way', () => {
    const stop = mountRow();
    expect(tvFocus.selected()).toBeUndefined();

    // Nothing is above either element. Before the fix this returned false and
    // left the screen with no selection and no ring.
    expect(tvFocus.handle('up')).toBe(true);
    expect(tvFocus.selected()).toBeDefined();

    stop();
  });

  it('does not skip the first element when a candidate does exist', () => {
    const stop = mountRow();
    tvFocus.select(undefined);

    tvFocus.handle('right');
    expect(tvFocus.selected()).toBe('left-button');

    stop();
  });

  it('moves normally once something is genuinely selected', () => {
    const stop = mountRow();
    tvFocus.select('left-button');

    expect(tvFocus.handle('right')).toBe(true);
    expect(tvFocus.selected()).toBe('right-button');

    stop();
  });
});

/**
 * Restoring focus across a screen change, which is what Back owes a viewer.
 *
 * Pressing Back out of a detail screen should put the highlight back on the
 * poster it was opened from. The registry already lets something name that
 * card — `mediaFocusId` — but the two events arrive in the wrong order: the
 * screen selects the remembered id while the grid is still fetching, and the
 * card registers a moment later. Selection survives that (it is only a
 * string), but the *card* never learns, because `select` notifies whatever is
 * registered at the time and registration notifies nothing.
 *
 * Measured on the television 2026-09-21: Back from a detail screen left the
 * highlight on the navigation bar, and the viewer's place in a grid of several
 * hundred films was gone.
 */
describe('an element that mounts into an existing selection', () => {
  beforeEach(() => {
    tvFocus.resumeAll();
    tvFocus.select(undefined);
  });

  it('is told it is focused, because select fired before it existed', () => {
    tvFocus.select('media:m1');

    let focused: boolean | undefined;
    const stop = tvFocus.register({ id: 'media:m1', onFocusChange: (value) => (focused = value) });

    expect(focused).toBe(true);
    stop();
  });

  it('leaves an element that is not the selected one alone', () => {
    tvFocus.select('media:m1');

    let focused: boolean | undefined;
    const stop = tvFocus.register({ id: 'media:m2', onFocusChange: (value) => (focused = value) });

    expect(focused).toBeUndefined();
    stop();
  });
})

/**
 * A restore that outlives the fetch, which is what a library screen needs.
 *
 * `App` remembers the card Back should return to, but the screen it returns to
 * re-mounts and re-fetches: measured on the television 2026-09-21, the grid's
 * cards had not registered by the time the route effect ran, so a restore
 * attempted there found nothing and fell back to the default — the navigation
 * bar — which is the very fault it was written to fix.
 *
 * So the restore is armed rather than applied, and registration claims it. It
 * is abandoned the moment the viewer presses anything, because focus jumping
 * under a hand already moving is worse than focus starting in the wrong place.
 */
describe('a restore armed before its card exists', () => {
  beforeEach(() => {
    tvFocus.resumeAll();
    tvFocus.select(undefined);
    tvFocus.restoreWhenPresent(undefined);
  });

  it('is claimed by the card when it finally registers', () => {
    tvFocus.restoreWhenPresent('media:m1');
    tvFocus.focusDefault();

    let focused: boolean | undefined;
    const stop = tvFocus.register({ id: 'media:m1', onFocusChange: (value) => (focused = value) });

    expect(tvFocus.selected()).toBe('media:m1');
    expect(focused).toBe(true);
    stop();
  });

  it('applies immediately when the card is already there', () => {
    const stop = tvFocus.register({ id: 'media:m2' });
    tvFocus.restoreWhenPresent('media:m2');
    expect(tvFocus.selected()).toBe('media:m2');
    stop();
  });

  it('is abandoned once the viewer presses a key, so focus is not yanked', () => {
    const first = tvFocus.register({ id: 'a' });
    tvFocus.select('a');
    tvFocus.restoreWhenPresent('media:m3');

    tvFocus.handle('down');

    const late = tvFocus.register({ id: 'media:m3' });
    expect(tvFocus.selected()).not.toBe('media:m3');
    first();
    late();
  });
})

/**
 * Measured on `.133`, 2026-09-23: opening a series from TV Shows left focus on
 * the top bar's Home, so the viewer's next OK sent them Home. The screen's
 * default card — its first season — registers only after the series is
 * fetched, and `focusDefault` had already fallen back to the first thing on
 * screen by then.
 */
describe('a default that registers after the screen has fallen back', () => {
  beforeEach(() => {
    tvFocus.resumeAll();
    tvFocus.select(undefined);
    tvFocus.restoreWhenPresent(undefined);
  });

  it('takes focus from the fallback the viewer never chose', () => {
    const nav = tvFocus.register({ id: 'nav-home' });
    tvFocus.focusDefault();
    expect(tvFocus.selected()).toBe('nav-home');

    const card = tvFocus.register({ id: 'season-1', defaultFocus: true });
    expect(tvFocus.selected()).toBe('season-1');
    nav();
    card();
  });

  it('does not take focus the viewer moved themselves', () => {
    const nav = tvFocus.register({ id: 'nav-home' });
    const other = tvFocus.register({ id: 'nav-movies' });
    tvFocus.focusDefault();
    tvFocus.select('nav-movies');

    const card = tvFocus.register({ id: 'season-1', defaultFocus: true });
    expect(tvFocus.selected()).toBe('nav-movies');
    nav();
    other();
    card();
  });

  it('does not take focus a default already holds', () => {
    const first = tvFocus.register({ id: 'first', defaultFocus: true });
    tvFocus.focusDefault();
    const second = tvFocus.register({ id: 'second', defaultFocus: true });
    expect(tvFocus.selected()).toBe('first');
    first();
    second();
  });

  it('gives way to a restore that is waiting for its card', () => {
    const nav = tvFocus.register({ id: 'nav-home' });
    tvFocus.focusDefault();
    tvFocus.restoreWhenPresent('media:ep-3');

    const card = tvFocus.register({ id: 'season-1', defaultFocus: true });
    const restored = tvFocus.register({ id: 'media:ep-3' });
    expect(tvFocus.selected()).toBe('media:ep-3');
    nav();
    card();
    restored();
  });
});

/**
 * Search's control row, measured off `.133` on 2026-09-24 (1920-wide
 * screenshot): a field that takes most of the width, the sort control to its
 * right, and a row of result cards below.
 *
 * Tom, the same night: "moving right on the D-pad from search drops into the
 * results". Scoring from centres made anything whose centre lay right of the
 * wide field's centre count as "right" of it, and a card one row down was
 * nearer than the sort control on the same row.
 */
describe('a wide element beside smaller ones', () => {
  const field = { id: 'field', rect: rect(58, 172, 1264, 46) };
  const sort = { id: 'sort', rect: rect(1340, 172, 152, 46) };
  const cards = [62, 290, 518, 746, 974, 1202, 1430, 1658].map((left, index) => ({
    id: `card-${index}`,
    rect: rect(left, 250, 200, 360),
  }));

  it('moves right along its own row, not down into the row below', () => {
    expect(pickTvCandidate(field.rect, [sort, ...cards], 'right')?.id).toBe('sort');
  });

  it('prefers a far control on its own row to a near one on the next', () => {
    const refresh = { id: 'refresh', rect: rect(1812, 172, 46, 46) };
    expect(pickTvCandidate(field.rect, [refresh, ...cards], 'right')?.id).toBe('refresh');
  });

  it('still steps sideways along a row of cards', () => {
    expect(pickTvCandidate(cards[1]!.rect, [field, sort, ...cards.filter((_, i) => i !== 1)], 'right')?.id).toBe(
      'card-2',
    );
  });

  it('still goes down from the field into the results', () => {
    expect(pickTvCandidate(field.rect, [sort, ...cards], 'down')?.id).toMatch(/^card-/);
  });
});

/**
 * Tom, 2026-09-24: going down from a row and straight back up should land on
 * the control the viewer left, not on whatever happens to be nearest.
 */
describe('reversing a move', () => {
  beforeEach(() => {
    tvFocus.resumeAll();
    tvFocus.select(undefined);
    tvFocus.restoreWhenPresent(undefined);
  });

  function place(id: string, r: FocusRect): () => void {
    const stop = tvFocus.register({ id });
    tvFocus.measure(id, r);
    return stop;
  }

  // Search's row: the wide field, then the sort control; results below. The
  // cards sit under the field's right end, so Up from them is — by geometry —
  // the field.
  const layout = (): (() => void)[] => [
    place('field', rect(58, 172, 1264, 46)),
    place('sort', rect(1340, 172, 152, 46)),
    place('card-a', rect(872, 250, 200, 360)),
    place('card-b', rect(1100, 250, 200, 360)),
  ];

  it('returns to the element it came from, where geometry would choose another', () => {
    const stops = layout();
    tvFocus.select('sort');
    tvFocus.handle('down');
    expect(tvFocus.selected()).toBe('card-b');
    tvFocus.handle('up');
    expect(tvFocus.selected()).toBe('sort');
    stops.forEach((stop) => stop());
  });

  it('forgets once the viewer moves another way', () => {
    const stops = layout();
    tvFocus.select('sort');
    tvFocus.handle('down');
    tvFocus.handle('left');
    expect(tvFocus.selected()).toBe('card-a');
    tvFocus.handle('up');
    expect(tvFocus.selected()).toBe('field');
    stops.forEach((stop) => stop());
  });
});

/**
 * Home, measured off `.133` on 2026-09-24: the top bar, a Continue Watching
 * row of three cards at the left, and a full Movies row below. Up from a
 * Movies card with nothing directly above it in Continue Watching went
 * straight to the top bar — the column-first reading of "row first" skipping a
 * whole row.
 */
describe('moving between rows', () => {
  const nav = [
    { id: 'nav-home', rect: rect(740, 20, 60, 40) },
    { id: 'nav-search', rect: rect(1040, 20, 70, 40) },
  ];
  const cw = [60, 290, 520].map((left, index) => ({ id: `cw-${index}`, rect: rect(left, 140, 200, 330) }));
  const movies = [60, 290, 520, 745, 975].map((left, index) => ({
    id: `movie-${index}`,
    rect: rect(left, 640, 200, 320),
  }));

  it('goes up to the row above, not over it to the top bar', () => {
    const hellboy = movies[4]!;
    expect(pickTvCandidate(hellboy.rect, [...nav, ...cw, ...movies.slice(0, 4)], 'up')?.id).toBe('cw-2');
  });

  it('still reaches the top bar from the first row', () => {
    expect(pickTvCandidate(cw[0]!.rect, [...nav, ...cw.slice(1), ...movies], 'up')?.id).toMatch(/^nav-/);
  });
});

/**
 * `.133`, 2026-09-24: Left from Home — the first item in the top bar — left
 * the bar for the Arrival card below it, because with nothing further left in
 * its own row the move fell back to anything to the left in any row.
 */
describe('the end of a row', () => {
  const home = { id: 'nav-home', rect: rect(740, 20, 60, 40) };
  const movies = { id: 'nav-movies', rect: rect(820, 20, 80, 40) };
  const arrival = { id: 'cw-0', rect: rect(60, 140, 200, 330) };

  it('stops a sideways move rather than dropping into another row', () => {
    expect(pickTvCandidate(home.rect, [movies, arrival], 'left')).toBeUndefined();
  });

  it('still moves along the row it is in', () => {
    expect(pickTvCandidate(movies.rect, [home, arrival], 'left')?.id).toBe('nav-home');
  });
});

/**
 * Tom, 2026-09-24: "the focus always jumps to Home on this page regardless of
 * how it has been accessed". A screen's own default registers only after its
 * content is fetched, so the fallback was always the first thing on screen —
 * the top bar's Home. The fallback now prefers the nav item the viewer last
 * used, remembered for the life of the app.
 */
describe('the fallback remembers the last nav item used', () => {
  beforeEach(() => {
    tvFocus.resumeAll();
    tvFocus.select(undefined);
    tvFocus.restoreWhenPresent(undefined);
  });

  it('falls back to the nav item the viewer last chose, not the first on screen', () => {
    const home = tvFocus.register({ id: 'nav:home' });
    const movies = tvFocus.register({ id: 'nav:movies' });
    tvFocus.select('nav:movies');
    tvFocus.select(undefined);

    tvFocus.focusDefault();
    expect(tvFocus.selected()).toBe('nav:movies');
    home();
    movies();
  });

  it('does not remember a nav item the fallback chose on its own', () => {
    const home = tvFocus.register({ id: 'nav:home' });
    const settings = tvFocus.register({ id: 'nav:settings' });
    tvFocus.select('nav:settings');
    const settingsGone = settings;
    settingsGone();
    tvFocus.focusDefault();
    expect(tvFocus.selected()).toBe('nav:home');

    const back = tvFocus.register({ id: 'nav:settings' });
    tvFocus.select(undefined);
    tvFocus.focusDefault();
    expect(tvFocus.selected()).toBe('nav:settings');
    home();
    back();
  });

  it('still lets a screen default that registers later take over', () => {
    const movies = tvFocus.register({ id: 'nav:movies' });
    tvFocus.select('nav:movies');
    tvFocus.select(undefined);
    tvFocus.focusDefault();
    const card = tvFocus.register({ id: 'season-1', defaultFocus: true });
    expect(tvFocus.selected()).toBe('season-1');
    movies();
    card();
  });
});
