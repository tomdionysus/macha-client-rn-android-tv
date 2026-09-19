/**
 * An accelerating seek "finder" for held D-pad presses.
 *
 * **A port of `macha-client/src/screens/player/seekAcceleration.ts`**, ladder
 * and thresholds unchanged, because the requirement is that this client
 * behaves like the web TV client rather than merely that it seeks. The web
 * client's `seekDirectionForKey` is not here: it reads DOM key names, and a
 * direction arrives at this client already resolved by `tvFocus`.
 *
 * **It is duplicated rather than shared, and that is not settled.** The rule in
 * `AGENTS.md` is that the dependency-free part of anything common belongs in
 * core, and this file has no dependencies at all. Core refused D-pad focus
 * scoring on the grounds that geometry deciding what a viewer looks at next is
 * presentation, and the same argument covers a ladder tuned to a remote's
 * auto-repeat. Two TV clients now hold the same numbers; the tests below pin
 * them on this side, as `tvFocus.test.ts` does for the focus weights.
 *
 * A remote has no scrub wheel, so a fixed step is always wrong somewhere: 10s
 * is tedious across a film, 30s overshoots the moment you were looking for.
 * Holding the key therefore climbs a ladder — a tap nudges by a second, a
 * sustained hold ends up moving minutes.
 *
 * Time drives the rung rather than the number of key events, because auto-
 * repeat rates differ between a TV remote and a desktop keyboard; counting
 * events would accelerate at whatever speed the platform happens to repeat at.
 */
export const SEEK_LADDER_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000, 300_000] as const;

/** How long the key must be held at each rung before the next one is reached. */
export const SEEK_RUNG_ADVANCE_MS = 600;

/**
 * A gap longer than this ends the hold. Auto-repeat fires far faster than
 * this, so any real pause between presses starts again at one second — and a
 * missed keyup (which a TV will do) cannot leave the ladder stuck at the top.
 */
export const SEEK_HOLD_RELEASE_MS = 350;

export type SeekDirection = -1 | 1;

export interface SeekHold {
  direction: SeekDirection;
  startedAtMs: number;
  lastEventAtMs: number;
}

/** The step for a key that has been held this long, in milliseconds. */
export function seekLadderStepMs(heldMs: number): number {
  const rung = Math.min(SEEK_LADDER_MS.length - 1, Math.max(0, Math.floor(heldMs / SEEK_RUNG_ADVANCE_MS)));
  // The rung is clamped into range above, so the fallback is unreachable —
  // it is here because this tree compiles with `noUncheckedIndexedAccess`,
  // which the web client does not, and an index signature cannot know about the
  // clamp. The top of the ladder is the right answer if it ever were reached.
  return SEEK_LADDER_MS[rung] ?? SEEK_LADDER_MS[SEEK_LADDER_MS.length - 1]!;
}

/**
 * Advance a hold by one key event, returning the signed distance to move and
 * the hold to carry into the next event. Reversing direction restarts the
 * ladder: changing your mind is a new search, not a continuation of the old
 * one at minutes per press.
 */
export function accelerateSeek(
  previous: SeekHold | undefined,
  direction: SeekDirection,
  nowMs: number,
): { hold: SeekHold; deltaMs: number } {
  const continuing = previous !== undefined
    && previous.direction === direction
    && nowMs - previous.lastEventAtMs <= SEEK_HOLD_RELEASE_MS;
  const startedAtMs = continuing ? previous.startedAtMs : nowMs;
  return {
    hold: { direction, startedAtMs, lastEventAtMs: nowMs },
    deltaMs: direction * seekLadderStepMs(nowMs - startedAtMs),
  };
}
