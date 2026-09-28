/**
 * What the player calls the node serving a stream, in the status line and
 * while a new stream is prepared: the host, never the whole URL. "Starting
 * the new stream on 10.35.1.50: 60%" reads; the same sentence with `http://`
 * and `:7438:` in it does not (Tom, 2026-09-28: every client names nodes this
 * way). An address that cannot be read is shown as it is, which at least
 * matches what was configured.
 *
 * The web client's `nodeName` (`macha-client/src/screens/player/nodeChoices.ts`,
 * e4eae8f), with one difference that is this platform's: React Native's `URL`
 * (`Libraries/Blob/URL.js`) does not throw on an address it cannot read, it
 * answers an empty hostname, so an empty answer counts as unread too.
 *
 * The cluster's own name for the node comes first where core knows it
 * (`endpointName`, core 7819d37: "corvus-fi-1", what the Status screen
 * shows); the host is its fallback.
 */
export function nodeName(endpoint: string | undefined, clusterName?: string): string | undefined {
  if (clusterName) return clusterName;
  if (!endpoint) return undefined;
  let host: string | undefined;
  try {
    host = new URL(endpoint).hostname;
  } catch {
    host = undefined;
  }
  return host || endpoint;
}
