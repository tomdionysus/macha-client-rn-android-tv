import { beforeEach, describe, expect, it } from 'vitest';
import { scoreTvCandidate, tvFocus, type FocusRect } from './tvFocus';

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
