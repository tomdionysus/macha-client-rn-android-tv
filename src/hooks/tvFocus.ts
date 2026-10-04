/**
 * The D-pad focus model, ported from the web client's `useTvNavigation.ts`.
 * The geometry, weights and tie-breaks mirror its `scoreTvCandidate`: change a
 * weight in both places, and in `tvFocus.test.ts`. The DOM query becomes an
 * explicit registry of focusables and their measured rectangles.
 */


/** Top-bar focus ids start with this, so the fallback can return to the last one used. */
export const NAV_FOCUS_PREFIX = 'nav:';

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
  /** Exclusive scope, as the web client scopes candidates to `.player-chrome.visible`. */
  scope?: string;
  activate?: () => void;
  onFocusChange?: (focused: boolean) => void;
  /**
   * Directions this element keeps instead of moving focus: the web client's
   * `tvRangeOwnsDirection`. Never all four, or focus cannot leave.
   */
  ownsDirection?: (direction: TvDirection) => boolean;
  onDirection?: (direction: TvDirection) => void;
  /** A side rail, such as the alphabet strip: reachable sideways from any row (`pickTvCandidate`). */
  rail?: boolean;
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
 * The web client's candidate score: primary-axis distance, plus a fifth of the
 * cross-axis drift, plus six times the lane gap. Judged from edges, as the web
 * client does: a candidate is in the direction of travel only when its centre
 * is past the current element's edge, and the primary distance is the gap
 * between facing edges.
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

/** Which candidate a direction moves to, from the current element's rectangle. */
export function pickTvCandidate<T extends { rect: FocusRect; rail?: boolean }>(
  current: FocusRect,
  candidates: readonly T[],
  direction: TvDirection,
): T | undefined {
  const scored = candidates
    .map((entry) => ({ entry, score: scoreTvCandidate(current, entry.rect, direction) }))
    .filter((item): item is { entry: T; score: number } => item.score !== null);
  const byScore = (a: { score: number }, b: { score: number }) => a.score - b.score;
  const horizontal = direction === 'left' || direction === 'right';

  // Left and right stay on the current row and stop at its end; changing row
  // is for Up and Down. The exception is a side rail, taken when nothing on
  // the row lies that way. The rail is not in the web client.
  if (horizontal) {
    const onRow = scored
      .filter(({ entry }) => rectGap(current.top, current.height, entry.rect.top, entry.rect.height) === 0)
      .sort(byScore)[0]?.entry;
    return onRow ?? scored.filter(({ entry }) => entry.rail).sort(byScore)[0]?.entry;
  }

  // Up and down: the nearest row first (the band overlapping the candidate
  // with the nearest facing edge), then the best score within it. "Same column
  // first" would skip a short row.
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
   * Rectangles that arrived before their focusable registered. This is the
   * normal order: Fabric dispatches `onLayout` as soon as layout commits.
   */
  private pendingRects = new Map<string, FocusRect>();

  /**
   * A card Back should return to, which may not have mounted yet. Registration
   * claims it; the viewer's first command abandons it.
   */
  private pendingRestoreId: string | undefined;

  /**
   * The selection is a fallback: `focusDefault` found no `defaultFocus` element.
   * While this holds, a `defaultFocus` element that registers takes over; any
   * real selection clears it. Not in the web client.
   */
  private provisional = false;

  /**
   * The last D-pad move, so the opposite press undoes it. Any other selection
   * forgets it. Not in the web client.
   */
  private lastMove: { from: string; to: string; direction: TvDirection } | undefined;

  /**
   * The top-bar item the viewer last chose, for the fallback to return to. Set
   * only by a selection the viewer caused. Not in the web client.
   */
  private lastNavId: string | undefined;

  register(focusable: Omit<Focusable, 'order'>): () => void {
    const existing = this.focusables.get(focusable.id);
    // Keep the original order across a re-registration, or the sequential fallback reorders.
    const order = existing?.order ?? this.sequence++;
    // Geometry outlives registration: it may have arrived first, or be held
    // from before a re-registration.
    const rect = existing?.rect ?? this.pendingRects.get(focusable.id);
    this.focusables.set(focusable.id, { ...focusable, order, ...(rect ? { rect } : {}) });
    this.pendingRects.delete(focusable.id);
    // An element can mount into an existing selection (a card restored by name
    // while its grid was fetching): tell it, or nothing is highlighted.
    if (this.selectedId === focusable.id) focusable.onFocusChange?.(true);
    // The card Back was waiting for has arrived.
    if (this.pendingRestoreId === focusable.id) {
      this.pendingRestoreId = undefined;
      this.select(focusable.id);
    }
    // The screen's default arrived after the fallback took its place; a
    // waiting restore outranks it.
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
      // Held, not dropped: geometry usually arrives before registration.
      this.pendingRects.set(id, rect);
      return;
    }
    this.focusables.set(id, { ...existing, rect });
  }

  /** Restrict candidates to one scope until it is popped, as the web client does for the visible player chrome. */
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
   * Stand down while something else owns the D-pad, typically the platform
   * IME. Selection is untouched, so focus is where it was on resume.
   * Reference-counted by token: suspensions nest, and no caller can resume
   * another's.
   */
  suspend(): () => void {
    const token = Symbol('tv-focus-suspension');
    this.suspensions.add(token);
    return () => {
      this.suspensions.delete(token);
    };
  }

  /**
   * Drop every suspension: a recovery path for a holder that went away without
   * releasing (Android TV keeps a `ReactEditText` focused after the IME
   * closes, so `onBlur` never fires; see `TvTextInput`). A leaked suspension
   * disables the whole remote. Callers must first establish that nothing owns
   * the remote, as `useTvNavigation` does by asking whether a keyboard is up.
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
      // Zero area: the web client's `rect.width > 0 && rect.height > 0` visibility test.
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
    if (id?.startsWith(NAV_FOCUS_PREFIX)) this.lastNavId = id;
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
    const preferred = elements.find((entry) => entry.defaultFocus)
      ?? elements.find((entry) => entry.id === this.lastNavId)
      ?? elements[0];
    if (!preferred) return;
    // The fallback's own choice is not the viewer's: keep what they last chose.
    const remembered = this.lastNavId;
    this.select(preferred.id);
    this.lastNavId = remembered;
    this.provisional = !preferred.defaultFocus;
  }

  selected(): string | undefined {
    return this.selectedId;
  }

  /** Whether anything is registered under this id, e.g. a card selected before its screen finished fetching. */
  isRegistered(id: string | undefined): boolean {
    return id !== undefined && this.focusables.has(id);
  }

  /**
   * Put focus on this card, now if it exists and when it registers if not.
   * Seed the screen's default first, so something is highlighted meanwhile.
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

  /** Diagnostic: how many registered focusables have a measured rect. */
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
   * Observe every command, whether or not anything is focusable. The player
   * uses it to bring back hidden chrome, when nothing is in scope.
   */
  onCommand(listener: (command: TvCommand) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  /** Returns true when the command was consumed. */
  handle(command: TvCommand): boolean {
    // The viewer has taken over: abandon any pending restore.
    this.pendingRestoreId = undefined;
    // Suspended: nothing runs, not even the command observers.
    if (this.suspended) return false;

    for (const listener of this.commandListeners) listener(command);

    const elements = this.candidates();
    if (elements.length === 0) return false;

    const current = this.current();
    if (!current) return false;

    // `current()` is a fallback when `selectedId` names nothing reachable.
    // Adopt it and consume the press: moving from it would skip it, and a
    // direction with no candidate would never select anything or draw a ring.
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

    // A focused scrubber keeps left and right for seeking and yields up and down.
    if (current.ownsDirection?.(command)) {
      current.onDirection?.(command);
      return true;
    }

    // The opposite of the move just made goes back, if that element is still in reach.
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
