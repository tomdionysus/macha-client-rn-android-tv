/**
 * What the player calls the node serving a stream: the cluster's name for it
 * (core's `endpointName`), else the host, else the address as configured.
 *
 * The web client's `nodeName` (`macha-client/src/screens/player/nodeChoices.ts`),
 * except that React Native's `URL` answers an empty hostname instead of
 * throwing, so an empty answer counts as unread.
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
