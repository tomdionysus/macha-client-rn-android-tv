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

function detailOf(entry: ClientLogEntry, limit: number): string | undefined {
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
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  } catch {
    // Circular structures and getters that throw. A trail entry with no
    // detail is still worth showing; losing the whole screen to a log line is
    // not.
    return undefined;
  }
}

export type TrailLevel = 'warn' | 'info';

export function playbackFailureTrail(
  entries: readonly ClientLogEntry[] = clientDiagnosticsConsole().snapshot(),
  detailChars: number = DETAIL_CHARS,
  minimumLevel: TrailLevel = 'warn',
): PlaybackFailureTrailEntry[] {
  return entries
    .filter((entry) => entry.level === 'warn' || entry.level === 'error'
      || (minimumLevel === 'info' && entry.level === 'info'))
    .slice(-TRAIL_ENTRIES)
    .map((entry) => ({
      atMs: entry.elapsedMs,
      level: entry.level,
      event: `${entry.scope} ${entry.event}`,
      detail: detailOf(entry, detailChars),
    }));
}

/**
 * How much trail the player keeps on screen while nothing has failed.
 *
 * Fewer than the failure overlay's twelve, and for the opposite reason: the
 * overlay is the only thing on screen and has the viewer's whole attention,
 * while this sits over a running picture and is read in glances. Eight lines
 * spans a recovery **with its `info` steps included** — since 2026-09-20 the
 * live trail shows `info` while Diagnostics is on, because the regenerate
 * path's every step between "started" and "attached" is logged at that level
 * and six lines of `warn` could only say a recovery had begun.
 */
export const LIVE_TRAIL_ENTRIES = 8;

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

/**
 * How much of a line the live trail keeps, against the overlay's 110.
 *
 * Measured, not chosen: the first failover read on hardware (2026-09-20) cut
 * `playback.api http-error-response` at
 * `…?idempotency_key=mua0un2b-yk561ok4qj","elapsed…` — one field short of the
 * status code, which was the only thing on the line anybody needed. A node
 * refusing a session and a node that is simply slow are the same line at 110
 * characters.
 *
 * The overlay's limit stays where it is. It sits under a failure message with
 * the viewer's whole attention on it and wraps into the middle of the screen;
 * this band is at the top edge of a picture, is read by somebody holding a
 * laptop, and every line is still truncated to one row on screen — so the
 * cost of a longer allowance is width, not legibility.
 */
export const LIVE_DETAIL_CHARS = 240;
