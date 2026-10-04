import Constants from 'expo-constants';
import { MachaClientConfiguration } from '@machafoundation/core';

/**
 * Binds core's `MachaClientConfiguration` to the Expo app config. Endpoints
 * are not pinned: a viewer's server set in Settings survives an app update.
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
