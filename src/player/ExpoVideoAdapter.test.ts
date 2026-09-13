import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaybackSource } from '@macha/core';

/**
 * A stand-in for `expo-video`'s `VideoPlayer`.
 *
 * Only the members the adapter touches, and it records the calls whose
 * *arguments* carry a rule — `replace` above all, since that is where the
 * source is stated to the player.
 */
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

  /** What `createVideoPlayer` was handed — a standby is primed at construction. */
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
/** Every player the adapter has constructed, in order. A promotion makes a second. */
let created: FakeVideoPlayer[];

vi.mock('expo-video', () => ({
  createVideoPlayer: (initial?: unknown) => {
    // The first is the adapter's active player, which `fake` names so the
    // tests written before standbys existed keep reading the right one.
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

beforeEach(() => {
  fake = new FakeVideoPlayer();
  created = [];
});

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
    // Handing a player an `.m3u8` undeclared makes it parse the playlist as a
    // media file; the inverse mistake is just as real, so `isManifest` is the
    // only thing that may decide this — never the extension or the mode.
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
    // Core's contract: `attach` is presentation only. A player that loads here
    // holds a transcode slot before anyone asked to watch anything, and with
    // `max_video_transcodes: 1` that costs the next viewer a 429.
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
    // Waiting for buffering here would stall the coordinator's failover timing.
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

  it('reports the forward buffer, which is what tells slow apart from dead', async () => {
    const adapter = new ExpoVideoAdapter();
    // Optional on `PlaybackEvent`: a platform that cannot measure buffering
    // omits it, which is the distinction this test exists to check.
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

    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe('decoder gave up');
  });

  it('claims no HTTP evidence it does not have', async () => {
    // expo-video reports no status code, so the kind cannot come from core's
    // `playbackFailureKindForStatus`. `unknown` is the honest answer; guessing
    // `stream` would send the coordinator failing over on no evidence.
    const adapter = new ExpoVideoAdapter();
    const failures: { kind?: string }[] = [];
    adapter.subscribeFailure((error) => failures.push(error as unknown as { kind?: string }));
    await adapter.play(source());

    fake.emit('statusChange', { status: 'error', error: { message: 'failed' } });

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

  /** A preflight that passes without going near the network. */
  function servable(): typeof fetch {
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    return (async (url: string) => ({
      ok: true,
      text: async () => playlist,
      arrayBuffer: async () => new ArrayBuffer(url.endsWith('.m3u8') ? playlist.length : 4096),
      body: null,
    })) as unknown as typeof fetch;
  }

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
    await adapter.play(alternate());
    // The decisive assertion: the primed player was never told to `replace`,
    // because the whole point is that it has already buffered.
    expect(created[1]?.replaced).toHaveLength(0);
    expect(created[1]?.calls).toContain('play');
  });

  it('brings the promoted player up at the volume core last asked for', async () => {
    const adapter = await withStandby();
    adapter.setVolume(0.25);
    await adapter.play(alternate());
    expect(created[1]?.volume).toBe(0.25);
  });

  it('does not release the replaced player while presentation still holds it', async () => {
    // The swap notifies through a React state update, which commits after the
    // current task. Releasing here would destroy a player the mounted
    // `VideoView` is still rendering.
    const adapter = await withStandby();
    await adapter.play(alternate());
    expect(fake.released).toBe(false);
  });

  it('releases it once presentation says it has rendered the promoted one', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate());
    adapter.releaseRetiredPlayer();
    expect(fake.released).toBe(true);
  });

  it('releases a retired player on stop even if presentation never acknowledged', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate());
    adapter.stop();
    expect(fake.released).toBe(true);
  });

  it('releases a retired player on teardown even if presentation never acknowledged', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate());
    adapter.detach();
    expect(fake.released).toBe(true);
  });

  it('is safe to acknowledge when nothing was retired', async () => {
    const adapter = new ExpoVideoAdapter();
    expect(() => adapter.releaseRetiredPlayer()).not.toThrow();
  });

  it('carries the adapter event stream onto the promoted player', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate());
    const events: { positionMs: number }[] = [];
    adapter.subscribe((event) => events.push(event));
    created[1]!.currentTime = 42;
    created[1]!.emit('timeUpdate');
    expect(events.at(-1)?.positionMs).toBe(42_000);
  });

  it('stops listening to the player it released', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate());
    const events: unknown[] = [];
    adapter.subscribe((event) => events.push(event));
    fake.emit('timeUpdate');
    expect(events).toHaveLength(0);
  });

  it('resumes at the position core asked for', async () => {
    const adapter = await withStandby();
    await adapter.play(alternate(), 90_000);
    expect(created[1]?.currentTime).toBe(90);
  });

  it('discards a standby core has stopped asking for', async () => {
    const adapter = await withStandby();
    await adapter.play(source({ url: 'https://node-c.test/generation/index.m3u8' }));
    expect(created[1]?.released).toBe(true);
    // And the cold path was taken on the active player, not the standby.
    expect(fake.replaced.at(-1)).toMatchObject({ uri: 'https://node-c.test/generation/index.m3u8' });
  });

  it('releases the standby on stop, which is holding the node\'s only transcode slot', async () => {
    const adapter = await withStandby();
    adapter.stop();
    expect(created[1]?.released).toBe(true);
    // And the active player is not destroyed by a stop, only emptied.
    expect(fake.released).toBe(false);
  });

  it('releases the standby on teardown', async () => {
    const adapter = await withStandby();
    adapter.detach();
    expect(created[1]?.released).toBe(true);
  });

  it('does not re-prime the same source twice', async () => {
    const adapter = await withStandby();
    await adapter.preflightSource(alternate());
    expect(created).toHaveLength(2);
  });
});
