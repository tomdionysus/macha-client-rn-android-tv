import Constants from 'expo-constants';
import { MachaClientConfiguration } from '@machafoundation/core';

/**
 * This build's binding of the core's client configuration.
 *
 * All the values and their migration logic live in `MachaClientConfiguration`;
 * only their provenance is app-specific. On the web that provenance is
 * `import.meta.env`, which exists in a Vite build and nowhere else — here it is
 * the Expo app config, read once at this boundary so nothing else in the app
 * has to know where endpoints come from.
 *
 * Endpoints are deliberately *not* pinned: a television gets moved between
 * sites, and a viewer who has set a working server on the Settings screen
 * should keep it across an app update.
 */

function configuredEndpoints(): string[] {
  const extra = Constants.expoConfig?.extra as { machaEndpoints?: unknown } | undefined;
  const endpoints = extra?.machaEndpoints;
  if (!Array.isArray(endpoints)) return [];
  return endpoints.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

export const clientConfiguration = new MachaClientConfiguration({
  environmentEndpoints: configuredEndpoints(),
  pinnedEndpoints: false,
});

export function getClientId(): string {
  return clientConfiguration.clientId();
}

export function getBootstrapEndpoints(): string[] {
  return clientConfiguration.bootstrapEndpoints();
}

export function setBootstrapEndpoints(urls: readonly string[]): void {
  clientConfiguration.setBootstrapEndpoints(urls);
}

export function getDiscoveredEndpoints(): string[] {
  return clientConfiguration.discoveredEndpoints();
}

export function setDiscoveredEndpoints(urls: readonly string[]): void {
  clientConfiguration.setDiscoveredEndpoints(urls);
}

export function getServerUrl(): string {
  return clientConfiguration.serverUrl();
}
