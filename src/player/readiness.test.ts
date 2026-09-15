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

/** A clock and a sleep that advance together, so a test never waits in real time. */
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
    // A probe that pulled a whole fragment would cost a television a segment
    // of traffic per attempt, on the node already struggling to produce it.
    //
    // Asserted on the fragment leg only. Core currently sends the 64 KB
    // preflight range on the *playlist* legs too — reported to the core
    // session — and pinning that here would fail the suite when they fix it.
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
    // Core's decision: source headers beat the cache headers, but never the
    // Range. A header widening it silently turns the probe into a full fetch.
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
    // The whole point: a 500 is the node saying it is producing the fragment
    // it already promised. Failing over cannot help — the next node is
    // producing a different generation and does not have it either.
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
    // 503 is terminal and 404 is past the end of the plan. Sitting patiently
    // on either is the mistake a hold-aware caller makes in the other
    // direction.
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
    // If core reassigns the hold status this client must follow without being
    // edited. Core's own `Platform.ts` currently documents 503 where four
    // other places say 500, so a local literal is a real hazard here.
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
    // The reason has to carry how long it held out, or the trail shows a
    // refusal with no sense of whether it was patient or instant.
    expect(readiness.reason).toMatch(/after \d+s/);
  });

  it('abandons the wait when a later generation takes over', async () => {
    // `play()` can be called again while this runs. Finishing afterwards
    // would hand the player a source two generations stale.
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
    // Not something to wait out: it says nothing about the fragment.
    //
    // The thrown message has to survive as far as the failure trail: on a
    // television it is the only place anyone can read it, and a generic
    // "did not answer" cannot be told apart from a node that answered badly.
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;

    const readiness = await awaitFirstFragment(source(), { fetchImpl, ...fakeHost().options });

    expect(readiness.ready).toBe(false);
    expect(readiness.attempts).toBe(1);
    expect(readiness.reason).toBe('network down');
  });

  it('does not condemn a node over a manifest it could not assess', async () => {
    // Variants nested past one level leave core with no targets, which it
    // reports as `unassessable` rather than as a refusal. That is not a
    // finding against the node, and treating it as one would destroy a source
    // the player might well have played — the same mistake that once made
    // every Samsung standby fail its own validation.
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
    // Retrying faster than the node can produce is pure load on a node that
    // already waited out its own hold before answering.
    for (const attempt of [1, 2, 5, 50]) {
      expect(holdBackoffMs(attempt)).toBeGreaterThanOrEqual(HOLD_RETRY_BASE_MS);
    }
  });
});

describe('the first-fragment budget against the server hold', () => {
  it('allows several holds rather than one', () => {
    // One hold's worth of patience is no patience at all: the node answers at
    // the end of a hold, so a budget of one would abandon it just as it spoke.
    expect(FIRST_FRAGMENT_TIMEOUT_MS).toBeGreaterThan(SERVER_SEGMENT_HOLD_MS * 3);
  });

  it('leaves room for at least one backoff inside the budget', () => {
    expect(HOLD_RETRY_CEILING_MS).toBeLessThan(FIRST_FRAGMENT_TIMEOUT_MS);
  });
});
