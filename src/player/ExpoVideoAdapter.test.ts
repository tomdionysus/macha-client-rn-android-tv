import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENDPOINT_TRANSPORT_ALLOWANCE_MS, MediaStallWatchdog } from '@machafoundation/core';
import type { PlaybackSource, PlaybackSourceError } from '@machafoundation/core';
import { FIRST_FRAGMENT_TIMEOUT_MS, HOLD_RETRY_CEILING_MS } from './timingBudgets';

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

/**
 * A node that serves: a playlist, then bytes for anything else.
 *
 * Module-scoped because `play()` now walks the manifest before handing the
 * source to the player, so *every* test that plays a manifest needs a node
 * that answers — not only the standby tests that stub it explicitly. The walk
 * is left real and only the transport is stubbed, so these tests still cover
 * the integration rather than mocking out the thing that was just added.
 */
function servable(): typeof fetch {
  const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
  return (async (url: string) => ({
    ok: true,
    status: 200,
    headers: { get: () => null },
    text: async () => playlist,
    // Core's preflight reads bytes through `blob()` when the body cannot be
    // streamed, which is the normal path on React Native.
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

/**
 * Let the classification probe settle.
 *
 * A terminal error from the player carries no status, so the adapter asks the
 * node what it says before reporting a kind — one walk, then the report. The
 * report is therefore a microtask or two behind the event.
 */
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
    await settled();

    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toBe('decoder gave up');
  });

  it('claims no HTTP evidence it does not have', async () => {
    // expo-video reports no status code, so the kind cannot come from the error
    // itself. The node is asked, and here it is serving — so nothing was
    // learned about it and `unknown` is the honest answer. Guessing `stream`
    // would send the coordinator failing over on no evidence.
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
    // The decisive assertion: the primed player was never told to `replace`,
    // because the whole point is that it has already buffered.
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
    // The swap notifies through a React state update, which commits after the
    // current task. Releasing here would destroy a player the mounted
    // `VideoView` is still rendering.
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

  it('promotes only when core says the viewer did not ask for this', async () => {
    // A seek arrives as `play(source, positionMs)` exactly as a recovery does —
    // byte-identical, measured — and `transition` is the only thing that tells
    // them apart. Hiding a seek behind a pre-buffered player holds the viewer
    // where they were while the clock says they arrived.
    const adapter = await withStandby();
    await adapter.play(alternate(), 90_000, false, 'relocate');

    // The standby was not cut to: the active player was given the source.
    expect(created[1]?.calls).not.toContain('play');
    expect(fake.replaced.at(-1)).toMatchObject({
      uri: 'https://node-b.test/generation/index.m3u8',
    });
  });

  it('treats an absent transition as a relocate, which is core\'s default', async () => {
    // A host that ignores the argument must still be correct, and the
    // behaviour every player had before seamless replacement existed is to
    // attach and let it show.
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

/**
 * The hold-aware readiness walk.
 *
 * This is the behaviour lost when playback moved from the native engine to
 * `expo-video`: `PlayerEngine.kt:450` retried a `500` on the same node, and
 * `expo-video` has no such rule and no injection point to give it one. These
 * assert the replacement, because the failure it prevents — a spurious
 * failover that looks exactly like a node fault — is the one most likely to
 * be misread during the 5.1 downmix measurement.
 */
/**
 * The stall budget belongs to the node, and the node now states it.
 *
 * Until core 0.14.0 the relationship "longer than the longest legitimate wait
 * this node can impose" could only be written against a compiled-in guess at
 * what that wait was. A node configured with a longer hold was called dead for
 * using it.
 */
/**
 * A judgement about whether a node is failing the viewer may only be made while
 * there is a viewer to fail.
 *
 * The web client measured a pause ending on a failure screen two minutes in,
 * naming a node the viewer had never asked for, and answered it by parking the
 * load rather than judging it (`WebHlsPolicy`, `park-paused`). These assert the
 * same behaviour here, on a platform that cannot reach its loader to park it.
 */
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

    // Nothing torn down, nothing failed over, and the session the viewer was on
    // is still the session they will come back to.
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

    // The node is asked for the same source again, at the position the viewer
    // left it — the nearest thing available to the web client's `startLoad`.
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
    // The web client's reason for keying on intent rather than on the element:
    // between a play request and the element actually running, nothing is
    // playing while the viewer is very much waiting — and that window is
    // exactly when a node refusing the stream must be judged.
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
    // `startPaused` is core saying the viewer is not waiting on this yet, which
    // is the same fact a pause states. The web client draws the line in the
    // same place — `wantsPlayback = !startPaused` — and the alternative reads
    // worse on a television: a generation activated paused behind a viewer who
    // stepped away would be judged with nobody there to be failed.
    const adapter = new ExpoVideoAdapter();
    const failures: Error[] = [];
    adapter.subscribeFailure((error) => failures.push(error));

    await adapter.play(source(), 0, true);
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();

    expect(failures).toHaveLength(0);
    // And it is judged the moment anyone waits on it.
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

    // The parked source belonged to a generation that no longer exists;
    // re-asking for it here would replace what the viewer is now on.
    expect(fake.replaced).toHaveLength(replacedAfterPlay);
  });
});

/**
 * The player's own errors carry no status, so the node is asked what it says.
 *
 * The web client solved this on its Direct Play path — where a 404 body handed
 * to the element raises a generic decode error — by latching what the layer
 * that *does* see statuses learned, rather than by parsing the message. These
 * assert the same shape, with the readiness walk as that layer.
 */
describe('classifying a terminal error the player could not', () => {
  /** A node serving a playlist whose fragments answer `status`. */
  function fragmentStatus(status: number): typeof fetch {
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    return (async (url: string) => (url.endsWith('.m3u8')
      ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
      : { ok: false, status, headers: { get: () => null } })) as unknown as typeof fetch;
  }

  it('reads a reaped session off the node rather than condemning it', async () => {
    // The case this exists for, and the likeliest failure on a television: the
    // viewer pauses past `session_idle`, the node reaps the session correctly,
    // and the player reports a message with nothing in it. Reported `unknown`
    // it is endpoint evidence and the honest node is charged for it.
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
    // The latch. A second terminal error on the same source is not a second
    // question, and re-probing spends a round trip to re-learn an answer held.
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
    // A node still producing is the node working. In this direction the errors
    // are not symmetrical: `unknown` costs a spinner, a wrong `stream` costs a
    // healthy node its place in the candidate list.
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
    // The web client's Direct Play case. There is no read-ahead worker here to
    // latch a status, so nothing was learned — and asking would range-request
    // the film itself.
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
    // Lateness is not free: core defers building a replacement only while the
    // runway exceeds the replacement lead time, and a verdict that arrives
    // after another recovery has taken the source is absorbed entirely. So the
    // walk is bounded, and a node that has stopped answering gets one transport
    // allowance rather than the walk's full deadline.
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: PlaybackSourceError[] = [];
      adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
      await adapter.play(source());

      // A node that accepts the request and never answers it.
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
    // With a long runway the deferral is what is being protected, so there is
    // room to ask properly — the budget is what is left above the lead time.
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: PlaybackSourceError[] = [];
      adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
      await adapter.play(source());

      // Ninety seconds of buffer reported before the failure.
      fake.currentTime = 10;
      fake.bufferedPosition = 100;
      fake.playing = true;
      fake.emit('timeUpdate');

      vi.stubGlobal('fetch', ((_url: string, init?: { signal?: AbortSignal }) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })) as unknown as typeof fetch);

      fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
      await vi.advanceTimersByTimeAsync(ENDPOINT_TRANSPORT_ALLOWANCE_MS + 100);

      // Still asking: the floor does not apply while there is cover to spend.
      expect(failures).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(90_000);
      expect(failures).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not spend cover that has drained since the element last spoke', async () => {
    // A last known value does not decay and the buffer it describes does. Found
    // by the core session, which has the same exposure at its own deferral
    // decision: a stale sample grants a walk more time than the viewer has.
    vi.useFakeTimers();
    try {
      const adapter = new ExpoVideoAdapter();
      const failures: PlaybackSourceError[] = [];
      adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
      await adapter.play(source());

      // Ninety seconds of cover reported, then ninety seconds of silence.
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

      // The cover is gone, so this is the floor case and not the long one.
      expect(failures).toHaveLength(1);
      expect(failures[0]?.kind).toBe('unknown');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not carry a verdict into the generation that replaces it', async () => {
    // The latch lives for one attached source and no longer. The web session
    // observes that a stream URL carries a per-generation index, which would
    // make the URL alone sufficient — but core states the URL shape is the
    // server's to change, so nothing here rests on it.
    const adapter = new ExpoVideoAdapter();
    const failures: PlaybackSourceError[] = [];
    adapter.subscribeFailure((error) => failures.push(error as PlaybackSourceError));
    await adapter.play(source());

    vi.stubGlobal('fetch', fragmentStatus(404));
    fake.emit('statusChange', { status: 'error', error: { message: 'Source error' } });
    await settled();
    expect(failures[0]?.kind).toBe('not-found');

    // A replacement generation that happens to be served at the same URL is
    // still a different generation, and is asked about on its own terms.
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

    // The answer is about a source nobody is watching any more.
    expect(failures).toHaveLength(0);
  });
});

describe('the stall budget follows the source', () => {
  it('re-states it to the watchdog at every attach, not once at construction', async () => {
    // The watchdog outlives any one generation while the figure belongs to a
    // node, so an adapter that sets it once judges every later node by the
    // first one's number.
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

  it('states it for a promoted standby too', async () => {
    // A promotion is the case where it matters most: the whole point is that
    // the replacement is on a *different* node from the one that just stopped.
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
    // A node holding forever is, eventually, evidence — but it is reported
    // once the budget is spent rather than on the first refusal. Driven on
    // fake timers because the budget is five server holds of real time.
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
    // The whole point. The next node is producing a different generation and
    // does not have that fragment either, so a failover here buys a cold
    // start in place of the tail of a warm one.
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
      // Only as far as the two holds need. Core falls back to one
      // `SERVER_SEGMENT_HOLD_MS` per hold where the node sent no
      // `Retry-After`, so two holds is twelve seconds.
      //
      // Deliberately short of the whole budget: advancing that far would run
      // past `MEDIA_START_STARVATION_MS` *after* the walk had succeeded, and
      // the start watchdog would correctly report a player that was handed a
      // source and never given a byte by this fake.
      await vi.advanceTimersByTimeAsync(HOLD_RETRY_CEILING_MS * 2);

      await expect(playing).resolves.toBe(true);
      // Every request went to the node we were given, never to another.
      for (const url of asked) expect(url).toContain('node-a.test');
      expect(failures).toHaveLength(0);
      expect(fake.calls).toContain('replace');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a 404 as one session\'s absence, never as the node failing', async () => {
    // Core 0.13.0: read as `stream` this is endpoint evidence, and the node
    // that answered honestly is charged a failure and dropped while the viewer
    // is sent to one that never held the session. Reported as `not-found`, core
    // asks that same node whether the session is still there.
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
    // The obligation that arrives with the kind: the element's buffer is the
    // cover core builds a replacement behind, and an adapter that empties it
    // throws away exactly what the recovery was going to spend.
    const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
    const adapter = new ExpoVideoAdapter();
    await adapter.play(source());
    const callsWhilePlaying = [...fake.calls];

    vi.stubGlobal('fetch', (async (url: string) => (url.endsWith('.m3u8')
      ? { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist }
      : { ok: false, status: 404, headers: { get: () => null } })) as unknown as typeof fetch);
    await adapter.play(source({ url: 'https://node-b.test/generation/index.m3u8' }));

    // Nothing was paused, emptied or replaced: whatever is on screen is still on
    // screen and still playing out.
    expect(fake.calls).toEqual(callsWhilePlaying);
    expect(fake.released).toBe(false);
  });

  it('reports a broken generation as evidence against the node', async () => {
    // The other terminal status, and the opposite conclusion: a 503 is this
    // node's generation broken, which is endpoint evidence and should fail over.
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
    // Core 0.14.0 carries the serving node's own acquisition deadline on the
    // source. A host that keeps waiting past it is holding a viewer in front of
    // a node core has already decided is worth leaving.
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
      // And it gave up well inside the figure it would have used for a node
      // that could not say.
      expect(stated).toBeLessThan(FIRST_FRAGMENT_TIMEOUT_MS);
    } finally {
      vi.useRealTimers();
    }
  });

  it('walks nothing for a source that is not a manifest', async () => {
    // A progressive byte source has no playlist to walk, and asking would
    // range-request the film itself.
    const fetchImpl = vi.fn(servable());
    vi.stubGlobal('fetch', fetchImpl);
    const adapter = new ExpoVideoAdapter();

    await adapter.play(source({ url: 'https://node-a.test/file.mkv', isManifest: false, mode: 'direct' }));

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fake.calls).toContain('replace');
  });

  it('does not re-walk a standby that was already preflighted', async () => {
    // A promotion happens because the picture has just frozen. Spending five
    // server holds re-answering a settled question is the worst possible use
    // of that moment.
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
    // `play()` can now await, so core is free to ask for something else while
    // it does. Finishing afterwards would overwrite what the viewer is on.
    vi.useFakeTimers();
    try {
      const playlist = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:6.0,\nseg1.m4s';
      vi.stubGlobal('fetch', (async (url: string) => {
        if (url.endsWith('.m3u8')) {
          return { ok: true, status: 200, headers: { get: () => null }, text: async () => playlist };
        }
        // node-a holds forever; anything else serves immediately.
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
      // The abandoned source must never reach the player, at any point.
      for (const replaced of fake.replaced) {
        expect(replaced).not.toMatchObject({ uri: 'https://node-a.test/generation/index.m3u8' });
      }
    } finally {
      vi.useRealTimers();
    }
  });
});
