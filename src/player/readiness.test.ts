import { describe, expect, it, vi } from 'vitest';
import { playbackFailureKindForStatus, type PlaybackSource } from '@machafoundation/core';
import { awaitFirstFragment, holdBackoffMs } from './readiness';
import {
  FIRST_FRAGMENT_TIMEOUT_MS,
  HOLD_RETRY_BASE_MS,
  HOLD_RETRY_CEILING_MS,
  SERVER_SEGMENT_HOLD_MS,
} from './timingBudgets';

const MASTER = '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1\nvariant.m3u8\n';
const MEDIA = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\nseg1.m4s\n';

function source(overrides: Partial<PlaybackSource> = {}): PlaybackSource {
  return {
    url: 'https://node-a.test/g/index.m3u8',
    isManifest: true,
    mode: 'transcode',
    ...overrides,
  } as PlaybackSource;
}

function response(status: number, body = '', headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers[name] ?? null },
    text: async () => body,
  } as unknown as Response;
}

/** A clock and a sleep that advance together. */
function fakeHost() {
  let clock = 0;
  return {
    options: {
      now: () => clock,
      sleep: async (ms: number) => { clock += ms; },
    },
    advance: (ms: number) => { clock += ms; },
    get clock() { return clock; },
  };
}

describe('awaitFirstFragment', () => {
  it('is ready when the playlist and its fragments answer', async () => {
    const host = fakeHost();
    const fetchImpl = vi.fn(async (url: string) => (
      url.endsWith('index.m3u8') ? response(200, MASTER)
        : url.endsWith('variant.m3u8') ? response(200, MEDIA)
          : response(206)
    )) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...host.options });

    expect(readiness.ready).toBe(true);
    expect(readiness.attempts).toBe(1);
  });

  it('probes the fragment with one byte, not a segment', async () => {
    // Asserted on the fragment leg only: the playlist legs are core's to change.
    const seen: [string, RequestInit][] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      seen.push([url, init]);
      return url.endsWith('index.m3u8') ? response(200, MEDIA) : response(206);
    }) as unknown as typeof fetch;

    await awaitFirstFragment(source(), { fetchImpl, ...fakeHost().options });

    const fragments = seen.filter(([url]) => !url.endsWith('.m3u8'));
    expect(fragments.length).toBeGreaterThan(0);
    for (const [, init] of fragments) {
      expect((init.headers as Record<string, string>).Range).toBe('bytes=0-0');
    }
  });

  it('keeps Range non-overridable by a source header', async () => {
    // A source header widening Range would turn the probe into a full fetch.
    const seen: RequestInit[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      seen.push(init);
      return url.endsWith('index.m3u8') ? response(200, MEDIA) : response(206);
    }) as unknown as typeof fetch;

    await awaitFirstFragment(
      source({ headers: { Range: 'bytes=0-999999', Authorization: 'Bearer t' } }),
      { fetchImpl, ...fakeHost().options },
    );

    const fragment = seen.at(-1)!.headers as Record<string, string>;
    expect(fragment.Range).toBe('bytes=0-0');
    // The rest of the source's headers still have to arrive.
    expect(fragment.Authorization).toBe('Bearer t');
  });

  it('waits out a hold on the same node and then succeeds', async () => {
    // A 500 is the node still producing the fragment; failing over cannot help.
    const host = fakeHost();
    let fragmentAttempts = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('index.m3u8')) return response(200, MEDIA);
      fragmentAttempts += 1;
      return fragmentAttempts < 3 ? response(500) : response(206);
    }) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...host.options });

    expect(readiness.ready).toBe(true);
    expect(readiness.attempts).toBe(3);
    expect(readiness.waitedMs).toBeGreaterThan(0);
  });

  it('does not wait out a broken generation or a genuine miss', async () => {
    // 503 is terminal and 404 is past the end of the plan.
    for (const status of [503, 404]) {
      const fetchImpl = vi.fn(async (url: string) => (
        url.endsWith('index.m3u8') ? response(200, MEDIA) : response(status)
      )) as unknown as typeof fetch;

      const readiness = await awaitFirstFragment(source(), { fetchImpl, ...fakeHost().options });

      expect(readiness.ready, `status ${status}`).toBe(false);
      expect(readiness.attempts, `status ${status}`).toBe(1);
      expect(readiness.reason).toContain(String(status));
    }
  });

  it('asks core which status is a hold rather than hardcoding one', () => {
    expect(playbackFailureKindForStatus(500)).toBe('not-ready');
    expect(playbackFailureKindForStatus(503)).toBe('stream');
  });

  it('honours a stated Retry-After, capped at the backoff ceiling', async () => {
    const host = fakeHost();
    let fragmentAttempts = 0;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('index.m3u8')) return response(200, MEDIA);
      fragmentAttempts += 1;
      return fragmentAttempts < 2 ? response(500, '', { 'Retry-After': '9999' }) : response(206);
    }) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...host.options });

    expect(readiness.ready).toBe(true);
    // One bad header must not park playback for the rest of the budget.
    expect(readiness.waitedMs).toBeLessThanOrEqual(HOLD_RETRY_CEILING_MS);
  });

  it('gives up once waiting again would pass the deadline', async () => {
    const host = fakeHost();
    const fetchImpl = vi.fn(async (url: string) => (
      url.endsWith('index.m3u8') ? response(200, MEDIA) : response(500)
    )) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...host.options });

    expect(readiness.ready).toBe(false);
    expect(readiness.waitedMs).toBeLessThanOrEqual(FIRST_FRAGMENT_TIMEOUT_MS);
    // The reason carries how long it held out.
    expect(readiness.reason).toMatch(/after \d+s/);
  });

  it('abandons the wait when a later generation takes over', async () => {
    // `play()` can be called again while this runs; finishing would hand
    // the player a stale source.
    const host = fakeHost();
    let superseded = false;
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('index.m3u8')) return response(200, MEDIA);
      superseded = true;
      return response(500);
    }) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), {
      fetchImpl,
      ...host.options,
      superseded: () => superseded,
    });

    expect(readiness.ready).toBe(false);
    expect(readiness.attempts).toBe(1);
  });

  it('treats a transfer that never became a response as node evidence', async () => {
    // Not waited out, and the thrown message must reach the failure trail.
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...fakeHost().options });

    expect(readiness.ready).toBe(false);
    expect(readiness.attempts).toBe(1);
    expect(readiness.reason).toBe('network down');
  });

  it('does not condemn a node over a manifest it could not assess', async () => {
    // Variants nested past one level leave core no targets: `unassessable`,
    // which is not a refusal.
    const fetchImpl = vi.fn(async () => response(200, MASTER)) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...fakeHost().options });

    expect(readiness.ready).toBe(true);
  });
});

describe('hold backoff', () => {
  it('starts at the declared base and grows to the declared ceiling', () => {
    expect(holdBackoffMs(1)).toBe(HOLD_RETRY_BASE_MS);
    expect(holdBackoffMs(2)).toBe(HOLD_RETRY_BASE_MS * 2);
    expect(holdBackoffMs(99)).toBe(HOLD_RETRY_CEILING_MS);
  });

  it('never retries faster than a hold costs to produce', () => {
    for (const attempt of [1, 2, 5, 50]) {
      expect(holdBackoffMs(attempt)).toBeGreaterThanOrEqual(HOLD_RETRY_BASE_MS);
    }
  });
});

describe('the first-fragment budget against the server hold', () => {
  it('allows more than one hold, so a node is not abandoned as it speaks', () => {
    // The node answers at the end of a hold, so a budget of one hold would
    // abandon it as it spoke.
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS * 2);
  });

  it('leaves room for at least one backoff inside the budget', () => {
    expect(HOLD_RETRY_CEILING_MS).toBeLessThan(FIRST_FRAGMENT_TIMEOUT_MS);
  });
});
