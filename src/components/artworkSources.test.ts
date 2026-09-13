import { beforeEach, describe, expect, it } from 'vitest';
import type { ArtworkRef, MediaApi } from '@macha/core';
import {
  artworkSources,
  forgetArtworkUrl,
  forgetArtworkUrls,
  rememberArtworkUrl,
} from './artworkSources';

/**
 * The source *plan* is the part with rules in it, and it is plain data, so it
 * is tested directly rather than through a renderer. What the component does
 * with the plan is two lines: render `sources[index]`, and advance on error.
 */

function api(sources: { url: string; requiresAuthorization: boolean }[]): MediaApi {
  return { artworkUrls: () => sources } as unknown as MediaApi;
}

const ref = (url?: string): ArtworkRef => ({ id: 'artwork-1', mimeType: 'image/jpeg', ...(url ? { url } : {}) });

beforeEach(() => forgetArtworkUrls());

describe('the artwork source plan', () => {
  it('offers every node, because artwork is content-addressed', () => {
    const sources = artworkSources(
      api([
        { url: 'https://node-a.test/art/1', requiresAuthorization: false },
        { url: 'https://node-b.test/art/1', requiresAuthorization: false },
      ]),
      ref(),
    );
    expect(sources).toEqual(['https://node-a.test/art/1', 'https://node-b.test/art/1']);
  });

  it('drops a URL needing an Authorization header, which an Image cannot send', () => {
    const sources = artworkSources(
      api([
        { url: 'https://node-a.test/art/1', requiresAuthorization: true },
        { url: 'https://node-b.test/art/1', requiresAuthorization: false },
      ]),
      ref(),
    );
    expect(sources).toEqual(['https://node-b.test/art/1']);
  });

  it('keeps the cluster order core gave it', () => {
    const urls = ['c', 'a', 'b'].map((n) => ({ url: `https://${n}.test/art/1`, requiresAuthorization: false }));
    expect(artworkSources(api(urls), ref())).toEqual(urls.map((u) => u.url));
  });

  it('de-duplicates, so one node is never tried twice in a row', () => {
    const same = { url: 'https://node-a.test/art/1', requiresAuthorization: false };
    expect(artworkSources(api([same, same]), ref())).toHaveLength(1);
  });

  it('reports nothing loadable when every URL needs authorization', () => {
    expect(artworkSources(api([{ url: 'https://a.test/x', requiresAuthorization: true }]), ref())).toEqual([]);
  });
});

/**
 * The reason this component exists. The server re-signs a capability URL on
 * every catalogue fetch even when the image has not changed, and `expo-image`
 * caches by URL — so without a memory, every revisit to a library screen
 * re-downloads and re-decodes every poster already on it.
 */
describe('remembering what actually loaded', () => {
  it('prefers the copy known to be cached over a fresh signature', () => {
    const first = artworkSources(
      api([{ url: 'https://node-a.test/art/1?sig=one', requiresAuthorization: false }]),
      ref('https://node-a.test/art/1?sig=one'),
    );
    // Simulate the image loading, which is what the component records.
    rememberArtworkUrl('artwork-1', first[0]!);

    const resigned = artworkSources(
      api([{ url: 'https://node-a.test/art/1?sig=two', requiresAuthorization: false }]),
      ref('https://node-a.test/art/1?sig=two'),
    );
    expect(resigned[0]).toBe('https://node-a.test/art/1?sig=one');
  });

  it('still offers the fresh signature behind it, for when the cached copy really has expired', () => {
    rememberArtworkUrl('artwork-1', 'https://node-a.test/art/1?sig=one');
    const resigned = artworkSources(
      api([{ url: 'https://node-a.test/art/1?sig=two', requiresAuthorization: false }]),
      ref('https://node-a.test/art/1?sig=two'),
    );
    expect(resigned).toEqual([
      'https://node-a.test/art/1?sig=one',
      'https://node-a.test/art/1?sig=two',
    ]);
  });

  it('does not offer a remembered URL twice when it is still current', () => {
    const url = 'https://node-a.test/art/1?sig=one';
    rememberArtworkUrl('artwork-1', url);
    expect(artworkSources(api([{ url, requiresAuthorization: false }]), ref(url))).toEqual([url]);
  });

  it('forgets everything on request, so the memory cannot leak between screens in a test', () => {
    rememberArtworkUrl('artwork-1', 'https://node-a.test/art/1?sig=one');
    forgetArtworkUrls();
    const sources = artworkSources(
      api([{ url: 'https://node-a.test/art/1?sig=two', requiresAuthorization: false }]),
      ref(),
    );
    expect(sources).toEqual(['https://node-a.test/art/1?sig=two']);
  });
});

describe('forgetting a URL that failed', () => {
  it('drops the remembered copy so the fresh signature is tried next', () => {
    const stale = 'https://node-a.test/art/1?sig=one';
    rememberArtworkUrl('artwork-1', stale);
    forgetArtworkUrl('artwork-1', stale);
    const sources = artworkSources(
      api([{ url: 'https://node-a.test/art/1?sig=two', requiresAuthorization: false }]),
      ref(),
    );
    expect(sources).toEqual(['https://node-a.test/art/1?sig=two']);
  });

  it('leaves a newer memory alone when an older URL fails late', () => {
    // Two loads raced; the stale one failing must not evict the good entry.
    rememberArtworkUrl('artwork-1', 'https://node-a.test/art/1?sig=two');
    forgetArtworkUrl('artwork-1', 'https://node-a.test/art/1?sig=one');
    const sources = artworkSources(
      api([{ url: 'https://node-a.test/art/1?sig=three', requiresAuthorization: false }]),
      ref(),
    );
    expect(sources[0]).toBe('https://node-a.test/art/1?sig=two');
  });
});
