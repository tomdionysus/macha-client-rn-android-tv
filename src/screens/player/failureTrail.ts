import { clientDiagnosticsConsole, type ClientLogEntry } from '@machafoundation/core';

/**
 * The evidence behind a playback failure, read out of the diagnostics buffer
 * because a television has no console. Ported from the web client
 * (`screens/player/failureTrail.ts`). Warnings and errors only by default.
 */
export interface PlaybackFailureTrailEntry {
  atMs: number;
  level: string;
  event: string;
  detail?: string;
}

/** Enough for a walk around the cluster, and still readable at a distance. */
const TRAIL_ENTRIES = 12;

/** The web client allows 160; at ten-foot type that wraps and pushes older entries off the overlay. */
const DETAIL_CHARS = 110;

function detailOf(entry: ClientLogEntry, limit: number): string | undefined {
  const { data } = entry;
  if (data === undefined || data === null) return undefined;
  if (typeof data !== 'object') return String(data);
  if (data instanceof Error) return data.message;
  try {
    // Errors nested in a data object stringify to `{}`; keep their message.
    const text = JSON.stringify(data, (_key, value) => (
      value instanceof Error ? value.message : value
    ));
    if (!text || text === '{}') return undefined;
    return text.length > limit ? `${text.slice(0, limit)}…` : text;
  } catch {
    // Circular structures and throwing getters: show the entry without detail.
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
 * Lines the player keeps on screen while nothing has failed. Eight spans a
 * recovery with its `info` steps, which the live trail shows while Diagnostics
 * is on.
 */
export const LIVE_TRAIL_ENTRIES = 8;

/**
 * Identifies a reading of the trail, so the once-a-second poll in
 * `PlayerScreen` sets state only on change. `elapsedMs` is monotonic, so a new
 * line changes it; the count catches the buffer filling to its cap.
 */
export function trailSignature(trail: readonly PlaybackFailureTrailEntry[]): string {
  const last = trail.at(-1);
  return last ? `${trail.length}:${last.atMs}:${last.event}` : '';
}

/**
 * Line length for the live trail. Measured on hardware: 110 cuts a failover's
 * `playback.api http-error-response` line one field short of the status code.
 * Each line is one row on screen, so the cost is width only.
 */
export const LIVE_DETAIL_CHARS = 240;
