import type { ArtworkRef, MediaApi } from '@machafoundation/core';

/**
 * Where artwork can be loaded from, and what has already loaded.
 *
 * Separate from `LazyArtwork.tsx` because it is the half with rules in it and
 * none of them need a renderer — the component is two lines of plumbing over
 * this. Importing the component into a test would drag in `expo-image` and the
 * whole Expo runtime for logic that is plain data.
 */

/**
 * Artwork id → the last URL that actually loaded.
 *
 * **The server re-signs a capability URL on every catalogue fetch**, even when
 * the image has not changed and the previous signature has not expired
 * (`types.ts:9-15` says so, and `macha-client/src/components/LazyArtwork.tsx:23`
 * explains what it costs). `expo-image` caches by URL, so handing it each fresh
 * signature churns the cache key itself: every revisit to a library screen
 * re-downloads and re-decodes every poster already on it, and the server's
 * `Cache-Control` never gets a chance to matter.
 *
 * Remembering the URL that worked means a same-image re-sign is ignored in
 * favour of the copy already cached. A real failure forgets the entry and falls
 * through to the next candidate.
 *
 * Module-scoped deliberately: the point is to survive the unmount and remount
 * of the card, which is exactly what scrolling a library does.
 */
const lastLoadedUrlById = new Map<string, string>();

/**
 * Everywhere this artwork can be loaded from, best first.
 *
 * The copy known to be cached, then every URL that needs no header — the same
 * capability on each node, in the cluster's own order. Artwork is
 * content-addressed, so any node holding it will do, and a node failing to
 * serve one image should not cost the viewer the image.
 *
 * Anything wanting an `Authorization` header is dropped rather than left to
 * fail: an `Image` source cannot carry one.
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

/** Record that this URL actually produced an image, so a re-sign is ignored. */
export function rememberArtworkUrl(id: string, url: string): void {
  lastLoadedUrlById.set(id, url);
}

/**
 * Forget a URL that failed.
 *
 * Without this a remembered copy that has genuinely expired stays first in
 * every plan forever, and the artwork never recovers.
 */
export function forgetArtworkUrl(id: string, url: string): void {
  if (lastLoadedUrlById.get(id) === url) lastLoadedUrlById.delete(id);
}

/** The memory is module state; tests need it not to leak between cases. */
export function forgetArtworkUrls(): void {
  lastLoadedUrlById.clear();
}
