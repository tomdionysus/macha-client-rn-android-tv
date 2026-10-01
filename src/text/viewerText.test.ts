import { describe, expect, it } from 'vitest';
import type { PassedOverVersion, PlaybackStartProgress, PlaybackStatusDescription, QualityCeiling, TechnicalSummary, VersionStep } from '@machafoundation/core';
import {
  alphabetKeyLabel,
  fileLine,
  qualityLabel,
  errorText,
  NO_NODE_ANSWERED_TEXT,
  categoryLabel,
  episodeLabel,
  formatPlaybackTime,
  playbackNoticeText,
  serverStatusText,
  catalogueStatusText,
  isSignedOut,
  preparingStreamText,
  qualityChoiceText,
  qualitySteppedDownText,
  tooSlowToPlayText,
  sortChoiceLabel,
  statusNodeName,
  startProgressText,
  streamLines,
  trackFacts,
  trackNumberLabel,
  trackSearchLine,
} from './viewerText';

/**
 * The wording core composed until 2026-09-24, carried over unchanged; each
 * case is what a viewer saw before the cut and must still see after it.
 */
describe('viewer text', () => {
  it('words the sort choices and categories as Tom named them', () => {
    expect(sortChoiceLabel('title')).toBe('Sort By Title');
    expect(sortChoiceLabel('recent')).toBe('Sort By Recently added');
    expect(categoryLabel('shows')).toBe('TV Shows');
  });

  it('names episodes and tracks', () => {
    // Tom, 2026-09-27: "S04E08 in all cases".
    expect(episodeLabel({ seasonNumber: 3, episodeNumber: 2 })).toBe('S03E02');
    expect(episodeLabel({ seasonNumber: 4, episodeNumber: 8 })).toBe('S04E08');
    // No season: the web client's `episodeCode` form.
    expect(episodeLabel({ episodeNumber: 4 })).toBe('Episode 4');
    expect(trackNumberLabel({ trackNumber: 9 })).toBe('Track 9');
    expect(trackNumberLabel({ discNumber: 2, trackNumber: 3 })).toBe('Disc 2 · Track 3');
    expect(trackSearchLine({ album: { id: 'a', title: 'Ænima' }, artist: { id: 'b', title: 'Tool' } })).toBe('Tool - Ænima');
  });

  it('formats the player clock', () => {
    expect(formatPlaybackTime(0)).toBe('0:00');
    expect(formatPlaybackTime(245_000)).toBe('4:05');
    expect(formatPlaybackTime(3_723_000)).toBe('1:02:03');
  });

  it('words every notice code core sends', () => {
    for (const code of ['copy-refused', 'cannot-seek', 'not-ready', 'instruction-failed', 'subtitles-loading', 'update-failed'] as const) {
      expect(playbackNoticeText({ code }), code).not.toBe('');
    }
  });

  it("shows the alphabet strip's catch-all as #", () => {
    expect(alphabetKeyLabel('other')).toBe('#');
    expect(alphabetKeyLabel('A')).toBe('A');
  });
});

describe('catalogueStatusText', () => {
  const status = (ready: boolean, error: string | null, error_code?: string | null) =>
    ({ enabled: true, ready, error, error_code } as never);

  it('says nothing while the catalogue is ready', () => {
    expect(catalogueStatusText(status(true, null, null))).toBeUndefined();
  });

  it('words the server 0.56.0 code, never the sentence beside it', () => {
    expect(catalogueStatusText(status(false, 'metadata store is converging', 'converging'))).toBe(
      'The catalogue is still being brought up to date.',
    );
    expect(catalogueStatusText(status(false, 'catalogue unavailable: io', 'unavailable'))).toBe(
      "The catalogue isn't available on this server right now.",
    );
  });

  it('gives its own sentence for an older node that sends only English', () => {
    expect(catalogueStatusText(status(false, 'something the server said'))).toBe(
      "The catalogue isn't available on this server right now.",
    );
  });
});

/**
 * §1.12, measured on `.133` 2026-09-23: signed out, Settings read "Server
 * online; catalogue unavailable" and PLAYBACK: Unavailable, an authentication
 * state worded as an outage.
 */
describe('isSignedOut', () => {
  it('recognises a 401 or 403 anywhere down the chain', () => {
    expect(isSignedOut(new Error('x', { cause: Object.assign(new Error('401'), { status: 401 }) }))).toBe(true);
    expect(isSignedOut(Object.assign(new Error('403'), { status: 403 }))).toBe(true);
  });

  it('does not call an outage a sign-out', () => {
    expect(isSignedOut(Object.assign(new Error('503'), { status: 503 }))).toBe(false);
    expect(isSignedOut(undefined)).toBe(false);
  });
});

describe('trackFacts', () => {
  const context = { album: { id: 'a', title: 'Homogenic', year: 1997 }, artist: { id: 'b', title: 'Björk' } };

  it('gives the artist, the album with its year, and the place on the album (Tom, 2026-09-24)', () => {
    expect(trackFacts({ trackNumber: 3, discNumber: 1, musicContext: context } as never)).toEqual({
      artist: 'Björk', album: 'Homogenic (1997)', track: 'Track 3',
    });
    expect(trackFacts({ trackNumber: 3, discNumber: 2, musicContext: context } as never).track).toBe('Disc 2 · Track 3');
  });

  it('shows what it has for a track restored from before core 0.19.0 with no music context', () => {
    expect(trackFacts({ trackNumber: 5 } as never)).toEqual({ artist: undefined, album: undefined, track: 'Track 5' });
  });
});

describe('playbackNoticeText', () => {
  it("words core de86392's refusal of a choice this file does not have", () => {
    expect(playbackNoticeText({ code: 'update-failed', refusal: { status: 400, code: 'choice_not_available', choice: 'audio' } } as never)).toBe(
      "That track isn't in this file, so nothing was changed.",
    );
    expect(playbackNoticeText({ code: 'update-failed', refusal: { status: 409, code: 'something_else' } } as never)).toBe(
      'That change could not be applied.',
    );
  });

  it('words a change back into transcode that found the slot taken (server 0.60.0)', () => {
    expect(playbackNoticeText({ code: 'update-failed', refusal: { status: 429, code: 'resource_limit' } } as never)).toBe(
      "This server is converting for another viewer right now, so that change wasn't made.",
    );
  });

  it('words core e840d72 decode fallback beside the copy refusal it mirrors', () => {
    expect(playbackNoticeText({ code: 'decode-fallback', error: new Error('MediaCodecVideoRenderer error') })).toBe(
      'This television could not decode the original streams, so they are being converted.',
    );
  });
});

describe('errorText', () => {
  it('words a failed walk by whether any node answered', async () => {
    const { MachaClusterRouteError, MachaConnectionError } = await import('@machafoundation/core');
    // The web client's sentence, word for word (macha-client 043fd81).
    const timedOut = new MachaConnectionError('Request to http://node/api/v1/manage/unmatched exceeded 8000 ms.');
    expect(errorText(new MachaClusterRouteError(['fi-1', 'gbni-1'], true, timedOut))).toBe(NO_NODE_ANSWERED_TEXT);
    expect(NO_NODE_ANSWERED_TEXT).toBe(
      'No Macha server answered. Try again in a moment; if it keeps happening, check that the servers are running.',
    );
    expect(errorText(new MachaClusterRouteError(['a'], false, new Error('x')))).toMatch(/couldn't answer/);
  });

  it('words a status found anywhere down the chain, never the message', () => {
    const lapsed = new Error('Macha request failed: a valid session bearer token is required', {
      cause: Object.assign(new Error('401'), { status: 401 }),
    });
    expect(errorText(lapsed)).toBe('Your session has ended. Sign in again.');
    expect(errorText(new Error('All configured Macha API endpoints failed.'))).toBe('Something went wrong.');
  });

  it("words core's own no-progress failure, which has no server sentence, before its 504", async () => {
    const { MachaPlaybackError } = await import('@machafoundation/core');
    const stalled = new MachaPlaybackError('Macha playback start made no progress for 17000 ms.', 504, 'start_no_progress');
    expect(errorText(stalled)).toBe('The node stopped making progress starting this stream.');
  });
});

/**
 * What a start or a change is doing (core `00ff3eb`, server 0.69.0), the web
 * client's `startProgressText` (`macha-client/src/text/viewerText.ts`, read
 * 2026-09-28 from its working tree) and its tests' cases.
 */
describe('startProgressText', () => {
  const progress = (over: Partial<PlaybackStartProgress>): PlaybackStartProgress =>
    ({ kind: 'start', stage: 'planning', progressSeq: 1, elapsedMs: 0, ...over });

  it('names the node for a start only while planning', () => {
    expect(startProgressText(progress({ stage: 'planning' }), 'fi-1')).toBe('Preparing the stream on fi-1');
    expect(startProgressText(progress({ stage: 'preroll', prerollDecodedMs: 400, prerollTotalMs: 1_000 }), 'fi-1'))
      .toBe('Finding the start point: 40%');
    expect(startProgressText(progress({ stage: 'encoding', outputMediaMs: 1_200, firstFragmentMs: 2_000 }), 'fi-1'))
      .toBe('Starting the stream: 60%');
  });

  it('names the node throughout a change, with an ellipsis when it stands alone without a figure', () => {
    const change = (over: Partial<PlaybackStartProgress>) => progress({ kind: 'change', ...over });
    expect(startProgressText(change({ stage: 'planning' }), 'fi-1', true)).toBe('Preparing new stream on fi-1…');
    expect(startProgressText(change({ stage: 'preroll', prerollDecodedMs: 250, prerollTotalMs: 1_000 }), 'fi-1', true))
      .toBe('Finding the start point on fi-1: 25%');
    expect(startProgressText(change({ stage: 'encoding', outputMediaMs: 600, firstFragmentMs: 1_000 }), 'fi-1', true))
      .toBe('Starting the new stream on fi-1: 60%');
  });

  it('shows a figure only when the node measured both halves, never 0% and never a guess', () => {
    expect(startProgressText(progress({ stage: 'preroll', prerollDecodedMs: 400 }))).toBe('Finding the start point');
    expect(startProgressText(progress({ stage: 'preroll', prerollDecodedMs: 0, prerollTotalMs: 0 }))).toBe('Finding the start point');
    expect(startProgressText(progress({ stage: 'encoding', outputMediaMs: 3_000, firstFragmentMs: 2_000 }))).toBe('Starting the stream: 100%');
  });

  it("keeps the status line's old sentence for a node that reports nothing", () => {
    expect(preparingStreamText(undefined, 'fi-1')).toBe('Preparing new stream on fi-1…');
    expect(preparingStreamText(undefined)).toBe('Preparing new stream…');
  });

  it('names the serving node through a change', () => {
    expect(preparingStreamText(progress({ kind: 'change', stage: 'encoding', outputMediaMs: 600, firstFragmentMs: 2_000 }), 'fi-1'))
      .toBe('Starting the new stream on fi-1: 30%');
  });

  // A failover arrives as a start, on a node the line cannot name: the
  // endpoint it holds is the one being replaced. The web client's cases.
  it('words a failover as a new stream and names no node', () => {
    expect(preparingStreamText(progress({ kind: 'start', stage: 'planning' }), 'gbni-1')).toBe('Preparing new stream…');
    expect(preparingStreamText(progress({ kind: 'start', stage: 'preroll', prerollDecodedMs: 1, prerollTotalMs: 2 }), 'gbni-1'))
      .toBe('Finding the start point: 50%');
    expect(preparingStreamText(progress({ kind: 'start', stage: 'encoding' }), 'gbni-1')).toBe('Starting the new stream…');
  });

  it('says nothing once the stage is over', () => {
    expect(startProgressText(progress({ stage: 'ready' }))).toBeUndefined();
    expect(startProgressText(progress({ stage: 'failed' }))).toBeUndefined();
  });
});

/**
 * Server 0.56.0 codes, read from `macha` `src/service.cpp`, `src/playback.cpp`
 * at `60ce47a`: the ones that can answer `GET /api/v1/playback/status`.
 */
describe('serverStatusText', () => {
  const status = (httpStatus: number, code: string | null, detail: string | null = null) => ({
    version: null, playback: {}, playbackAvailable: httpStatus < 300, httpStatus, code, detail,
  });

  it('says nothing about a node that is serving, with or without a code', () => {
    expect(serverStatusText(status(200, 'ok'))).toBeUndefined();
    expect(serverStatusText(status(200, null))).toBeUndefined();
  });

  it('words the code, never the server sentence beside it', () => {
    expect(serverStatusText(status(503, 'service_recovering', 'recovering local services'))).toBe(
      'The Macha server is still starting up. Try again shortly.',
    );
    expect(serverStatusText(status(503, 'startup_failed', 'x'))).toBe("The Macha server couldn't start.");
    expect(serverStatusText(status(503, 'streaming_disabled', 'streaming is disabled'))).toBe(
      'Playback is switched off on this Macha server.',
    );
    expect(serverStatusText(status(401, 'unauthorized', 'a valid session bearer token is required'))).toBe(
      'Your session has ended. Sign in again.',
    );
  });

  it('falls back to the HTTP status for a code it does not know, or none', () => {
    expect(serverStatusText(status(503, 'something_new', 'x'))).toBe(
      "The Macha server couldn't answer right now. Try again shortly.",
    );
    expect(serverStatusText(status(418, null))).toBe('Playback is not available on this Macha server.');
  });
});

/**
 * Against lines read off `.133`'s screen on 2026-09-23/24, before core's cut:
 * Bushwhacked, direct; Arrival, video copied and DTS transcoded.
 */
describe('streamLines', () => {
  it('reads a direct play exactly as the set showed it', () => {
    const lines = streamLines({
      container: 'matroska',
      delivery: 'direct',
      video: { transform: 'copy', source: { type: 'video', index: 0, codec: 'hevc', width: 1920, height: 1080 }, sourceBitrate: 5_600_000 },
      audio: { transform: 'copy', source: { type: 'audio', index: 1, codec: 'aac', language: 'eng', channels: 6, sampleRate: 48_000 } },
    } as unknown as PlaybackStatusDescription);
    expect(lines).toEqual({
      container: 'MATROSKA',
      video: 'DIRECT · HEVC · 1920×1080 · 5.6 Mb/s',
      audio: 'DIRECT · ENG · AAC · 5.1 · 48 kHz',
    });
  });

  it('reads a copied video with transcoded audio exactly as the set showed it', () => {
    const lines = streamLines({
      container: 'fmp4',
      video: { transform: 'copy', source: { type: 'video', index: 0, codec: 'h264', width: 1920, height: 804 }, sourceBitrate: 3_600_000 },
      audio: {
        transform: 'transcode',
        source: { type: 'audio', index: 1, codec: 'dts', language: 'eng', channels: 6, sampleRate: 48_000, bitrate: 768_000 },
        output: { sourceStream: 1, transform: 'transcode', codec: 'aac', channels: 6, sampleRate: 48_000, bitrate: 384_000 },
      },
    } as unknown as PlaybackStatusDescription);
    expect(lines).toEqual({
      container: 'FMP4',
      video: 'VIDEO COPY · H264 · 1920×804 · 3.6 Mb/s',
      audio: 'AUDIO TRANSCODE · SOURCE · ENG · DTS · 5.1 · 48 kHz · 768 kb/s → AAC · 5.1 · 48 kHz · 384 kb/s',
    });
  });
});

describe('versions, as the web client words them', () => {
  it('names 2160 4K and 1440 2K, and every other class by its height', () => {
    expect(qualityLabel(2160)).toBe('4K');
    expect(qualityLabel(1440)).toBe('2K');
    expect(qualityLabel(1080)).toBe('1080p');
  });

});

describe("a file's line", () => {
  it("joins core's parts in core's order with the clients' separator", () => {
    const summary = { kind: 'video', parts: ['2h 31m', '3840×2160 (4K)', 'HEVC', 'TRUEHD', '7.1', '47.4 Mbps'] } as unknown as TechnicalSummary;
    expect(fileLine(summary)).toBe('2h 31m · 3840×2160 (4K) · HEVC · TRUEHD · 7.1 · 47.4 Mbps');
  });
});

/**
 * Why Play chooses the file it does, as one sentence from every fact: the web
 * client's `qualityChoiceText` and its tests' cases
 * (`macha-client/src/text/viewerText.test.ts`, f512cdc), unchanged. Tom: every
 * client shows the same sentence.
 */
describe('why Play chooses the file it does, as one sentence from every fact', () => {
  const instruction = (video: 'copy' | 'transcode', audio: 'copy' | 'transcode') =>
    ({ mode: video === 'transcode' || audio === 'transcode' ? 'transcode' : 'direct', video, audio, reasons: [], assumed: [] }) as VersionStep['instruction'];
  const file = (quality: VersionStep['quality'], video: 'copy' | 'transcode' = 'copy', audio: 'copy' | 'transcode' = 'copy') =>
    ({ quality, instruction: instruction(video, audio), index: 0 });
  // The Martian: a 4K file (HEVC, TrueHD), a 1080p file (HEVC, E-AC-3) and a 720p file (H.264, AAC).
  const files = [file(2160, 'copy', 'transcode'), file(1080, 'copy', 'transcode'), file(720)];
  const automatic = (quality: VersionStep['quality'], video: 'copy' | 'transcode' = 'copy', audio: 'copy' | 'transcode' = 'copy') =>
    ({ quality, source: 'file', mediaId: 'm', instruction: instruction(video, audio) }) as VersionStep;
  const passedOver = (quality: VersionStep['quality'], video: boolean, audio: boolean): PassedOverVersion =>
    ({ quality, converts: { video, audio }, reasons: [] });

  it('builds one sentence when a ceiling and a conversion both kept Play off a larger file', () => {
    expect(qualityChoiceText({ files, automatic: automatic(720), limitedBy: { quality: 1080, reason: 'ceiling-display' }, passedOver: passedOver(1080, false, true) }))
      .toBe('Play chooses 720p, which plays without converting. 1080p needs its audio converted, and 4K is more than this screen shows. Pick a quality to play another.');
  });

  it('names only the conversion, where no ceiling applies (this television)', () => {
    expect(qualityChoiceText({ files, automatic: automatic(1080), passedOver: passedOver(2160, false, true) }))
      .toBe('Play chooses 1080p, which plays without converting. 4K needs its audio converted. Pick a quality to play another.');
    expect(qualityChoiceText({ files, automatic: automatic(1080), passedOver: passedOver(2160, true, true) }))
      .toBe('Play chooses 1080p, which plays without converting. 4K needs its video and audio converted. Pick a quality to play another.');
  });

  it('names only the ceiling, with its reason, and the largest file it kept out', () => {
    const only = (reason: QualityCeiling['reason']) => qualityChoiceText({ files, automatic: automatic(1080), limitedBy: { quality: 1080, reason } });
    expect(only('ceiling-display')).toBe('Play chooses 1080p. 4K is more than this screen shows. Pick a quality to play another.');
    expect(only('ceiling-device')).toBe('Play chooses 1080p. 4K is more than this device plays. Pick a quality to play another.');
    expect(only('ceiling-cellular')).toBe('Play chooses 1080p. 4K is more than Play uses on mobile data. Pick a quality to play another.');
    expect(only('ceiling-preference')).toBe('Play chooses 1080p. 4K is more than the most set in Settings. Pick a quality to play another.');
  });

  // Server 0.70.0, core fb96757: a node's measured rate says the conversion
  // is too slow to watch, not only needed. The web client's case.
  it('says when the conversion is too slow to watch, not only needed', () => {
    const slow: PassedOverVersion = { quality: 2160, converts: { video: true, audio: true }, reasons: ['transcode-below-real-time'] };
    expect(qualityChoiceText({ files, automatic: automatic(1080), passedOver: slow }))
      .toBe("Play chooses 1080p, which plays without converting. 4K needs its video and audio converted, which the server can't do fast enough. Pick a quality to play another.");
  });

  it('never claims the chosen file plays as it is when it does not', () => {
    expect(qualityChoiceText({ files, automatic: automatic(1080, 'copy', 'transcode'), passedOver: passedOver(2160, true, true) }))
      .toBe('Play chooses 1080p. 4K needs its video and audio converted. Pick a quality to play another.');
  });

  it('says nothing when Play chooses the largest file there is', () => {
    expect(qualityChoiceText({ files, automatic: automatic(2160) })).toBeUndefined();
  });
});

/**
 * The end of the failover loop (core d1069d2): the web client's
 * `tooSlowToPlayText` and `qualitySteppedDownText` and its tests' cases
 * (`macha-client/src/text/viewerText.test.ts`, working tree 2026-09-28).
 */
describe('a quality no node can convert fast enough', () => {
  it("says which quality and which streams, from what was playing (Tom: 'Macha can't play this quality because...')", () => {
    expect(tooSlowToPlayText(2160, { video: 'transcode', audio: 'transcode' }))
      .toBe("Macha can't play 4K because the server can't convert its video and audio fast enough to keep up.");
    expect(tooSlowToPlayText(1440, { video: 'transcode', audio: 'copy' }))
      .toBe("Macha can't play 2K because the server can't convert its video fast enough to keep up.");
    // An omitted stream (no audio at all) is not one being converted.
    expect(tooSlowToPlayText(2160, { video: 'transcode', audio: 'omit' }))
      .toBe("Macha can't play 4K because the server can't convert its video fast enough to keep up.");
  });

  it('keeps the sentence whole when a fact is missing, and is what errorText falls back to', async () => {
    const { MachaPlaybackError, TOO_SLOW_TO_PLAY_CODE } = await import('@machafoundation/core');
    expect(tooSlowToPlayText()).toBe("Macha can't play this quality because the server can't convert it fast enough to keep up.");
    expect(errorText(new MachaPlaybackError('too slow', 504, TOO_SLOW_TO_PLAY_CODE))).toBe(tooSlowToPlayText());
  });

  it('says where core stepped its own choice down, naming the quality it chose', () => {
    expect(qualitySteppedDownText(1080)).toBe("Switched to 1080p: the server can't convert a higher quality fast enough.");
    expect(playbackNoticeText({ code: 'quality-stepped-down' }, 1080))
      .toBe("Switched to 1080p: the server can't convert a higher quality fast enough.");
    expect(qualitySteppedDownText()).toBe("Switched to a lower quality: the server can't convert a higher quality fast enough.");
  });
});

/** Server 0.70.0: the operator's name for a node (Tom: "show the names the server sends"). */
describe('statusNodeName', () => {
  it("shows the operator's name, and the address where there is none", () => {
    const node = (over: Record<string, unknown>) => ({ id: 'abcdef0123456789', host: '10.35.1.50', port: 7438, ...over }) as never;
    expect(statusNodeName(node({ node_name: 'Corvus FI-1' }))).toBe('Corvus FI-1');
    expect(statusNodeName(node({ node_name: '  ' }))).toBe('10.35.1.50:7438');
    expect(statusNodeName(node({ node_name: null }))).toBe('10.35.1.50:7438');
    expect(statusNodeName(node({ host: '', node_name: undefined }))).toBe('abcdef012345');
  });
});
