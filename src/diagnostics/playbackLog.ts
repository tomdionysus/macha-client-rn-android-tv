import { configureClientDiagnostics, createClientLogger } from '@machafoundation/core';

/**
 * The diagnostics buffer this client had, unread, until now.
 *
 * Core has shipped `createClientLogger` and an in-memory ring buffer since
 * before this client existed, and this client called neither. That was
 * survivable on a desktop and is not survivable here: **a television has no
 * console.** Every fault this project has diagnosed so far was diagnosed by
 * reasoning from source, rebuilding, reinstalling, and asking whoever was
 * watching the screen what changed — while the one line that would have
 * answered it sat in memory on the set, reachable only from a developer
 * console the panel does not have.
 *
 * The reason it matters *now* is specific. When a film finally plays
 * (`TODO/ACTIVE.md` §1.2), an unexplained mid-playback failover has three
 * candidate causes and they are distinguishable only by their evidence: the
 * missing hold-aware `500` retry, core's backward-seek eviction (the tell is
 * a rewind immediately before the failover), or a genuine node fault. Without
 * a trail, all three look identical from three metres away, and the
 * measurement this repository exists to make comes back ambiguous.
 */

/**
 * Configured once, at import, because the alternative is worse.
 *
 * A `configure()` call threaded through `App.tsx` can be reached *after* the
 * first thing worth logging has already happened — and the first thing worth
 * logging is a playback failure during startup. Importing this module is what
 * every logging site already does, so tying configuration to that import
 * makes "the logger exists" and "the logger is configured" the same event.
 */
let configured = false;

function configure(): void {
  if (configured) return;
  configured = true;
  configureClientDiagnostics({
    // Core defaults to `debug`, which on this platform means every routine
    // step crosses the JS/native console bridge on a device whose CPU is the
    // scarcest thing in the building. The trail reads warnings and errors and
    // nothing else, so nothing below `warn` would ever be displayed anyway.
    level: 'warn',
    // Core defaults this on. Off in a release build: the bridge write is real
    // cost on every entry, paid on a set nobody is attached to with a cable.
    console: typeof __DEV__ !== 'undefined' && __DEV__,
    // Core defaults to 2,000 entries. The trail shows the last dozen and a
    // television has no way to scroll a log, so retaining two thousand is
    // memory spent on something nothing can read.
    maxEntries: 200,
  });
}

configure();

/**
 * Lift the buffer to `info` while Diagnostics is on, and drop it back after.
 *
 * **Added 2026-09-20 because `warn` hid the one span that mattered.** A
 * reaped session took core's regenerate path and the viewer sat frozen on
 * "Preparing new stream" for minutes with **no line at all** on the trail —
 * not because nothing happened, but because everything that happened between
 * `session-reaped-regenerating` and the hang is logged at `info`:
 * `generation-regenerate`, `failed-session-closed`, `session-created`,
 * `session-regenerated`, `source-activate`, `first-fragment`. The trail could
 * say a recovery had started and nothing else.
 *
 * `info` is not periodic in core — the health monitor has one info site, the
 * coordinator's are all event-driven — so the cost is bounded by how much
 * actually happens, and it is only paid with the toggle on, which is only
 * ever somebody debugging. The console stays off: this is the buffer, not the
 * bridge.
 */
export function applyDiagnosticsLevel(diagnosticsOn: boolean): void {
  configureClientDiagnostics({ level: diagnosticsOn ? 'info' : 'warn' });
}

/**
 * The playback scope.
 *
 * One scope rather than one per file: the trail prints `scope event`, and a
 * proliferation of scopes makes the one column that identifies a line less
 * informative rather than more.
 */
export const playbackLog = createClientLogger('playback');
