import { configureClientDiagnostics, createClientLogger } from '@machafoundation/core';

/**
 * The diagnostics buffer: core's `createClientLogger` and its in-memory ring.
 *
 * **A television has no console**, so this buffer, read out by the failure
 * trail, is the only place on the set where the evidence behind a fault can
 * be seen. An unexplained mid-playback failover has several candidate causes
 * that are distinguishable only by their evidence: a node holding a fragment,
 * core's backward-seek eviction (the tell is a rewind immediately before the
 * failover), or a genuine node fault.
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
 * **`warn` hides the span that matters in a recovery.** Everything core's
 * regenerate path does after `session-reaped-regenerating` is logged at
 * `info`: `generation-regenerate`, `failed-session-closed`, `session-created`,
 * `session-regenerated`, `source-activate`, `first-fragment`. At `warn` the
 * trail can say a recovery has started and nothing else.
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
