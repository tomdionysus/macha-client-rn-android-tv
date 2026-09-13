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
 * The web client's candidate score, unchanged.
 *
 * Primary axis distance dominates; cross-axis drift is discounted to a fifth so
 * a slightly-offset neighbour still wins over a distant aligned one; and a
 * lane gap is penalised six-fold so focus prefers staying within a row or
 * column rather than cutting diagonally across the grid.
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

  if (direction === 'left' && dx >= -1) return null;
  if (direction === 'right' && dx <= 1) return null;
  if (direction === 'up' && dy >= -1) return null;
  if (direction === 'down' && dy <= 1) return null;

  const horizontal = direction === 'left' || direction === 'right';
  const primary = horizontal ? Math.abs(dx) : Math.abs(dy);
  const secondary = horizontal ? Math.abs(dy) : Math.abs(dx);
  const laneGap = horizontal
    ? rectGap(current.top, current.height, candidate.top, candidate.height)
    : rectGap(current.left, current.width, candidate.left, candidate.width);

  return primary + secondary * 0.2 + laneGap * 6;
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
    if (preferred) this.select(preferred.id);
  }

  selected(): string | undefined {
    return this.selectedId;
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
    // Nothing, not even the command observers: while the platform IME is up,
    // waking the player chrome on a keystroke meant for the keyboard would be
    // as wrong as moving focus behind it.
    if (this.suspended) return false;

    for (const listener of this.commandListeners) listener(command);

    const elements = this.candidates();
    if (elements.length === 0) return false;

    const current = this.current();
    if (!current) return false;

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

    const rect = current.rect;
    let next: Focusable | undefined;

    if (rect && rect.width > 0 && rect.height > 0) {
      next = elements
        .filter((entry) => entry !== current && entry.rect)
        .map((entry) => ({ entry, score: scoreTvCandidate(rect, entry.rect!, command) }))
        .filter((scored): scored is { entry: Focusable; score: number } => scored.score !== null)
        .sort((a, b) => a.score - b.score)[0]?.entry;
    } else {
      next = sequentialCandidate(elements, current, command);
    }

    if (!next) return false;
    this.select(next.id);
    return true;
  }
}

export const tvFocus = new TvFocusRegistry();
