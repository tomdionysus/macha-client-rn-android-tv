/**
 * What the player calls the node serving a stream, in the status line and
 * while a new stream is prepared: the host, never the whole URL. Every client
 * names nodes this way. An address that cannot be read is shown as it is,
 * which at least matches what was configured.
 *
 * The web client's `nodeName` (`macha-client/src/screens/player/nodeChoices.ts`),
 * with one difference that is this platform's: React Native's `URL`
 * (`Libraries/Blob/URL.js`) does not throw on an address it cannot read, it
 * answers an empty hostname, so an empty answer counts as unread too.
 *
 * The cluster's own name for the node (core's `endpointName`, what the Status
 * screen shows) comes first where known; the host is its fallback.
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
