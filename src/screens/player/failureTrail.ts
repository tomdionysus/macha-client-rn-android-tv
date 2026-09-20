import { clientDiagnosticsConsole, type ClientLogEntry } from '@machafoundation/core';

/**
 * The evidence behind a playback failure, in the failure's own words.
 *
 * Ported from the web client (`screens/player/failureTrail.ts`), where it was
 * written for the Samsung set for the same reason it is needed here: there is
 * no console on a television, so the failure screen reads the buffer out.
 *
 * Deliberately only warnings and errors. The buffer is configured at `warn`
 * (`diagnostics/playbackLog.ts`) so it holds nothing else anyway, but the
 * filter stays because the rule is the point: a screen that also listed every
 * routine step would bury the three lines that matter under the fifty that
 * do not.
 */
export interface PlaybackFailureTrailEntry {
  atMs: number;
  level: string;
  event: string;
  detail?: string;
}

/** Long enough for a walk around the cluster, short enough to read at a distance. */
const TRAIL_ENTRIES = 12;

/**
 * Truncation, sized for a ten-foot interface rather than a browser console.
 *
 * The web client allows 160 characters. A television is read from across a
 * room at a font size that cannot shrink to compensate, so a line that long
 * wraps to three and pushes the older entries — which are usually the causal
 * ones — off the bottom of the overlay.
 */
const DETAIL_CHARS = 110;

function detailOf(entry: ClientLogEntry): string | undefined {
  const { data } = entry;
  if (data === undefined || data === null) return undefined;
  if (typeof data !== 'object') return String(data);
  if (data instanceof Error) return data.message;
  try {
    // Errors nested in a data object stringify to `{}`, which is the one case
    // where the whole point of the line is the message inside them.
    const text = JSON.stringify(data, (_key, value) => (
      value instanceof Error ? value.message : value
    ));
    if (!text || text === '{}') return undefined;
    return text.length > DETAIL_CHARS ? `${text.slice(0, DETAIL_CHARS)}…` : text;
  } catch {
    // Circular structures and getters that throw. A trail entry with no
    // detail is still worth showing; losing the whole screen to a log line is
    // not.
    return undefined;
  }
}

export function playbackFailureTrail(
  entries: readonly ClientLogEntry[] = clientDiagnosticsConsole().snapshot(),
): PlaybackFailureTrailEntry[] {
  return entries
    .filter((entry) => entry.level === 'warn' || entry.level === 'error')
    .slice(-TRAIL_ENTRIES)
    .map((entry) => ({
      atMs: entry.elapsedMs,
      level: entry.level,
      event: `${entry.scope} ${entry.event}`,
      detail: detailOf(entry),
    }));
}

/**
 * How much trail the player keeps on screen while nothing has failed.
 *
 * Fewer than the failure overlay's twelve, and for the opposite reason: the
 * overlay is the only thing on screen and has the viewer's whole attention,
 * while this sits over a running picture and is read in glances. Six lines
 * spans a failover — the degradation evidence, the promotion and the new
 * node's budgets — without becoming a second programme.
 */
export const LIVE_TRAIL_ENTRIES = 6;

/**
 * Whether two readings of the trail differ, cheaply.
 *
 * The live trail is polled (`PlayerScreen`, and the comment there says why a
 * subscription is not available and a render-driven read would stop at exactly
 * the wrong moment). A poll that set state unconditionally would re-render the
 * player once a second for the whole of a film, which on this panel is CPU
 * taken from the decoder — the one thing this client must not do to watch
 * itself.
 *
 * The last entry identifies the reading: `elapsedMs` is monotonic within a
 * process, so a new line always changes it, and the count catches the buffer
 * filling up to its cap while the tail stands still.
 */
export function trailSignature(trail: readonly PlaybackFailureTrailEntry[]): string {
  const last = trail.at(-1);
  return last ? `${trail.length}:${last.atMs}:${last.event}` : '';
}
