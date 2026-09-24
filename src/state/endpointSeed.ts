import { bootstrapEndpoints, type MachaEndpoint } from '@machafoundation/core';

/**
 * The registry's starting endpoints: what the viewer configured, then the
 * nodes remembered from earlier runs.
 *
 * **Remembered nodes must go in as `discovered`.** Core's
 * `persistConfirmedEndpoints` rewrites the remembered list every health cycle
 * from the registry's `discovered` entries alone. This used to seed them
 * through `bootstrapEndpoints` as `bootstrap`, so the first cycle after a
 * restart wrote the list back without them: a fallback that lasted exactly
 * one start. Found on `.133` 2026-09-24 (its one configured node down, "Can't
 * reach Macha" despite two nodes reached the night before), and reproduced in
 * `endpointSeed.test.ts`; not yet seen fixed on a set.
 *
 * **A local copy of logic that belongs in core.** Seeding a registry from
 * `MachaClientConfiguration` depends on nothing platform-specific, and the
 * three clients do it three ways (read 2026-09-24): the phone client
 * (`macha-client-rn` `src/providers/MachaProvider.tsx`) goes through
 * `applyAdvertisement` and gets `discovered`; the web client
 * (`macha-client` `src/App.tsx`) seeds `environment` and so has this fault.
 * Replace with core's seeding helper once it has one; asked of core the same
 * day.
 */
export function seedEndpoints(configured: readonly string[], remembered: readonly string[]): MachaEndpoint[] {
  const seeds = bootstrapEndpoints(configured);
  const taken = new Set(seeds.map(({ baseUrl }) => baseUrl));
  const discovered = bootstrapEndpoints(remembered, 'discovered').filter(({ baseUrl }) => !taken.has(baseUrl));
  return [...seeds, ...discovered];
}
