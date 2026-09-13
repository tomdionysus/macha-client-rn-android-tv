import type { PlaybackSource } from '@macha/core';

/**
 * Validate a transformed source without attaching a decoder.
 *
 * This is the cheap half of seamless failover, and the half that needs nothing
 * from the player: core's `Player.preflightSource` hook asks "will this node
 * serve these bytes", which is a question about the network. `macha-client`
 * answers it by walking the manifest one variant deep and range-requesting the
 * first 64 KB of each media target (`WebPlatform.ts:110`), and Tom confirms it
 * works on the Samsung set. This is that walk, against this platform's
 * primitives.
 *
 * It is deliberately **not** a copy. Two of the browser primitives the web
 * version leans on behave differently under React Native, and both failures
 * would be silent — see `resolveUrl` and `NO_CACHE_HEADERS` below.
 */

/**
 * Resolve a possibly-relative URL against a base, per RFC 3986 §5.3.
 *
 * **React Native's `URL` cannot do this and does not say so.** Its relative
 * handling (`Libraries/Blob/URL.js:112-121`) strips one trailing slash from the
 * base and concatenates:
 *
 * ```js
 * if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, baseUrl.length - 1);
 * this._url = `${baseUrl}${url}`;
 * ```
 *
 * So a manifest at `.../abc/index.m3u8` naming `seg1.m4s` resolves to
 * `.../abc/index.m3u8seg1.m4s` rather than `.../abc/seg1.m4s`, and `../` and
 * root-relative forms are not handled at all. Every media target would 404,
 * every preflight would return `false`, and **every warm standby would be
 * discarded** — which is precisely the outcome the web client's own Tizen
 * comment was written to prevent, reached by a different mechanism.
 *
 * HLS playlists carry relative URIs as a matter of course, so this is the
 * normal path, not an edge case.
 */
export function resolveUrl(reference: string, base: string): string {
  const target = reference.trim();
  if (target === '') return base;

  // Already absolute: a scheme makes the base irrelevant.
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return target;

  const origin = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#]*)/i.exec(base);
  if (!origin) return target;
  const root = `${origin[1]}//${origin[2]}`;

  // Protocol-relative, then root-relative: neither consults the base path.
  if (target.startsWith('//')) return `${origin[1]}${target}`;
  if (target.startsWith('/')) return root + normalizePath(target);

  if (target.startsWith('?') || target.startsWith('#')) {
    return base.split(/[?#]/)[0] + target;
  }

  // Everything the base contributes is its directory: the last segment of a
  // path is the document, not a folder, and is replaced rather than extended.
  const basePath = base.slice(root.length).split(/[?#]/)[0] || '/';
  const directory = basePath.slice(0, basePath.lastIndexOf('/') + 1) || '/';
  return root + normalizePath(directory + target);
}

/** Collapse `.` and `..` segments, per RFC 3986 §5.2.4. */
function normalizePath(path: string): string {
  const [pathname, ...rest] = path.split(/(?=[?#])/);
  const trailing = rest.join('');
  const output: string[] = [];
  for (const segment of (pathname ?? '').split('/')) {
    if (segment === '.') continue;
    if (segment === '..') {
      // Never climb past the root: a manifest cannot address outside its host.
      if (output.length > 1) output.pop();
      continue;
    }
    output.push(segment);
  }
  let resolved = output.join('/');
  if (!resolved.startsWith('/')) resolved = `/${resolved}`;
  // A trailing `.` or `..` names a directory, so the slash survives them.
  if (/\/(\.|\.\.)$/.test(pathname ?? '') && !resolved.endsWith('/')) resolved += '/';
  return resolved + trailing;
}

/**
 * Ask for a fresh answer without touching the URL.
 *
 * React Native's `fetch` is a polyfill over `XMLHttpRequest` and **ignores the
 * `cache` option entirely**, so the web version's `cache: 'no-store'` is a
 * no-op here. A cached manifest would let a node that has since died pass its
 * own preflight, which is the one answer this function must never give.
 *
 * Stated as request headers instead. The alternative — a cache-busting query
 * parameter — is specifically wrong for Macha: media is reached by signed
 * capability URLs that carry their own authority, and appending a parameter
 * would alter what was signed.
 */
const NO_CACHE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-cache, no-store',
  Pragma: 'no-cache',
};

/** The first playlist URI in a manifest — the first line that is not a tag. */
function firstPlaylistUri(lines: readonly string[]): string | undefined {
  return lines.map((line) => line.trim()).find((line) => Boolean(line) && !line.startsWith('#'));
}

/**
 * What to fetch to prove a manifest is being served.
 *
 * A master playlist yields the first variant to descend into; a media playlist
 * yields its initialisation segment and first fragment. Ported from
 * `webHlsPreflightTargets` (`macha-client/src/platform/WebPlatform.ts:71`),
 * with this platform's URL resolution.
 */
export function hlsPreflightTargets(manifest: string, manifestUrl: string): {
  variantUrl?: string;
  mediaUrls: string[];
} {
  const lines = manifest.split(/\r?\n/);
  if (lines.some((line) => line.trim().startsWith('#EXT-X-STREAM-INF'))) {
    const variant = firstPlaylistUri(lines);
    return { variantUrl: variant ? resolveUrl(variant, manifestUrl) : undefined, mediaUrls: [] };
  }
  const map = lines
    .map((line) => /^#EXT-X-MAP:.*\bURI="([^"]+)"/i.exec(line.trim())?.[1])
    .find(Boolean);
  const segment = firstPlaylistUri(lines);
  const mediaUrls = [map, segment]
    .filter((value): value is string => Boolean(value))
    .map((value) => resolveUrl(value, manifestUrl))
    .filter((value, index, all) => all.indexOf(value) === index);
  return { mediaUrls };
}

/**
 * Did bytes actually arrive?
 *
 * A `200` proves the node answered, not that it produced anything — a node
 * near the production frontier can answer a fragment request with an empty
 * body. The web client reads the first chunk for exactly this reason.
 *
 * Where the response carries no readable body **the benefit of the doubt goes
 * to the standby**. `false` here means "this node will not serve", and the
 * coordinator destroys the standby on it (`PlaybackCoordinator.ts:1305`).
 * Reporting an inability to measure as a failure is how the web client once
 * made every Samsung standby fail its own validation.
 */
async function readFirstResponseBytes(response: Response): Promise<boolean> {
  if (!response.ok) return false;
  const body = response.body as ReadableStream<Uint8Array> | null | undefined;
  if (!body?.getReader) {
    // React Native's fetch resolves the whole body rather than streaming it,
    // so this is the normal path here, not the fallback it is on the web.
    const buffer = await response.arrayBuffer();
    return buffer.byteLength > 0;
  }
  const reader = body.getReader();
  try {
    const first = await reader.read();
    return !first.done && Boolean(first.value?.byteLength);
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * Validate an HLS source by walking it, without allocating a decoder.
 *
 * Returns `false` only as a *finding* — the node did not serve. Anything this
 * function cannot determine resolves in the standby's favour, because the
 * caller treats `false` as grounds to throw the standby away and a preflight
 * that cannot tell has no grounds for that.
 */
export async function preflightHlsSource(
  source: PlaybackSource,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 5_000,
): Promise<boolean> {
  // **Deliberately not the web client's answer**, which returns `false` here.
  //
  // Core only preflights non-`direct` modes, and in a browser those are always
  // HLS, so there the two answers never differ. That is not guaranteed: the
  // modes are `remux` and `transcode`, and `isManifest` is stated by the
  // resolver rather than implied by the mode — `types.ts:265` says so in as
  // many words, "never infer this from the extension or the mode".
  //
  // So a non-manifest source reaching here is one this walk has no way to
  // assess, not one it has judged. `false` would destroy a standby that
  // `play()` could still promote, and the coordinator is explicit that a
  // transport preflight "must never gate creation of that standby"
  // (`PlaybackCoordinator.ts:1263`).
  if (!source.isManifest) return true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let manifestUrl = source.url;
    for (let depth = 0; depth < 2; depth += 1) {
      const response = await fetchImpl(manifestUrl, {
        method: 'GET',
        headers: { ...NO_CACHE_HEADERS, ...source.headers },
        signal: controller.signal,
      });
      if (!response.ok) return false;
      const targets = hlsPreflightTargets(await response.text(), manifestUrl);
      if (targets.variantUrl) {
        manifestUrl = targets.variantUrl;
        continue;
      }
      if (targets.mediaUrls.length === 0) return false;
      for (const url of targets.mediaUrls) {
        const media = await fetchImpl(url, {
          method: 'GET',
          headers: { Range: 'bytes=0-65535', ...NO_CACHE_HEADERS, ...source.headers },
          signal: controller.signal,
        });
        if (!await readFirstResponseBytes(media)) return false;
      }
      return true;
    }
    // Two levels deep and still a master playlist: not a shape we serve.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
