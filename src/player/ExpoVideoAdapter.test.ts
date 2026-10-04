import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENDPOINT_TRANSPORT_ALLOWANCE_MS, MediaStallWatchdog } from '@machafoundation/core';
import type { PlaybackSource, PlaybackSourceError } from '@machafoundation/core';
import { FIRST_FRAGMENT_TIMEOUT_MS, HOLD_RETRY_CEILING_MS } from './timingBudgets';

/** A stand-in for `expo-video`'s `VideoPlayer`: only what the adapter touches. */
class FakeVideoPlayer {
  playing = false;
  currentTime = 0;
  duration = 0;
  volume = 1;
  bufferedPosition = 0;
  status: 'idle' | 'loading' | 'readyToPlay' | 'error' = 'idle';
  keepScreenOnWhilePlaying = false;
  timeUpdateEventInterval = 0;
  subtitleTrack: unknown = null;
  availableSubtitleTracks: { label: string }[] = [];
  released = false;

  /** What `createVideoPlayer` was handed; a standby is primed at construction. */
  initialSource: unknown = undefined;
  readonly replaced: unknown[] = [];
  readonly calls: string[] = [];
  private listeners = new Map<string, ((payload: never) => void)[]>();

  addListener(event: string, listener: (payload: never) => void) {
    const existing = this.listeners.get(event) ?? [];
    this.listeners.set(event, [...existing, listener]);
    return { remove: () => this.listeners.set(event, (this.listeners.get(event) ?? []).filter((l) => l !== listener)) };
  }

  emit(event: string, payload?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) (listener as (p: unknown) => void)(payload);
  }

  play(): void { this.calls.push('play'); this.playing = true; }
  pause(): void { this.calls.push('pause'); this.playing = false; }
  replace(source: unknown): void { this.calls.push('replace'); this.replaced.push(source); }
  release(): void { this.released = true; }
}

let fake: FakeVideoPlayer;
/** Every player the adapter constructed, in order. */
let created: FakeVideoPlayer[];

vi.mock('expo-video', () => ({
  createVideoPlayer: (initial?: unknown) => {
    // The first is the active player (`fake`); any later one is a standby.
    const player = created.length === 0 ? fake : new FakeVideoPlayer();
    player.initialSource = initial;
    created.push(player);
    return player;
  },
}));

vi.mock('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: () => ({ remove: () => undefined }),
  },
}));

const { ExpoVideoAdapter } = await import('./ExpoVideoAdapter');

function source(overrides: Partial<PlaybackSource> = {}): PlaybackSource {
  return {
    mediaId: 'macha:one',
    url: 'https://node-a.test/generation/index.m3u8',
    isManifest: true,
    mode: 'remux',
    ...overrides,
  } as PlaybackSource;
}

/**
 * A node that serves: a playlist, then bytes for anything else. `play()`
 * walks the manifest first, and only the transport is stubbed.
 */
function servable(): typeof fetch {
  const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
  return (async (url: string) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => playlist,
    // Core's preflight reads through `blob()` when the body cannot be streamed.
    blob: async () => ({ size: url.endsWith('.m3u8') ? playlist.length : 4096 }),
    arrayBuffer: async () => new ArrayBuffer(url.endsWith('.m3u8') ? playlist.length : 4096),
    body: null,
  })) as unknown as typeof fetch;
}

/** A node holding every fragment it was asked for: the `500 segment_not_ready` case. */
function holding(): typeof fetch {
  const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
  return (async (url: string) => (url.endsWith('.m3u8')
    ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
    : { ok: false, status: 500, headers: { get: () => null } })) as unknown as typeof fetch;
}

/** Lets the classification probe settle: the report is a microtask or two behind the event. */
const settled = () => new Promise<void>((resolve) => { setTimeout(resolve, 0); });

beforeEach(() => {
  fake = new FakeVideoPlayer();
  created = [];
  vi.stubGlobal('fetch', servable());
});

afterEach(() => vi.unstubAllGlobals());

describe('the source stated to the player', () => {
  it('declares HLS for a manifest rather than letting the player sniff it', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    expect(fake.replaced.at(-1)).toMatchObject({
      uri: 'https://node-a.test/generation/index.m3u8',
      contentType: 'hls',
    });
  });

  it('declares a byte source as progressive', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source({ url: 'https://node-a.test/file.mkv', isManifest: false, mode: 'direct' }));
    expect(fake.replaced.at(-1)).toMatchObject({ contentType: 'progressive' });
  });

  it('forwards the headers core supplied, verbatim and unaugmented', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source({ headers: { Authorization: 'Bearer token' } }));
    expect((fake.replaced.at(-1) as { headers: Record<string, string> }).headers)
      .toEqual({ Authorization: 'Bearer token' });
  });

  it('omits headers entirely when core supplied none', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    expect(fake.replaced.at(-1)).not.toHaveProperty('headers');
  });
});

describe('attach binds presentation without starting playback', () => {
  it('creates no playback session', () => {
    // A player that loads on attach would hold a transcode slot unasked.
    const adapter = new ExpoVideoAdapter();
    adapter.attach({});
    expect(fake.calls).not.toContain('replace');
    expect(fake.calls).not.toContain('play');
  });
});

describe('play dispatch', () => {
  it('starts paused when asked, without dispatching play', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source(), 0, true);
    expect(fake.calls).toContain('pause');
    expect(fake.calls).not.toContain('play');
  });

  it('resumes at a source-generation-local position', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source(), 90_000);
    expect(fake.currentTime).toBe(90);
  });

  it('resolves once dispatched rather than when buffering completes', async () => {
    const adapter = new ExpoVideoAdapter();
    fake.status = 'loading';
    await expect(adapter.play(source())).resolves.toBe(true);
  });
});

describe('what the adapter reports to core', () => {
  it('converts seconds to milliseconds on the event it emits', async () => {
    const adapter = new ExpoVideoAdapter();
    const events: { positionMs: number; durationMs: number }[] = [];
    adapter.subscribe((event) => events.push(event));
    await adapter.play(source());

    fake.currentTime = 12.5;
    fake.duration = 100;
    fake.bufferedPosition = 30;
    fake.playing = true;
    fake.emit('timeUpdate');

    expect(events.at(-1)).toMatchObject({ positionMs: 12_500, durationMs: 100_000 });
  });

  it('reports nothing while it holds no source, so an idle tick cannot move a resume point', async () => {
    // `expo-video` ticks position 0 with no source, and core lets a player
    // event overwrite its start position until the session is presented.
    const adapter = new ExpoVideoAdapter();
    const events: { positionMs: number }[] = [];
    adapter.subscribe((event) => events.push(event));

    fake.emit('timeUpdate');
    fake.emit('statusChange', { status: 'idle' });
    fake.emit('playingChange');
    expect(events).toEqual([]);

    await adapter.play(source(), 1_800_000);
    fake.currentTime = 1_800;
    fake.emit('timeUpdate');
    expect(events.at(-1)).toMatchObject({ positionMs: 1_800_000 });

    adapter.stop();
    const afterStop = events.length;
    fake.currentTime = 0;
    fake.emit('timeUpdate');
    expect(events).toHaveLength(afterStop);
  });

  it('reports the forward buffer, which is what tells slow apart from dead', async () => {
    const adapter = new ExpoVideoAdapter();
    const events: { forwardBufferMs?: number }[] = [];
    adapter.subscribe((event) => events.push(event));
    await adapter.play(source());

    fake.currentTime = 10;
    fake.bufferedPosition = 25;
    fake.playing = true;
    fake.emit('timeUpdate');

    expect(events.at(-1)?.forwardBufferMs).toBe(15_000);
  });

  it('surfaces a terminal player error on the failure channel', async () => {
    const adapter = new ExpoVideoAdapter();
    const failures: Error[] = [];
    adapter.subscribeFailure((error) => failures.push(error));
    await adapter.play(source());

    fake.emit('statusChange', { status: 'error', error: { message: 'decoder gave up' } });
    await settled();

    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe('decoder gave up');
  });

  it('claims no HTTP evidence it does not have', async () => {
    // expo-video reports no status; the node is asked and is serving, so
    // nothing was learned.
    const adapter = new ExpoVideoAdapter();
    const failures: { kind?: string }[] = [];
    adapter.subscribeFailure((error) => failures.push(error as unknown as { kind?: string }));
    await adapter.play(source());

    fake.emit('statusChange', { status: 'error', error: { message: 'failed' } });
    await settled();

    expect(failures[0]?.kind).toBe('unknown');
  });

  it('unsubscribes, so listeners do not leak across generations', async () => {
    const adapter = new ExpoVideoAdapter();
    const events: unknown[] = [];
    const unsubscribe = adapter.subscribe((event) => events.push(event));
    await adapter.play(source());
    fake.emit('timeUpdate');
    const seen = events.length;

    unsubscribe();
    fake.emit('timeUpdate');

    expect(events.length).toBe(seen);
  });
});

describe('teardown', () => {
  it('releases the source on stop so the node can reclaim its slot', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    adapter.stop();
    expect(fake.replaced.at(-1)).toBeNull();
  });

  it('releases the player exactly once', () => {
    const adapter = new ExpoVideoAdapter();
    adapter.detach();
    adapter.detach();
    expect(fake.released).toBe(true);
  });
});

describe('the warm standby', () => {
  const alternate = () => source({ url: 'https://node-b.test/generation/index.m3u8' });

  async function withStandby(): Promise<InstanceType<typeof ExpoVideoAdapter>> {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    vi.stubGlobal('fetch', servable());
    await adapter.preflightSource(alternate());
    return adapter;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('primes a second player once the walk says the node is serving', async () => {
    await withStandby();
    expect(created).toHaveLength(2);
    expect(created[1]?.initialSource).toMatchObject({
      uri: 'https://node-b.test/generation/index.m3u8',
      contentType: 'hls',
    });
  });

  it('primes nothing when the node will not serve', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    vi.stubGlobal('fetch', (async () => ({ ok: false })) as unknown as typeof fetch);
    await adapter.preflightSource(alternate());
    expect(created).toHaveLength(1);
  });

  it('keeps the standby silent, so it is not heard behind the active source', async () => {
    await withStandby();
    expect(created[1]?.volume).toBe(0);
  });

  it('never starts the standby, which would make it compete for audio focus', async () => {
    await withStandby();
    expect(created[1]?.calls).not.toContain('play');
  });

  it('promotes by handing over rather than reloading the source', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    expect(created[1]?.replaced).toHaveLength(0);
    expect(created[1]?.calls).toContain('play');
  });

  it('brings the promoted player up at the volume core last asked for', async () => {
    const adapter = await withStandby();
    adapter.setVolume(0.25);
    await adapter.play(alternate(), 0, false, 'continue');
    expect(created[1]?.volume).toBe(0.25);
  });

  it('does not release the replaced player while presentation still holds it', async () => {
    // The mounted `VideoView` is still rendering it until the swap commits.
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    expect(fake.released).toBe(false);
  });

  it('releases it once presentation says it has rendered the promoted one', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    adapter.releaseRetiredPlayer();
    expect(fake.released).toBe(true);
  });

  it('releases a retired player on stop even if presentation never acknowledged', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    adapter.stop();
    expect(fake.released).toBe(true);
  });

  it('releases a retired player on teardown even if presentation never acknowledged', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    adapter.detach();
    expect(fake.released).toBe(true);
  });

  it('is safe to acknowledge when nothing was retired', async () => {
    const adapter = new ExpoVideoAdapter();
    expect(() => adapter.releaseRetiredPlayer()).not.toThrow();
  });

  it('carries the adapter event stream onto the promoted player', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    const events: { positionMs: number }[] = [];
    adapter.subscribe((event) => events.push(event));
    created[1]!.currentTime = 42;
    created[1]!.emit('timeUpdate');
    expect(events.at(-1)?.positionMs).toBe(42_000);
  });

  it('stops listening to the player it released', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 0, false, 'continue');
    const events: unknown[] = [];
    adapter.subscribe((event) => events.push(event));
    fake.emit('timeUpdate');
    expect(events).toHaveLength(0);
  });

  it('resumes at the position core asked for', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 90_000, false, 'continue');
    expect(created[1]?.currentTime).toBe(90);
  });

  it('discards a standby core has stopped asking for', async () => {
    const adapter = await withStandby();
    await adapter.play(source({ url: 'https://node-c.test/generation/index.m3u8' }));
    expect(created[1]?.released).toBe(true);
    // The cold path ran on the active player.
    expect(fake.replaced.at(-1)).toMatchObject({ uri: 'https://node-c.test/generation/index.m3u8' });
  });

  it('releases the standby on stop, which is holding the node\'s only transcode slot', async () => {
    const adapter = await withStandby();
    adapter.stop();
    expect(created[1]?.released).toBe(true);
    // A stop empties the active player; it does not destroy it.
    expect(fake.released).toBe(false);
  });

  it('releases the standby on teardown', async () => {
    const adapter = await withStandby();
    adapter.detach();
    expect(created[1]?.released).toBe(true);
  });

  it('promotes only when core says the viewer did not ask for this', async () => {
    // A seek arrives as the same `play(source, positionMs)` as a recovery;
    // only `transition` tells them apart.
    const adapter = await withStandby();
    await adapter.play(alternate(), 90_000, false, 'relocate');

    expect(created[1]?.calls).not.toContain('play');
    expect(fake.replaced.at(-1)).toMatchObject({
      uri: 'https://node-b.test/generation/index.m3u8',
    });
  });

  it('treats an absent transition as a relocate, which is core\'s default', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate());

    expect(created[1]?.calls).not.toContain('play');
    expect(fake.replaced.at(-1)).toMatchObject({
      uri: 'https://node-b.test/generation/index.m3u8',
    });
  });

  it('does not re-prime the same source twice', async () => {
    const adapter = await withStandby();
    await adapter.preflightSource(alternate());
    expect(created).toHaveLength(2);
  });
});

// The web client parks the load instead of judging it (`macha-client`
// `WebHlsPolicy`, `park-paused`); this platform cannot reach its loader.
describe('a terminal error raised while nobody is watching', () => {
  it('is not reported to core while the viewer is paused', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    const failures: Error[] = [];
    adapter.subscribeFailure((error) => failures.push(error));

    adapter.pause();
    fake.status = 'error';
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures).toHaveLength(0);
  });

  it('is met again on resume, with the viewer present', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    fake.currentTime = 612;
    adapter.pause();
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    const replacedWhileParked = fake.replaced.length;

    adapter.resume();

    // The same source is asked for again, at the position the viewer left.
    expect(fake.replaced).toHaveLength(replacedWhileParked + 1);
    expect(fake.replaced.at(-1)).toMatchObject({ uri: source().url });
    expect(fake.currentTime).toBe(612);
    expect(fake.calls).toContain('play');
  });

  it('reports it when the same error arrives with a viewer waiting', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    const failures: Error[] = [];
    adapter.subscribeFailure((error) => failures.push(error));

    adapter.pause();
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    adapter.resume();
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe('Source error');
  });

  it('judges an error while playback is starting, not only while it runs', async () => {
    const adapter = new ExpoVideoAdapter();
    const failures: Error[] = [];
    adapter.subscribeFailure((error) => failures.push(error));

    await adapter.play(source());
    expect(fake.playing).toBe(true);
    fake.playing = false;
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures).toHaveLength(1);
  });

  it('parks one core activated paused, the same as a pause', async () => {
    // The web client draws the same line: `wantsPlayback = !startPaused`.
    const adapter = new ExpoVideoAdapter();
    const failures: Error[] = [];
    adapter.subscribeFailure((error) => failures.push(error));

    await adapter.play(source(), 0, true);
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures).toHaveLength(0);
    adapter.resume();
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();
    expect(failures).toHaveLength(1);
  });

  it('drops a parked error when core moves to another source', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    adapter.pause();
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });

    await adapter.play(source({ url: 'https://node-b.test/generation/index.m3u8' }));
    const replacedAfterPlay = fake.replaced.length;
    adapter.resume();

    // The parked source's generation no longer exists.
    expect(fake.replaced).toHaveLength(replacedAfterPlay);
  });
});

// The player's errors carry no status, so the readiness walk asks the node
// and its answer is latched for the attached source.
describe('classifying a terminal error the player could not', () => {
  /** A node serving a playlist whose fragments answer `status`. */
  function fragmentStatus(status: number): typeof fetch {
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    return (async (url: string) => (url.endsWith('.m3u8')
      ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
      : { ok: false, status, headers: { get: () => null } })) as unknown as typeof fetch;
  }

  it('reads a reaped session off the node rather than condemning it', async () => {
    // The viewer pauses past `session_idle` and the node reaps the session.
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    vi.stubGlobal('fetch', fragmentStatus(404));
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures[0]?.kind).toBe('not-found');
  });

  it('still calls a broken generation evidence against the node', async () => {
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    vi.stubGlobal('fetch', fragmentStatus(503));
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures[0]?.kind).toBe('stream');
  });

  it('asks the node once per generation, not once per error', async () => {
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    const fetchImpl = vi.fn(fragmentStatus(404));
    vi.stubGlobal('fetch', fetchImpl);
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();
    const asked = fetchImpl.mock.calls.length;

    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(fetchImpl.mock.calls).toHaveLength(asked);
    expect(failures.map((failure) => failure.kind)).toEqual(['not-found', 'not-found']);
  });

  it('leaves a held fragment unclassified rather than reading it as a fault', async () => {
    // A hold is no evidence against the node (see `reportTerminalPlayerFailure`).
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    vi.stubGlobal('fetch', holding());
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures[0]?.kind).toBe('unknown');
  });

  it('asks nothing of a progressive source, which has no playlist to walk', async () => {
    // Asking would range-request the film itself.
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source({ url: 'https://node-a.test/file.mkv', isManifest: false, mode: 'direct' }));

    const fetchImpl = vi.fn(fragmentStatus(404));
    vi.stubGlobal('fetch', fetchImpl);
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(failures[0]?.kind).toBe('unknown');
  });

  it('stops asking once the answer would cost more than it is worth', async () => {
    // A node that has stopped answering gets one transport allowance, not the
    // walk's full deadline.
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: PlaybackSourceError[] = [];
      adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
      await adapter.play(source());

      // Accepts the request and never answers it.
      vi.stubGlobal('fetch', ((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch);

      fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
      await vi.advanceTimersByTimeAsync(ENDPOINT_TRANSPORT_ALLOWANCE_MS + 100);

      expect(failures).toHaveLength(1);
      expect(failures[0]?.kind).toBe('unknown');
    } finally {
      vi.useRealTimers();
    }
  });

  it('spends the cover it has, when the element is holding some', async () => {
    // The budget is the runway left above the replacement lead time.
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: PlaybackSourceError[] = [];
      adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
      await adapter.play(source());

      // Ninety seconds of buffer.
      fake.currentTime = 10;
      fake.bufferedPosition = 100;
      fake.playing = true;
      fake.emit('timeUpdate');

      vi.stubGlobal('fetch', ((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch);

      fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
      await vi.advanceTimersByTimeAsync(ENDPOINT_TRANSPORT_ALLOWANCE_MS + 100);

      // Still asking.
      expect(failures).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(90_000);
      expect(failures).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not spend cover that has drained since the element last spoke', async () => {
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: PlaybackSourceError[] = [];
      adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
      await adapter.play(source());

      // Ninety seconds of cover, then ninety seconds of silence.
      fake.currentTime = 10;
      fake.bufferedPosition = 100;
      fake.playing = true;
      fake.emit('timeUpdate');
      await vi.advanceTimersByTimeAsync(90_000);

      vi.stubGlobal('fetch', ((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch);

      fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
      await vi.advanceTimersByTimeAsync(ENDPOINT_TRANSPORT_ALLOWANCE_MS + 100);

      expect(failures).toHaveLength(1);
      expect(failures[0]?.kind).toBe('unknown');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not carry a verdict into the generation that replaces it', async () => {
    // The latch does not rest on the URL: its shape is the server's to change.
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    vi.stubGlobal('fetch', fragmentStatus(404));
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();
    expect(failures[0]?.kind).toBe('not-found');

    // Same URL, different generation.
    vi.stubGlobal('fetch', servable());
    await adapter.play(source());
    const fetchImpl = vi.fn(servable());
    vi.stubGlobal('fetch', fetchImpl);
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(fetchImpl).toHaveBeenCalled();
    expect(failures[1]?.kind).toBe('unknown');
  });

  it('drops an answer that arrived after core moved on', async () => {
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    vi.stubGlobal('fetch', fragmentStatus(404));
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    vi.stubGlobal('fetch', servable());
    await adapter.play(source({ url: 'https://node-b.test/generation/index.m3u8' }));
    await settled();

    expect(failures).toHaveLength(0);
  });
});

describe('the stall budget follows the source', () => {
  it('re-states it to the watchdog at every attach, not once at construction', async () => {
    // The watchdog outlives a generation; the figure belongs to a node.
    const useSourceBudgets = vi.spyOn(MediaStallWatchdog.prototype, 'useSourceBudgets');
    try {
      const adapter = new ExpoVideoAdapter();
      const first = source({ budgets: { deadlineMs: 19_000, segmentHoldMs: 6_000 } });
      const second = source({
        url: 'https://node-b.test/generation/index.m3u8',
        budgets: { deadlineMs: 19_000, segmentHoldMs: 12_000 },
      });

      await adapter.play(first);
      await adapter.play(second);

      expect(useSourceBudgets.mock.calls.map(([given]) => given)).toEqual([first, second]);
    } finally {
      useSourceBudgets.mockRestore();
    }
  });

  it('judges a first fragment against the node\'s own deadline, not a constant', async () => {
    // The start watchdog's budget is a constructor argument, so it is made
    // fresh per source; otherwise `MEDIA_START_STARVATION_MS` (20 s) applies.
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: Error[] = [];
      adapter.subscribeFailure((error) => failures.push(error));

      // Much shorter than the compiled-in default.
      const stated = 5_000;
      await adapter.play(source({ budgets: { deadlineMs: stated, segmentHoldMs: 1_000 } }));
      expect(fake.calls).toContain('replace');

      // The player never delivers a byte.
      await vi.advanceTimersByTimeAsync(stated + 500);

      expect(failures).toHaveLength(1);
      expect(failures[0]?.message).toContain('No media delivered');
    } finally {
      vi.useRealTimers();
    }
  });

  it('states it for a promoted standby too', async () => {
    const useSourceBudgets = vi.spyOn(MediaStallWatchdog.prototype, 'useSourceBudgets');
    try {
      const adapter = new ExpoVideoAdapter();
      await adapter.play(source());
      const alternate = source({
        url: 'https://node-b.test/generation/index.m3u8',
        budgets: { deadlineMs: 19_000, segmentHoldMs: 12_000 },
      });
      await adapter.preflightSource(alternate);
      await adapter.play(alternate, 0, false, 'continue');

      expect(useSourceBudgets).toHaveBeenLastCalledWith(alternate);
    } finally {
      useSourceBudgets.mockRestore();
    }
  });
});

describe('waiting for the node to serve the first fragment', () => {
  it('does not hand the player a source until the node serves it', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    expect(fake.calls).toContain('replace');
  });

  it('reports a failure and plays nothing when the node holds past the budget', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', holding());
      const adapter = new ExpoVideoAdapter();
      const failures: Error[] = [];
      adapter.subscribeFailure((error) => failures.push(error));

      const playing = adapter.play(source());
      await vi.advanceTimersByTimeAsync(FIRST_FRAGMENT_TIMEOUT_MS + HOLD_RETRY_CEILING_MS);

      await expect(playing).resolves.toBe(false);
      expect(fake.calls).not.toContain('replace');
      expect(failures).toHaveLength(1);
      expect(failures[0]?.message).toContain('did not serve the first fragment');
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries the same node rather than failing over on a hold', async () => {
    // No other node has that fragment: each produces its own generation.
    vi.useFakeTimers();
    try {
      const asked: string[] = [];
      let fragmentAttempts = 0;
      const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
      vi.stubGlobal('fetch', (async (url: string) => {
        asked.push(url);
        if (url.endsWith('.m3u8')) {
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist };
        }
        fragmentAttempts += 1;
        return fragmentAttempts < 3
          ? { ok: false, status: 500, headers: { get: () => null } }
          : { ok: true, status: 206, headers: { get: () => null }, blob: async () => ({ size: 16 }), arrayBuffer: async () => new ArrayBuffer(16), body: null };
      }) as unknown as typeof fetch);

      const adapter = new ExpoVideoAdapter();
      const failures: Error[] = [];
      adapter.subscribeFailure((error) => failures.push(error));

      const playing = adapter.play(source());
      // Two holds at core's `SERVER_SEGMENT_HOLD_MS` fallback: twelve seconds.
      // Short of the whole budget, or the start watchdog would report this
      // fake for never delivering a byte (`MEDIA_START_STARVATION_MS`).
      await vi.advanceTimersByTimeAsync(HOLD_RETRY_CEILING_MS * 2);

      await expect(playing).resolves.toBe(true);
      for (const url of asked) expect(url).toContain('node-a.test');
      expect(failures).toHaveLength(0);
      expect(fake.calls).toContain('replace');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a 404 as one session\'s absence, never as the node failing', async () => {
    // `not-found` has core ask the same node whether the session is still there.
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    vi.stubGlobal('fetch', (async (url: string) => (url.endsWith('.m3u8')
      ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
      : { ok: false, status: 404, headers: { get: () => null } })) as unknown as typeof fetch);

    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));

    await expect(adapter.play(source())).resolves.toBe(false);
    expect(failures[0]?.kind).toBe('not-found');
  });

  it('does not tear the presentation down on a not-found', async () => {
    // The element's buffer is the cover core builds a replacement behind.
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    const callsWhilePlaying = [...fake.calls];

    vi.stubGlobal('fetch', (async (url: string) => (url.endsWith('.m3u8')
      ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
      : { ok: false, status: 404, headers: { get: () => null } })) as unknown as typeof fetch);
    await adapter.play(source({ url: 'https://node-b.test/generation/index.m3u8' }));

    expect(fake.calls).toEqual(callsWhilePlaying);
    expect(fake.released).toBe(false);
  });

  it('reports a broken generation as evidence against the node', async () => {
    // A 503 is this node's generation broken: endpoint evidence.
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    vi.stubGlobal('fetch', (async (url: string) => (url.endsWith('.m3u8')
      ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
      : { ok: false, status: 503, headers: { get: () => null } })) as unknown as typeof fetch);

    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));

    await expect(adapter.play(source())).resolves.toBe(false);
    expect(failures[0]?.kind).toBe('stream');
  });

  it('waits out the deadline the node itself states, not the local default', async () => {
    // Core carries the serving node's acquisition deadline on the source.
    vi.useFakeTimers();
    try {
      vi.stubGlobal('fetch', holding());
      const adapter = new ExpoVideoAdapter();
      const failures: Error[] = [];
      adapter.subscribeFailure((error) => failures.push(error));

      const stated = 9_000;
      const playing = adapter.play(source({ budgets: { deadlineMs: stated, segmentHoldMs: 6_000 } }));
      await vi.advanceTimersByTimeAsync(stated + HOLD_RETRY_CEILING_MS);

      await expect(playing).resolves.toBe(false);
      expect(failures).toHaveLength(1);
      // Inside the default it would use for a node that stated none.
      expect(stated).toBeLessThan(FIRST_FRAGMENT_TIMEOUT_MS);
    } finally {
      vi.useRealTimers();
    }
  });

  it('walks nothing for a source that is not a manifest', async () => {
    // Asking would range-request the film itself.
    const fetchImpl = vi.fn(servable());
    vi.stubGlobal('fetch', fetchImpl);
    const adapter = new ExpoVideoAdapter();

    await adapter.play(source({ url: 'https://node-a.test/file.mkv', isManifest: false, mode: 'direct' }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fake.calls).toContain('replace');
  });

  it('does not re-walk a standby that was already preflighted', async () => {
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    const alternate = source({ url: 'https://node-b.test/generation/index.m3u8' });
    await adapter.preflightSource(alternate);

    const fetchImpl = vi.fn(servable());
    vi.stubGlobal('fetch', fetchImpl);
    await adapter.play(alternate, 0, false, 'continue');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('abandons a walk core has superseded, without touching the player', async () => {
    // `play()` awaits, so core may ask for something else meanwhile.
    vi.useFakeTimers();
    try {
      const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
      vi.stubGlobal('fetch', (async (url: string) => {
        if (url.endsWith('.m3u8')) {
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist };
        }
        // node-a holds forever; anything else serves.
        return url.includes('node-a.test')
          ? { ok: false, status: 500, headers: { get: () => null } }
          : { ok: true, status: 206, headers: { get: () => null }, blob: async () => ({ size: 16 }), arrayBuffer: async () => new ArrayBuffer(16), body: null };
      }) as unknown as typeof fetch);

      const adapter = new ExpoVideoAdapter();
      const stale = adapter.play(source());
      const fresh = adapter.play(source({ url: 'https://node-c.test/generation/index.m3u8' }));

      await vi.advanceTimersByTimeAsync(FIRST_FRAGMENT_TIMEOUT_MS);

      await expect(stale).resolves.toBe(false);
      await expect(fresh).resolves.toBe(true);
      for (const replaced of fake.replaced) {
        expect(replaced).not.toMatchObject({ uri: 'https://node-a.test/generation/index.m3u8' });
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
