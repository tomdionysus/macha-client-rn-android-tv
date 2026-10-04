import type { ArtworkRef, MediaApi } from '@machafoundation/core';

/**
 * Where artwork can be loaded from, and what has already loaded. Kept apart
 * from `LazyArtwork.tsx` so it can be tested without `expo-image`.
 */

/**
 * Artwork id → the last URL that loaded. The server re-signs a capability URL
 * on every catalogue fetch and `expo-image` caches by URL, so the URL that
 * worked is reused; see `macha-client` `src/components/LazyArtwork.tsx`.
 * Module-scoped, to survive a card's remount.
 */
const lastLoadedUrlById = new Map<string, string>();

/**
 * Everywhere this artwork can be loaded from, best first: the remembered URL,
 * then each node's in cluster order. URLs needing an `Authorization` header
 * are dropped: an `Image` source cannot send one.
 */
export function artworkSources(api: MediaApi, ref: ArtworkRef): string[] {
  const remembered = lastLoadedUrlById.get(ref.id);
  const candidates = api
    .artworkUrls(ref)
    .filter((source) => !source.requiresAuthorization)
    .map((source) => source.url);
  const ordered = remembered ? [remembered, ...candidates] : candidates;
  return [...new Set(ordered)];
}

/** Record that this URL loaded, so a re-sign is ignored. */
export function rememberArtworkUrl(id: string, url: string): void {
  lastLoadedUrlById.set(id, url);
}

/** Forget a URL that failed, so an expired one does not stay first in the plan. */
export function forgetArtworkUrl(id: string, url: string): void {
  if (lastLoadedUrlById.get(id) === url) lastLoadedUrlById.delete(id);
}

/** Clears the module-level memory, for tests. */
export function forgetArtworkUrls(): void {
  lastLoadedUrlById.clear();
}
