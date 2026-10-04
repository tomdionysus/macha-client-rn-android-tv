/**
 * An accelerating seek for held D-pad presses: a tap nudges by a second, a
 * sustained hold moves minutes.
 *
 * A port of `macha-client/src/screens/player/seekAcceleration.ts`, ladder and
 * thresholds unchanged; `seekAcceleration.test.ts` pins them. A local copy,
 * not core's: core treats a ladder tuned to a remote's auto-repeat as
 * presentation.
 *
 * Elapsed time drives the rung, not the event count, because auto-repeat
 * rates differ between platforms.
 */
export const SEEK_LADDER_MS = [1_000, 2_000, 5_000, 10_000, 20_000, 30_000, 60_000, 300_000] as const;

/** Hold time per rung. The web client's figure. */
export const SEEK_RUNG_ADVANCE_MS = 600;

/**
 * A gap longer than this ends the hold. Well above auto-repeat intervals, so
 * a missed keyup cannot leave the ladder stuck at the top. The web client's
 * figure.
 */
export const SEEK_HOLD_RELEASE_MS = 350;

export type SeekDirection = -1 | 1;

export interface SeekHold {
  direction: SeekDirection;
  startedAtMs: number;
  lastEventAtMs: number;
}

export function seekLadderStepMs(heldMs: number): number {
  const rung = Math.min(SEEK_LADDER_MS.length - 1, Math.max(0, Math.floor(heldMs / SEEK_RUNG_ADVANCE_MS)));
  // Unreachable fallback, for `noUncheckedIndexedAccess`.
  return SEEK_LADDER_MS[rung] ?? SEEK_LADDER_MS[SEEK_LADDER_MS.length - 1]!;
}

/**
 * Advances a hold by one key event, returning the signed distance to move and
 * the hold to carry forward. Reversing direction restarts the ladder.
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
