/**
 * The D-pad focus model, ported from the web client's `useTvNavigation.ts`.
 *
 * The scoring is reproduced rather than reinterpreted. Android's own focus
 * engine would also move focus around, but it would move it *differently* —
 * and the requirement is that this client behaves like the web TV client, not
 * merely that it is navigable. So the geometry, the weights and the tie-breaks
 * below are the same ones `scoreTvCandidate` uses in the browser.
 *
 * The DOM's `[data-tv-focusable="true"]` query becomes an explicit registry:
 * React Native has no document to query, so every focusable registers itself
 * and reports its measured rectangle.
 */

export type TvDirection = 'up' | 'down' | 'left' | 'right';
export type TvCommand = TvDirection | 'activate' | 'back';

export interface FocusRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Focusable {
  id: string;
  rect?: FocusRect;
  /** Registration order, the fallback when geometry is unavailable. */
  order: number;
  disabled?: boolean;
  defaultFocus?: boolean;
  /**
   * Scope this focusable belongs to.
   *
   * The web client scopes candidates to `.player-chrome.visible` when the
   * full-screen player is up, so hidden chrome cannot be focused. An exclusive
   * scope here does the same job.
   */
  scope?: string;
  activate?: () => void;
  onFocusChange?: (focused: boolean) => void;
  /**
   * Directions this element keeps rather than yielding to the focus scorer.
   *
   * The web client's `tvRangeOwnsDirection`: a focused `input[type=range]`
   * owns left and right, because those are how a viewer scrubs. Everything
   * else still moves focus, so up and down remain the way out — an element
   * that kept all four would be one the viewer could not leave.
   */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
}

/** Distance between two spans on one axis; zero when they overlap. */
function rectGap(start: number, size: number, otherStart: number, otherSize: number): number {
  const end = start + size;
  const otherEnd = otherStart + otherSize;
  if (otherEnd < start) return start - otherEnd;
  if (otherStart > end) return otherStart - end;
  return 0;
}

/**
 * The web client's candidate score, with its geometry taken from edges rather
 * than centres (Tom, 2026-09-24 — see below).
 *
 * The weights are the port's and unchanged: primary-axis distance dominates;
 * cross-axis drift is discounted to a fifth so a slightly-offset neighbour
 * still wins over a distant aligned one; and a lane gap is penalised six-fold
 * so focus prefers staying within a row or column.
 *
 * **What changed, and why.** The port judged "is it to the right?" and "how
 * far?" from the two centres. For a wide element — Search's field, which takes
 * most of a row — the centre is nowhere near the edge a viewer is moving
 * towards, so every card whose centre lay right of the field's middle counted
 * as "right" of it, and one a row down beat the sort control beside it. Tom:
 * "moving right on the D-pad from search drops into the results".
 *
 * So a candidate is in the direction of travel only when its centre is past
 * the current element's *edge* on that side, and the primary distance is the
 * gap between the facing edges. For two equal cards in a grid this chooses
 * exactly what the centre rule chose; it differs only where sizes differ,
 * which is where the centre rule was wrong. **The web client made the same
 * change the same night** (its develop `50a2ff7`, "TV focus: judge direction from edges
 * and prefer the current row"), after its own tests of these cases failed
 * first — so the two ports still agree.
 */
export function scoreTvCandidate(
  current: FocusRect,
  candidate: FocusRect,
  direction: TvDirection,
): number | null {
  const cx = current.left + current.width / 2;
  const cy = current.top + current.height / 2;
  const tx = candidate.left + candidate.width / 2;
  const ty = candidate.top + candidate.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;

  if (direction === 'left' && tx >= current.left) return null;
  if (direction === 'right' && tx <= current.left + current.width) return null;
  if (direction === 'up' && ty >= current.top) return null;
  if (direction === 'down' && ty <= current.top + current.height) return null;

  const horizontal = direction === 'left' || direction === 'right';
  const primary = horizontal
    ? rectGap(current.left, current.width, candidate.left, candidate.width)
    : rectGap(current.top, current.height, candidate.top, candidate.height);
  const secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
  const laneGap = horizontal
    ? rectGap(current.top, current.height, candidate.top, candidate.height)
    : rectGap(current.left, current.width, candidate.left, candidate.width);

  return primary + secondary * 0.2 + laneGap * 6;
}

/**
 * Which candidate a direction moves to, from the current element's rectangle.
 *
 * Pure, so the choice can be tested with the geometry of a real screen rather
 * than through a registry.
 */
export function pickTvCandidate<T extends { rect: FocusRect }>(
  current: FocusRect,
  candidates: readonly T[],
  direction: TvDirection,
): T | undefined {
  const scored = candidates
    .map((entry) => ({ entry, score: scoreTvCandidate(current, entry.rect, direction) }))
    .filter((item): item is { entry: T; score: number } => item.score !== null);
  const byScore = (a: { score: number }, b: { score: number }) => a.score - b.score;
  const horizontal = direction === 'left' || direction === 'right';

  // **Left and right: the row first.** When anything in the direction of
  // travel shares the current element's row, only those compete; the next row
  // is where a move goes once its own row has run out. The lane penalty alone
  // could not promise this — a far control on the same row lost to a near card
  // on the next (Search: field → refresh past a results row).
  if (horizontal) {
    const sameRow = scored.filter(
      ({ entry }) => rectGap(current.top, current.height, entry.rect.top, entry.rect.height) === 0,
    );
    return (sameRow.length > 0 ? sameRow : scored).sort(byScore)[0]?.entry;
  }

  // **Up and down: the nearest row first, then the best of it.** Not "the same
  // column first": that reading skipped a whole row on Home — Up from a Movies
  // card with nothing directly above it in a short Continue Watching row went
  // straight to the top bar (`.133`, 2026-09-24). A viewer reads Up as "the
  // row above". So the row is the band of candidates overlapping, vertically,
  // the one whose facing edge is nearest; the usual score chooses within it.
  const nearest = [...scored].sort(
    (a, b) =>
      rectGap(current.top, current.height, a.entry.rect.top, a.entry.rect.height) -
      rectGap(current.top, current.height, b.entry.rect.top, b.entry.rect.height),
  )[0];
  if (!nearest) return undefined;
  const row = scored.filter(
    ({ entry }) => rectGap(nearest.entry.rect.top, nearest.entry.rect.height, entry.rect.top, entry.rect.height) === 0,
  );
  return row.sort(byScore)[0]?.entry;
}

function sequentialCandidate(
  elements: Focusable[],
  current: Focusable,
  direction: TvDirection,
): Focusable | undefined {
  const index = elements.indexOf(current);
  if (index < 0) return elements[0];
  const delta = direction === 'left' || direction === 'up' ? -1 : 1;
  const next = index + delta;
  return next >= 0 && next < elements.length ? elements[next] : undefined;
}

type Listener = (selectedId: string | undefined) => void;

class TvFocusRegistry {
  private focusables = new Map<string, Focusable>();
  private listeners = new Set<Listener>();
  private commandListeners = new Set<(command: TvCommand) => void>();
  private scopes: string[] = [];
  private selectedId: string | undefined;
  private sequence = 0;
  private suspensions = new Set<symbol>();

  /**
   * Rectangles that arrived before their focusable registered.
   *
   * **This is not a rare race, it is the normal order.** Registration is a
   * passive effect, which React defers; Fabric dispatches `onLayout` from
   * native the moment layout commits. On the first device run every one of 46
   * focusables measured before it registered, so every rectangle was dropped
   * and the scorer never ran once — focus fell back to registration order for
   * the entire session.
   */
  private pendingRects = new Map<string, FocusRect>();

  /**
   * A card Back should return to, which may not have mounted yet.
   *
   * Armed rather than applied, because the screen being returned to re-fetches:
   * on the television the grid's cards had not registered by the time the route
   * effect ran, so a restore applied there found nothing. Registration claims
   * it; the first command the viewer sends abandons it.
   */
  private pendingRestoreId: string | undefined;

  /**
   * The selection is a fallback nobody chose: `focusDefault` found no element
   * marked `defaultFocus` and took the first thing on screen instead.
   *
   * Measured on `.133`, 2026-09-23 — a screen's default card registers only
   * after its content is fetched, so the fallback is usually the top bar. The
   * series screen opened with Home selected and the viewer's OK went there.
   * While this holds, a `defaultFocus` element that registers takes over; any
   * real selection — a key, a restore, an explicit `select` — clears it.
   *
   * **Not in the web client**, whose DOM autofocus runs after render; the
   * scoring weights `tvFocus.test.ts` guards are untouched by this.
   */
  private provisional = false;

  /**
   * The last move the D-pad made, so the opposite press can undo it.
   *
   * Tom, 2026-09-24: going down from a row and straight back up should land
   * on the control the viewer left, not on whatever geometry finds nearest
   * from where they now are. Only the move just made is remembered, and any
   * other selection — another direction, a restore, a default — forgets it,
   * so the rule stays one a viewer can predict: *the opposite press undoes
   * the last one*. **Not in the web client, by Tom's decision (2026-09-24)** — the
   * one place the two focus ports deliberately differ.
   */
  private lastMove: { from: string; to: string; direction: TvDirection } | undefined;

  register(focusable: Omit<Focusable, 'order'>): () => void {
    const existing = this.focusables.get(focusable.id);
    // Keep the original order across a re-registration, so a focusable that
    // re-registers because a prop changed does not jump to the end of the
    // sequential fallback and reorder the screen under the viewer.
    const order = existing?.order ?? this.sequence++;
    // Geometry outlives registration: it may have arrived first (the usual
    // case), or already be held from before a re-registration. Rebuilding the
    // entry without it would silently drop the screen back to sequential
    // navigation.
    const rect = existing?.rect ?? this.pendingRects.get(focusable.id);
    this.focusables.set(focusable.id, { ...focusable, order, ...(rect ? { rect } : {}) });
    this.pendingRects.delete(focusable.id);
    // An element can mount *into* an existing selection, and registration is
    // the only moment it can find that out: `select` notifies whatever is
    // registered when it runs, and a card restored by name after Back is
    // selected while its grid is still fetching. Without this the selection is
    // real — arrows move from it — and nothing on screen is highlighted.
    //
    // **Not in the web client.** There the DOM holds focus and the browser
    // restores it; here the registry is the only memory there is. If that port
    // grows the same restore, this reconciliation is what it needs too.
    if (this.selectedId === focusable.id) focusable.onFocusChange?.(true);
    // The card Back was waiting for has arrived.
    if (this.pendingRestoreId === focusable.id) {
      this.pendingRestoreId = undefined;
      this.select(focusable.id);
    }
    // The screen's own default has arrived after the fallback took its place.
    // A restore waiting for its card outranks it, as the viewer's place does.
    else if (
      focusable.defaultFocus &&
      this.provisional &&
      this.pendingRestoreId === undefined &&
      this.candidates().some((entry) => entry.id === focusable.id)
    ) {
      this.select(focusable.id);
    }
    // A newly-mounted screen with nothing selected should land on its default.
    if (!this.selectedId) queueMicrotask(() => this.focusDefault());
    return () => {
      this.focusables.delete(focusable.id);
      this.pendingRects.delete(focusable.id);
      if (this.selectedId === focusable.id) {
        this.selectedId = undefined;
        queueMicrotask(() => this.focusDefault());
      }
    };
  }

  update(id: string, patch: Partial<Focusable>): void {
    const existing = this.focusables.get(id);
    if (!existing) return;
    this.focusables.set(id, { ...existing, ...patch });
  }

  measure(id: string, rect: FocusRect): void {
    const existing = this.focusables.get(id);
    if (!existing) {
      // Held rather than dropped. `update` returns silently for an unknown id,
      // which is right for an arbitrary patch and catastrophic for geometry.
      this.pendingRects.set(id, rect);
      return;
    }
    this.focusables.set(id, { ...existing, rect });
  }

  /**
   * Restrict candidates to one scope until it is popped.
   *
   * Mirrors the web client scoping selection to the visible player chrome:
   * while the chrome is up, nothing behind it is reachable by the D-pad.
   */
  pushScope(scope: string): void {
    this.scopes.push(scope);
    this.selectedId = undefined;
    this.focusDefault();
  }

  popScope(scope: string): void {
    this.scopes = this.scopes.filter((entry) => entry !== scope);
    this.selectedId = undefined;
    this.focusDefault();
  }

  /**
   * Stand down entirely while something else owns the D-pad.
   *
   * The case this exists for is the television's own on-screen keyboard. A
   * React Native `TextInput` raises the platform IME, and while it is up the
   * remote belongs to it — but `useTVEventHandler` is attached once at the app
   * root and keeps delivering, so without this the focus scorer would go on
   * moving selection around *behind* the open keyboard.
   *
   * Reference-counted with an opaque token so nesting composes: a menu opened
   * over a search field suspends again and resumes independently, and no caller
   * can resume another's suspension.
   *
   * Distinct from a scope. A scope narrows what is reachable; this makes
   * nothing reachable and leaves selection untouched, so focus is exactly where
   * it was when the keyboard closes.
   */
  suspend(): () => void {
    const token = Symbol('tv-focus-suspension');
    this.suspensions.add(token);
    return () => {
      this.suspensions.delete(token);
    };
  }

  /**
   * Drop every outstanding suspension. **A recovery path, never a routine one.**
   *
   * Reference counting is correct until a holder disappears without releasing,
   * and then it is unrecoverable: nothing else knows the token, so the registry
   * stays suspended for the life of the process and **the entire remote stops
   * working with nothing on screen to explain it.** That is not hypothetical —
   * it shipped in 0.3.0 and was found within minutes of a person picking up the
   * remote (see `TvTextInput`), because Android TV keeps a `ReactEditText`
   * natively focused after the IME closes, so `onBlur` never fires.
   *
   * The individual leak is fixed where it was caused. This exists because the
   * *consequence* is out of all proportion to the cause: any future holder that
   * forgets, throws, or is unmounted mid-flight would brick navigation the same
   * way. Callers must establish that nothing legitimately owns the remote
   * before calling this — `useTvNavigation` does it by asking the platform
   * whether a keyboard is actually on screen.
   */
  resumeAll(): void {
    this.suspensions.clear();
  }

  get suspended(): boolean {
    return this.suspensions.size > 0;
  }

  private activeScope(): string | undefined {
    return this.scopes[this.scopes.length - 1];
  }

  private candidates(): Focusable[] {
    const scope = this.activeScope();
    return [...this.focusables.values()]
      .filter((entry) => !entry.disabled)
      .filter((entry) => (scope ? entry.scope === scope : !entry.scope))
      // Zero-area elements are the RN equivalent of the web client's
      // `rect.width > 0 && rect.height > 0` visibility test.
      .filter((entry) => !entry.rect || (entry.rect.width > 0 && entry.rect.height > 0))
      .sort((a, b) => a.order - b.order);
  }

  private current(): Focusable | undefined {
    const elements = this.candidates();
    if (elements.length === 0) return undefined;
    const selected = elements.find((entry) => entry.id === this.selectedId);
    const preferred = elements.find((entry) => entry.defaultFocus);
    return selected ?? preferred ?? elements[0];
  }

  select(id: string | undefined): void {
    this.provisional = false;
    this.lastMove = undefined;
    if (this.selectedId === id) return;
    const previous = this.selectedId ? this.focusables.get(this.selectedId) : undefined;
    this.selectedId = id;
    previous?.onFocusChange?.(false);
    if (id) this.focusables.get(id)?.onFocusChange?.(true);
    for (const listener of this.listeners) listener(id);
  }

  focusDefault(): void {
    const elements = this.candidates();
    if (elements.length === 0) return;
    const preferred = elements.find((entry) => entry.defaultFocus) ?? elements[0];
    if (!preferred) return;
    this.select(preferred.id);
    this.provisional = !preferred.defaultFocus;
  }

  selected(): string | undefined {
    return this.selectedId;
  }

  /**
   * Whether anything currently answers to this id.
   *
   * For a caller that has selected an id optimistically — a screen restoring
   * the card Back came from, before that screen has finished fetching — and
   * needs to know later whether the card ever arrived.
   */
  isRegistered(id: string | undefined): boolean {
    return id !== undefined && this.focusables.has(id);
  }

  /**
   * Put focus back on this card, now if it exists and when it arrives if not.
   *
   * The caller should seed the screen's default first: something must be
   * highlighted while the fetch is outstanding, and this replaces it only if
   * the card turns up before the viewer touches the remote.
   */
  restoreWhenPresent(id: string | undefined): void {
    if (id === undefined) {
      this.pendingRestoreId = undefined;
      return;
    }
    if (this.focusables.has(id)) {
      this.pendingRestoreId = undefined;
      this.select(id);
      return;
    }
    this.pendingRestoreId = id;
  }

  /** Temporary diagnostic: how many registered focusables have a measured rect. */
  debugGeometry(): string {
    const all = [...this.focusables.values()];
    const measured = all.filter((entry) => entry.rect);
    const current = this.selectedId ? this.focusables.get(this.selectedId) : undefined;
    return `registered=${all.length} measured=${measured.length} currentRect=${JSON.stringify(current?.rect)}`;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Observe every command, whether or not anything is focusable.
   *
   * The player needs this: while its chrome is hidden nothing is in scope, so
   * `handle` has no candidate and would swallow the press silently. On a
   * television any button should bring the controls back, and only the screen
   * that hid them knows that.
   */
  onCommand(listener: (command: TvCommand) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  /** Returns true when the command was consumed. */
  handle(command: TvCommand): boolean {
    // The viewer has taken over; a restore landing now would move focus out
    // from under a hand already moving.
    this.pendingRestoreId = undefined;
    // Nothing, not even the command observers: while the platform IME is up,
    // waking the player chrome on a keystroke meant for the keyboard would be
    // as wrong as moving focus behind it.
    if (this.suspended) return false;

    for (const listener of this.commandListeners) listener(command);

    const elements = this.candidates();
    if (elements.length === 0) return false;

    const current = this.current();
    if (!current) return false;

    /**
     * Nothing is really selected yet: adopt the fallback rather than move from
     * it.
     *
     * `current()` invents an answer when `selectedId` names nothing reachable —
     * after a scope change, after a screen that owned the selection unmounted,
     * or on a screen nobody has touched yet. Moving *from* that invented
     * element has two bad outcomes, and the second is severe: a direction with
     * a candidate silently skips the fallback and lands two elements away, and
     * **a direction with no candidate returns false, so nothing is ever
     * selected and no focus ring is ever drawn.** On a row of controls with no
     * neighbour above or below, that is a screen where the D-pad does nothing
     * at all, permanently, with nothing on screen to explain it.
     *
     * Seen on the library after Back from a detail page: no ring anywhere, and
     * Up did nothing however many times it was pressed.
     *
     * Consuming the press is the right trade and matches every television UI:
     * the first press reveals where focus is, the second moves it.
     */
    if (this.selectedId !== current.id) {
      this.select(current.id);
      return true;
    }

    if (command === 'activate') {
      this.select(current.id);
      current.activate?.();
      return true;
    }

    if (command === 'back') return false;

    // A focused scrubber keeps left and right for seeking, exactly as the web
    // client's range input does, and yields up and down so focus can leave.
    if (current.ownsDirection?.(command)) {
      current.onDirection?.(command);
      return true;
    }

    // The opposite of the move just made goes back where it came from, if
    // that element is still here and still in reach.
    const undo = this.lastMove;
    if (undo && undo.to === current.id && command === OPPOSITE[undo.direction]) {
      const back = elements.find((entry) => entry.id === undo.from);
      if (back) {
        this.select(back.id);
        this.lastMove = { from: current.id, to: back.id, direction: command };
        return true;
      }
    }

    const rect = current.rect;
    let next: Focusable | undefined;

    if (rect && rect.width > 0 && rect.height > 0) {
      next = pickTvCandidate(
        rect,
        elements.filter((entry): entry is Focusable & { rect: FocusRect } => entry !== current && !!entry.rect),
        command,
      );
    } else {
      next = sequentialCandidate(elements, current, command);
    }

    if (!next) return false;
    this.select(next.id);
    this.lastMove = { from: current.id, to: next.id, direction: command };
    return true;
  }
}

const OPPOSITE: Record<TvDirection, TvDirection> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export const tvFocus = new TvFocusRegistry();
