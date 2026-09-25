import { describe, expect, it } from 'vitest';
import type { PlaybackStatusDescription, VersionStep } from '@machafoundation/core';
import {
  alphabetKeyLabel,
  ceilingText,
  qualityLabel,
  versionHowLabel,
  errorText,
  categoryLabel,
  episodeLabel,
  formatPlaybackTime,
  playbackNoticeText,
  serverStatusText,
  catalogueStatusText,
  isSignedOut,
  sortChoiceLabel,
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
    expect(episodeLabel({ seasonNumber: 3, episodeNumber: 2 })).toBe('Season 3 Episode 2');
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

  it('words core e840d72 decode fallback beside the copy refusal it mirrors', () => {
    expect(playbackNoticeText({ code: 'decode-fallback', error: new Error('MediaCodecVideoRenderer error') })).toBe(
      'This television could not decode the original streams, so they are being converted.',
    );
  });
});

describe('errorText', () => {
  it('words a failed walk by whether any node answered', async () => {
    const { MachaClusterRouteError } = await import('@machafoundation/core');
    expect(errorText(new MachaClusterRouteError(['a'], true, new Error('x')))).toBe("Can't reach the Macha server.");
    expect(errorText(new MachaClusterRouteError(['a'], false, new Error('x')))).toMatch(/couldn't answer/);
  });

  it('words a status found anywhere down the chain, never the message', () => {
    const lapsed = new Error('Macha request failed: a valid session bearer token is required', {
      cause: Object.assign(new Error('401'), { status: 401 }),
    });
    expect(errorText(lapsed)).toBe('Your session has ended. Sign in again.');
    expect(errorText(new Error('All configured Macha API endpoints failed.'))).toBe('Something went wrong.');
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

describe('versions', () => {
  it('labels a quality by its height, never "4K" or "2K"', () => {
    expect(qualityLabel(2160)).toBe('2160p');
    expect(qualityLabel(1440)).toBe('1440p');
  });

  it('says how a version would play, and a capped transcode is a transcode', () => {
    const step = (mode: string, source: VersionStep['source']) =>
      ({ quality: 1080, source, instruction: { mode } }) as unknown as VersionStep;
    expect(versionHowLabel(step('direct', 'file'))).toBe('Direct');
    expect(versionHowLabel(step('remux', 'file'))).toBe('Remux');
    expect(versionHowLabel(step('direct', 'transcode'))).toBe('Transcode');
  });

  it('gives the reason automatic play was capped', () => {
    expect(ceilingText({ quality: 2160, reason: 'ceiling-display' })).toBe(
      "Automatic play stops at 2160p, this screen's resolution.",
    );
    expect(ceilingText({ quality: 1080, reason: 'ceiling-preference' })).toBe(
      'Automatic play stops at 1080p, as set in Settings.',
    );
  });
});
