import {
  MachaClusterRouteError,
  MachaConnectionError,
  NOT_PLAYABLE_CODE,
  playbackFailureCode,
  playbackFailureDetail,
  playbackFailureStatus,
  SessionAuthError,
  type MediaSortKey,
  type MediaSummary,
  type MusicHierarchyContext,
  type PlaybackNotice,
  type PlaybackStatusDescription,
  type PlaybackStreamInfo,
  type SearchCategoryKey,
} from '@machafoundation/core';

/**
 * Every word this client shows a viewer, composed from core's data.
 *
 * **Tom, 2026-09-24: core handles no viewer text at all.** Core carries
 * numbers, keys, contexts and codes; the words are the client's (AGENTS.md).
 * They are kept in this one module so the wording is in one place and can be
 * read, changed and one day translated without hunting through screens.
 *
 * The wording is what core used to compose, carried over unchanged when core
 * cut it (its `826e38a`, `f016815`, `8db0a12`, `f75b2bd`), so the cut changed
 * nothing a viewer sees.
 */

// ── Sort and search categories ────────────────────────────────────────────

const SORT_LABELS: Record<MediaSortKey, string> = {
  relevance: 'Relevance',
  title: 'Title',
  year: 'Year',
  recent: 'Recently added',
};

/** "Sort By Title" — Tom's wording: no separate heading, each choice says it. */
export function sortChoiceLabel(key: MediaSortKey): string {
  return `Sort By ${SORT_LABELS[key]}`;
}

const CATEGORY_LABELS: Record<SearchCategoryKey, string> = {
  movies: 'Movies',
  shows: 'TV Shows',
  music: 'Music',
};

export function categoryLabel(key: SearchCategoryKey): string {
  return CATEGORY_LABELS[key];
}

// ── Media lines ────────────────────────────────────────────────────────────

/**
 * "Season 3 Episode 2", or "Episode 2" with no season. Tom's wording for an
 * episode named away from its season (search, Continue Watching).
 */
export function episodeLabel(item: Pick<MediaSummary, 'seasonNumber' | 'episodeNumber'>): string | undefined {
  const { seasonNumber, episodeNumber } = item;
  if (typeof episodeNumber !== 'number') return undefined;
  return typeof seasonNumber === 'number' ? `Season ${seasonNumber} Episode ${episodeNumber}` : `Episode ${episodeNumber}`;
}

/** "S01E02" — the compact form, for where the season is already on screen. */
export function compactEpisodeLabel(item: Pick<MediaSummary, 'seasonNumber' | 'episodeNumber'>): string | undefined {
  const { seasonNumber, episodeNumber } = item;
  if (typeof episodeNumber !== 'number') return undefined;
  const episode = `E${String(episodeNumber).padStart(2, '0')}`;
  return typeof seasonNumber === 'number' ? `S${String(seasonNumber).padStart(2, '0')}${episode}` : episode;
}

/** "Track 9", or "Disc 2 · Track 3" on any disc after the first. */
export function trackNumberLabel(item: Pick<MediaSummary, 'discNumber' | 'trackNumber'>): string | undefined {
  const { discNumber, trackNumber } = item;
  if (typeof trackNumber !== 'number') return undefined;
  return typeof discNumber === 'number' && discNumber > 1
    ? `Disc ${discNumber} · Track ${trackNumber}`
    : `Track ${trackNumber}`;
}

/** "Homogenic (1997)", or "Homogenic" with no year. */
export function albumLabel(context: MusicHierarchyContext): string {
  const { title, year } = context.album;
  return typeof year === 'number' && year > 0 ? `${title} (${year})` : title;
}

/** "Björk - Homogenic (1997)" — a track found by search. */
export function trackSearchLine(context: MusicHierarchyContext): string {
  const album = albumLabel(context);
  return context.artist?.title ? `${context.artist.title} - ${album}` : album;
}

// ── Time ───────────────────────────────────────────────────────────────────

/** "1:02:03", "4:05", "0:00" — the player's clock. */
export function formatPlaybackTime(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0:00';
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

// ── Player notices ─────────────────────────────────────────────────────────

/** The line the player shows for one of core's notice codes. */
export function playbackNoticeText(notice: PlaybackNotice): string {
  switch (notice.code) {
    case 'copy-refused':
      return 'This node could not copy the original streams, so they are being converted.';
    case 'cannot-seek':
      return 'This stream cannot seek.';
    case 'not-ready':
      return 'Playback is still loading.';
    case 'instruction-failed':
      return 'Could not work out how to play this here.';
    case 'subtitles-loading':
      return 'Loading subtitles…';
    case 'update-failed':
      return 'That change could not be applied.';
    default:
      return '';
  }
}

// ── The alphabet strip ─────────────────────────────────────────────────────

/** Core's catch-all key is `'other'`; the strip shows it as `#`. */
export function alphabetKeyLabel(key: string): string {
  return key === 'other' ? '#' : key;
}

// ── Errors ─────────────────────────────────────────────────────────────────

/**
 * A sentence for any error a viewer might be shown.
 *
 * **Never the error's message.** Since core's cut (`8db0a12`, `e28d6ad`)
 * every message is log text; what can be shown is decided from the class, the
 * HTTP status and the server's code, through core's accessors, so a reworded
 * log line can never change what a viewer reads.
 */
export function errorText(error: unknown): string {
  if (error instanceof MachaClusterRouteError) {
    return error.unreachable
      ? "Can't reach the Macha server."
      : "The Macha server couldn't answer right now. Try again shortly.";
  }
  if (error instanceof MachaConnectionError) return "Can't reach the Macha server.";
  if (error instanceof SessionAuthError) return 'Your session has ended. Sign in again.';
  if (playbackFailureCode(error) === NOT_PLAYABLE_CODE) return "This can't be played on this television.";
  const status = playbackFailureStatus(error);
  if (status === 401 || status === 403) return 'Your session has ended. Sign in again.';
  if (status === 404 || status === 410) return "That isn't available any more.";
  if (status !== undefined && status >= 500) return "The Macha server couldn't answer right now. Try again shortly.";
  return 'Something went wrong.';
}

/**
 * Why a sign-in failed: the server's own sentence where it gave one.
 *
 * Deliberately the server's words (core carries them as `detail`, read
 * through `playbackFailureDetail`): the server answers an unknown user and a
 * wrong password identically, and rewording here could reintroduce the
 * difference. Only when it said nothing is the sentence ours.
 */
export function signInErrorText(error: unknown): string {
  const server = playbackFailureDetail(error);
  if (server) return server;
  const status = playbackFailureStatus(error);
  if (status === 401 || status === 403) return "That username and password weren't recognised.";
  return errorText(error);
}

/**
 * A sign-out whose revoke failed. Local state is cleared first, so this
 * television *is* signed out; the session may still be live on a node, which
 * is worth saying because the remedy is somebody else's.
 */
export const SIGN_OUT_REVOKE_FAILED =
  "Signed out on this television, but the server couldn't be told, so the session may stay open until it expires.";

// ── The player's stream lines ──────────────────────────────────────────────

/**
 * The trail's stream lines — "MATROSKA", "DIRECT · HEVC · 1920×1080 ·
 * 5.6 Mb/s", "AUDIO TRANSCODE · SOURCE · ENG · DTS · 5.1 · 48 kHz → AAC ·
 * 5.1 · 48 kHz" — composed from `describePlaybackSession`'s data.
 *
 * Core composed these until its `8db0a12`; the formatting below is its
 * composer carried over, so the lines read exactly as they did. **Every field
 * must be a string by the time it reaches a `<Text>`**: the description's
 * `video` and `audio` are objects now, and rendering one would throw.
 */
export interface StreamLines {
  container?: string;
  video?: string;
  audio?: string;
  subtitle?: string;
}

const CONTAINER_LABELS: Record<string, string> = { fmp4: 'FMP4', mpegts: 'MPEG-TS' };

export function streamLines(description: PlaybackStatusDescription | undefined): StreamLines {
  if (!description) return {};
  const whole = description.delivery === 'direct' ? 'DIRECT' : description.delivery === 'remux' ? 'REMUX' : undefined;
  const lines: StreamLines = {
    container: description.container ? (CONTAINER_LABELS[description.container] ?? description.container.toUpperCase()) : undefined,
  };

  const video = description.video;
  if (video && video.transform !== 'omit') {
    const source = [video.source.codec.toUpperCase()];
    if (video.source.width && video.source.height) source.push(`${video.source.width}×${video.source.height}`);
    const sourceRate = formatBitrate(video.source.bitrate || video.sourceBitrate);
    if (sourceRate) source.push(sourceRate);
    if (video.transform === 'transcode') {
      const output: string[] = [];
      if (video.output?.codec) output.push(video.output.codec.toUpperCase());
      if (video.output?.width && video.output.height) output.push(`${video.output.width}×${video.output.height}`);
      const outputRate = formatBitrate(video.output?.bitrate ?? video.outputBitrate);
      if (outputRate) output.push(outputRate);
      const head = ['VIDEO TRANSCODE', 'SOURCE', ...source].join(' · ');
      lines.video = output.length ? `${head} → ${output.join(' · ')}` : head;
    } else {
      lines.video = [whole ?? 'VIDEO COPY', ...source].join(' · ');
    }
  }

  const audio = description.audio;
  if (audio && audio.transform !== 'omit') {
    const source = audioParts(audio.source);
    if (audio.transform === 'transcode') {
      const output: string[] = [];
      if (audio.output?.codec) output.push(audio.output.codec.toUpperCase());
      const channels = formatChannels(audio.output?.channels);
      const rate = formatSampleRate(audio.output?.sampleRate);
      if (channels) output.push(channels);
      if (rate) output.push(rate);
      if (audio.output?.bitDepth) output.push(`${audio.output.bitDepth}-bit`);
      const bitrate = formatBitrate(audio.output?.bitrate);
      if (bitrate) output.push(bitrate);
      const head = ['AUDIO TRANSCODE', 'SOURCE', ...source].join(' · ');
      lines.audio = output.length ? `${head} → ${output.join(' · ')}` : head;
    } else {
      lines.audio = [whole ?? 'AUDIO COPY', ...source].join(' · ');
    }
  }

  const subtitle = description.subtitle;
  if (subtitle) {
    const parts = ['SUBTITLES', subtitle.language ? subtitle.language.toUpperCase() : 'UND', subtitle.codec.toUpperCase()];
    if (subtitle.forced) parts.push('FORCED');
    lines.subtitle = parts.join(' · ');
  }
  return lines;
}

function audioParts(stream: PlaybackStreamInfo): string[] {
  const parts: string[] = [];
  if (stream.language) parts.push(stream.language.toUpperCase());
  parts.push(stream.codec.toUpperCase());
  const channels = formatChannels(stream.channels);
  const rate = formatSampleRate(stream.sampleRate);
  if (channels) parts.push(channels);
  if (rate) parts.push(rate);
  if (stream.bitDepth) parts.push(`${stream.bitDepth}-bit`);
  const bitrate = formatBitrate(stream.bitrate);
  if (bitrate) parts.push(bitrate);
  return parts;
}

function formatBitrate(bitrate?: number): string {
  if (!bitrate) return '';
  return bitrate >= 1_000_000 ? `${(bitrate / 1_000_000).toFixed(1)} Mb/s` : `${Math.round(bitrate / 1000)} kb/s`;
}

function formatChannels(channels?: number): string {
  if (!channels) return '';
  if (channels === 1) return 'mono';
  if (channels === 2) return 'stereo';
  if (channels === 6) return '5.1';
  if (channels === 8) return '7.1';
  return `${channels}ch`;
}

function formatSampleRate(sampleRate?: number): string {
  if (!sampleRate) return '';
  return sampleRate >= 1_000 ? `${Number((sampleRate / 1_000).toFixed(1))} kHz` : `${sampleRate} Hz`;
}
