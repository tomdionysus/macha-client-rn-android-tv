import { describe, expect, it, vi } from 'vitest';
import type { PlaybackSource } from '@macha/core';
import { hlsPreflightTargets, preflightHlsSource, resolveUrl } from './preflight';

const BASE = 'https://node.macha.test/hls/abc123/index.m3u8';

/**
 * These pin the behaviour React Native's own `URL` gets wrong.
 *
 * Every case below is one RN would answer by concatenating the reference onto
 * the base, which for the very first case yields `.../index.m3u8seg1.m4s`. The
 * consequence is not a bad URL, it is that every warm standby fails its own
 * preflight and gets destroyed, so these are the tests that matter most in
 * this file.
 */
describe('relative URL resolution', () => {
  it('replaces the document segment rather than appending to it', () => {
    expect(resolveUrl('seg1.m4s', BASE)).toBe('https://node.macha.test/hls/abc123/seg1.m4s');
  });

  it('resolves root-relative references against the origin, not the directory', () => {
    expect(resolveUrl('/media/init.mp4', BASE)).toBe('https://node.macha.test/media/init.mp4');
  });

  it('climbs with ..', () => {
    expect(resolveUrl('../shared/init.mp4', BASE)).toBe('https://node.macha.test/hls/shared/init.mp4');
  });

  it('collapses . without moving', () => {
    expect(resolveUrl('./seg1.m4s', BASE)).toBe('https://node.macha.test/hls/abc123/seg1.m4s');
  });

  it('refuses to climb above the root', () => {
    expect(resolveUrl('../../../../etc/passwd', BASE)).toBe('https://node.macha.test/etc/passwd');
  });

  it('leaves an absolute reference alone', () => {
    const absolute = 'https://other.macha.test/x.m4s';
    expect(resolveUrl(absolute, BASE)).toBe(absolute);
  });

  it('takes the scheme from the base for a protocol-relative reference', () => {
    expect(resolveUrl('//cdn.macha.test/x.m4s', BASE)).toBe('https://cdn.macha.test/x.m4s');
  });

  it('preserves a query on the reference', () => {
    expect(resolveUrl('seg1.m4s?token=abc', BASE))
      .toBe('https://node.macha.test/hls/abc123/seg1.m4s?token=abc');
  });

  it('does not carry the base query onto the reference', () => {
    // A signed capability URL carries its authority in the query. Inheriting
    // it onto a different path would send a signature for the wrong resource.
    expect(resolveUrl('seg1.m4s', `${BASE}?sig=deadbeef`))
      .toBe('https://node.macha.test/hls/abc123/seg1.m4s');
  });

  it('replaces only the query when the reference is a bare query', () => {
    expect(resolveUrl('?v=2', BASE)).toBe('https://node.macha.test/hls/abc123/index.m3u8?v=2');
  });

  it('treats a directory base as a directory', () => {
    expect(resolveUrl('seg1.m4s', 'https://node.macha.test/hls/abc123/'))
      .toBe('https://node.macha.test/hls/abc123/seg1.m4s');
  });
});

describe('HLS preflight targets', () => {
  it('descends into the first variant of a master playlist', () => {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080',
      'v0/index.m3u8',
      '#EXT-X-STREAM-INF:BANDWIDTH=1200000',
      'v1/index.m3u8',
    ].join('\n');
    expect(hlsPreflightTargets(manifest, BASE)).toEqual({
      variantUrl: 'https://node.macha.test/hls/abc123/v0/index.m3u8',
      mediaUrls: [],
    });
  });

  it('takes the init segment and the first fragment from a media playlist', () => {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-MAP:URI="init.mp4"',
      '#EXTINF:6.0,',
      'seg1.m4s',
      '#EXTINF:6.0,',
      'seg2.m4s',
    ].join('\n');
    expect(hlsPreflightTargets(manifest, BASE).mediaUrls).toEqual([
      'https://node.macha.test/hls/abc123/init.mp4',
      'https://node.macha.test/hls/abc123/seg1.m4s',
    ]);
  });

  it('does not request the same URL twice when map and segment agree', () => {
    const manifest = ['#EXTM3U', '#EXT-X-MAP:URI="seg1.m4s"', '#EXTINF:6.0,', 'seg1.m4s'].join('\n');
    expect(hlsPreflightTargets(manifest, BASE).mediaUrls).toHaveLength(1);
  });

  it('survives CRLF line endings', () => {
    const manifest = '#EXTM3U\r\n#EXT-X-MAP:URI="init.mp4"\r\n#EXTINF:6.0,\r\nseg1.m4s\r\n';
    expect(hlsPreflightTargets(manifest, BASE).mediaUrls).toHaveLength(2);
  });
});

function source(overrides: Partial<PlaybackSource> = {}): PlaybackSource {
  return { url: BASE, isManifest: true, ...overrides } as PlaybackSource;
}

function response(body: string, init: { ok?: boolean; bytes?: number } = {}): Response {
  const ok = init.ok ?? true;
  return {
    ok,
    text: async () => body,
    arrayBuffer: async () => new ArrayBuffer(init.bytes ?? body.length),
    body: null,
  } as unknown as Response;
}

const MEDIA_PLAYLIST = ['#EXTM3U', '#EXT-X-MAP:URI="init.mp4"', '#EXTINF:6.0,', 'seg1.m4s'].join('\n');

describe('preflighting a source', () => {
  it('accepts a manifest whose media targets deliver bytes', async () => {
    const fetchImpl = vi.fn(async () => response(MEDIA_PLAYLIST, { bytes: 4096 }));
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch)).resolves.toBe(true);
  });

  it('range-requests the media targets rather than pulling whole fragments', async () => {
    const fetchImpl = vi.fn(async () => response(MEDIA_PLAYLIST, { bytes: 4096 }));
    await preflightHlsSource(source(), fetchImpl as unknown as typeof fetch);
    const mediaCall = fetchImpl.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect((mediaCall[1].headers as Record<string, string>).Range).toBe('bytes=0-65535');
  });

  it('asks for a fresh answer, since a cached manifest can outlive its node', async () => {
    const fetchImpl = vi.fn(async () => response(MEDIA_PLAYLIST, { bytes: 4096 }));
    await preflightHlsSource(source(), fetchImpl as unknown as typeof fetch);
    const first = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((first[1].headers as Record<string, string>)['Cache-Control']).toContain('no-cache');
  });

  it('never appends a cache-buster, which would break a signed URL', async () => {
    const fetchImpl = vi.fn(async () => response(MEDIA_PLAYLIST, { bytes: 4096 }));
    const signed = `${BASE}?sig=deadbeef`;
    await preflightHlsSource(source({ url: signed }), fetchImpl as unknown as typeof fetch);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe(signed);
  });

  it('forwards the source headers a host requires', async () => {
    const fetchImpl = vi.fn(async () => response(MEDIA_PLAYLIST, { bytes: 4096 }));
    await preflightHlsSource(
      source({ headers: { Authorization: 'Bearer x' } }),
      fetchImpl as unknown as typeof fetch,
    );
    const first = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((first[1].headers as Record<string, string>).Authorization).toBe('Bearer x');
  });

  it('rejects a node that answers the manifest but serves an empty fragment', async () => {
    // The case a status code cannot catch: a node near the production frontier
    // answers 200 with nothing in it.
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('.m3u8') ? response(MEDIA_PLAYLIST) : response('', { bytes: 0 }));
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
  });

  it('rejects a manifest the node will not serve', async () => {
    const fetchImpl = vi.fn(async () => response('', { ok: false }));
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
  });

  it('rejects a media playlist with nothing to fetch', async () => {
    const fetchImpl = vi.fn(async () => response('#EXTM3U\n#EXT-X-ENDLIST'));
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
  });

  it('walks exactly one variant deep and then gives up', async () => {
    const master = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nnested.m3u8';
    const fetchImpl = vi.fn(async () => response(master));
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch)).resolves.toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('keeps a standby it has no way to assess, rather than destroying it', async () => {
    // The web client answers `false` here. It can afford to: in a browser every
    // non-direct mode is HLS. Core states `isManifest` on the source rather
    // than deriving it from the mode, so a `remux` standby need not be one —
    // and `false` would throw away a standby `play()` could still promote.
    const fetchImpl = vi.fn();
    await expect(preflightHlsSource(source({ isManifest: false }), fetchImpl as unknown as typeof fetch))
      .resolves.toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('gives the standby the benefit of the doubt when the body cannot be measured', async () => {
    // Returning false destroys the standby. A response this platform cannot
    // read the size of is not evidence the node is dead — reading it as such is
    // how the web client once failed every Samsung standby it prepared.
    const unmeasurable = {
      ok: true,
      text: async () => MEDIA_PLAYLIST,
      arrayBuffer: async () => new ArrayBuffer(8),
      body: null,
    } as unknown as Response;
    const fetchImpl = vi.fn(async () => unmeasurable);
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch)).resolves.toBe(true);
  });

  it('aborts rather than hanging on a node that never answers', async () => {
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    await expect(preflightHlsSource(source(), fetchImpl as unknown as typeof fetch, 10))
      .rejects.toThrow('aborted');
  });
});
