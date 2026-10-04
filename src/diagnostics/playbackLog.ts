import { configureClientDiagnostics, createClientLogger } from '@machafoundation/core';

/**
 * Core's client logger and its in-memory ring, read out by the failure trail:
 * the only fault evidence visible on a set with no console.
 */

// Configured at import, so no log site can run before configuration.
let configured = false;

function configure(): void {
  if (configured) return;
  configured = true;
  configureClientDiagnostics({
    // The trail shows only warnings and errors, and `debug` would put every
    // routine step across the JS/native console bridge.
    level: 'warn',
    // The bridge write costs on every entry; off in release.
    console: typeof __DEV__ !== 'undefined' && __DEV__,
    // The trail shows the last dozen; core defaults to 2,000.
    maxEntries: 200,
  });
}

configure();

/**
 * `info` while Diagnostics is on, `warn` otherwise. Core logs its regenerate
 * path at `info`, all event-driven, so the cost is bounded. The console stays
 * off.
 */
export function applyDiagnosticsLevel(diagnosticsOn: boolean): void {
  configureClientDiagnostics({ level: diagnosticsOn ? 'info' : 'warn' });
}

/** One scope for all playback: the trail prints `scope event`. */
export const playbackLog = createClientLogger('playback');
