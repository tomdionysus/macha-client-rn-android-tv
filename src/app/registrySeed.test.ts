import { describe, expect, it } from 'vitest';
import {
  EndpointRegistry,
  MachaClientConfiguration,
  persistConfirmedEndpoints,
  seedEndpoints,
  type StorageLike,
} from '@machafoundation/core';

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

/**
 * 2026-09-24, on `.133`: with its one configured node down, the set said
 * "Can't reach Macha" although it had streamed from two other nodes the night
 * before. The remembered list has to survive the restart that reads it, or it
 * is a fallback for exactly one start.
 *
 * Seen red against this client's old seeding (every URL as `bootstrap`), then
 * fixed here and moved into core as `seedEndpoints` (its `b47773d`). Kept
 * because `MachaProvider` seeds exactly this way; confirmed on `.133` the same
 * day with only a dead address configured, over two restarts.
 */
describe('registry seeding', () => {
  it('keeps the remembered nodes remembered across a restart', () => {
    const configuration = new MachaClientConfiguration({
      environmentEndpoints: ['http://10.35.1.50:7438'],
      pinnedEndpoints: false,
      storage: memoryStorage(),
    });
    configuration.setDiscoveredEndpoints(['http://macnessa:7438', 'http://ramaroja:7438']);

    const registry = new EndpointRegistry(
      seedEndpoints({ configured: configuration.bootstrapEndpoints(), remembered: configuration.discoveredEndpoints() }),
    );
    // The first health cycle after the restart: the remembered nodes answer.
    for (const { endpoint } of registry.snapshot()) {
      if (endpoint.baseUrl !== 'http://10.35.1.50:7438') registry.recordProbeSuccess(endpoint.id);
    }
    persistConfirmedEndpoints(registry, configuration);

    expect(configuration.discoveredEndpoints()).toEqual(['http://macnessa:7438', 'http://ramaroja:7438']);
  });

  it('never lets a remembered node shadow a configured one', () => {
    const seeded = seedEndpoints({ configured: ['http://a:7438'], remembered: ['http://a:7438', 'http://b:7438'] });
    expect(seeded.map(({ baseUrl, source }) => [baseUrl, source])).toEqual([
      ['http://a:7438', 'bootstrap'],
      ['http://b:7438', 'discovered'],
    ]);
  });
});
