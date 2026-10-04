import {
  MachaClusterRouteError,
  MachaConnectionError,
  NOT_PLAYABLE_CODE,
  REGENERATION_ENDPOINT_GONE_CODE,
  SESSION_PROVENANCE_UNKNOWN_CODE,
  START_NO_PROGRESS_CODE,
  TOO_SLOW_TO_PLAY_CODE,
  playbackFailureCode,
  playbackFailureDetail,
  playbackFailureStatus,
  SessionAuthError,
  type MediaSortKey,
  type MediaSummary,
  type MusicHierarchyContext,
  type PlaybackNotice,
  type PlaybackStartProgress,
  type PlaybackStatusDescription,
  type PlaybackStreamInfo,
  qualityLabel,
  type PlaybackVersions,
  type ClusterNodeStatus,
  type QualityCeiling,
  type TechnicalSummary,
  type QualityClass,
  type SearchCategoryKey,
  type ServerStatus,
  type CatalogueStatus,
} from '@machafoundation/core';

/**
 * Every word this client shows a viewer, composed from core's data. Core
 * carries numbers, keys, contexts and codes, never viewer text (AGENTS.md).
 */

// ── Sort and search categories ────────────────────────────────────────────

const SORT_LABELS: Record<MediaSortKey, string> = {
  relevance: 'Relevance',
  title: 'Title',
  year: 'Year',
  recent: 'Recently added',
};

/** "Sort By Title". */
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

/** "S04E08", or "Episode 8" with no season (the web client's `episodeCode`). */
export function episodeLabel(item: Pick<MediaSummary, 'seasonNumber' | 'episodeNumber'>): string | undefined {
  const { seasonNumber, episodeNumber } = item;
  if (typeof episodeNumber !== 'number') return undefined;
  if (typeof seasonNumber !== 'number') return `Episode ${episodeNumber}`;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `S${pad(seasonNumber)}E${pad(episodeNumber)}`;
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

/** The lines under a track's artwork in the player (the web client's `TrackFacts`). */
export function trackFacts(
  track: Pick<MediaSummary, 'musicContext' | 'discNumber' | 'trackNumber'>,
): { artist?: string; album?: string; track?: string } {
  return {
    artist: track.musicContext?.artist?.title,
    album: track.musicContext ? albumLabel(track.musicContext) : undefined,
    track: trackNumberLabel(track),
  };
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
export function playbackNoticeText(notice: PlaybackNotice, quality?: QualityClass): string {
  switch (notice.code) {
    // `quality` is the one now playing.
    case 'quality-stepped-down':
      return qualitySteppedDownText(quality);
    case 'copy-refused':
      return 'This node could not copy the original streams, so they are being converted.';
    case 'decode-fallback':
      return 'This television could not decode the original streams, so they are being converted.';
    case 'cannot-seek':
      return 'This stream cannot seek.';
    case 'not-ready':
      return 'Playback is still loading.';
    case 'instruction-failed':
      return 'Could not work out how to play this here.';
    case 'subtitles-loading':
      return 'Loading subtitles…';
    case 'update-failed':
      // The node's refusal code, where the viewer can act on it.
      if (notice.refusal?.code === 'choice_not_available') {
        return "That track isn't in this file, so nothing was changed.";
      }
      // 429: another viewer holds the node's transcode slot.
      if (notice.refusal?.code === 'resource_limit') {
        return "This server is converting for another viewer right now, so that change wasn't made.";
      }
      return 'That change could not be applied.';
    default:
      return '';
  }
}

// ── The player's spinner ───────────────────────────────────────────────────

/** Under the spinner once a start runs long (the web client's sentence); a reported stage replaces the general words. */
export function startWaitText(elapsedMs: number, stage?: string): string {
  return `${stage ?? 'Waiting for the node to start the stream'} — ${Math.floor(elapsedMs / 1_000)}s`;
}

/** A whole percentage of `done` over `total`, when the node measured both. */
function measuredPercent(done: number | undefined, total: number | undefined): number | undefined {
  if (done === undefined || total === undefined || !Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return undefined;
  return Math.min(100, Math.max(0, Math.floor((done / total) * 100)));
}

/**
 * What a start or a change is doing: the stage, and a percentage only when
 * the node measured one. The web client's `startProgressText`
 * (`macha-client/src/text/viewerText.ts`), word for word. A change names
 * `node` throughout, a start only while planning; `standalone` ends an open
 * stage with an ellipsis.
 */
export function startProgressText(progress: PlaybackStartProgress, node?: string, standalone = false): string | undefined {
  const on = node ? ` on ${node}` : '';
  const change = progress.kind === 'change';
  const words =
    progress.stage === 'planning' ? `${change ? 'Preparing new stream' : 'Preparing the stream'}${on}`
    : progress.stage === 'preroll' ? `Finding the start point${change ? on : ''}`
    : progress.stage === 'encoding' ? (change ? `Starting the new stream${on}` : 'Starting the stream')
    : undefined;
  if (!words) return undefined;
  const percent =
    progress.stage === 'preroll' ? measuredPercent(progress.prerollDecodedMs, progress.prerollTotalMs)
    : progress.stage === 'encoding' ? measuredPercent(progress.outputMediaMs, progress.firstFragmentMs)
    : undefined;
  if (percent !== undefined) return `${words}: ${percent}%`;
  return standalone ? `${words}…` : words;
}

/**
 * The status line while a new stream is prepared behind the one playing: the
 * web client's `preparingStreamText` (`macha-client/src/screens/PlayerScreen.tsx`).
 * A change names its node; a failover arrives as a start, whose `node` is the
 * one being replaced, so it names none.
 */
export function preparingStreamText(progress: PlaybackStartProgress | undefined, node?: string): string {
  const staged = progress && startProgressText({ ...progress, kind: 'change' }, progress.kind === 'change' ? node : undefined, true);
  return staged ?? (node ? `Preparing new stream on ${node}…` : 'Preparing new stream…');
}

// ── Versions and the quality ceiling ───────────────────────────────────────

/** Quality names ("4K", "1080p") are core's: technical, not translatable. Re-exported so screens take all words from here. */
export { qualityLabel };

/** "its video", "its audio", "its video and audio", or undefined for neither. */
function convertedStreams(video: boolean, audio: boolean): string | undefined {
  return video && audio ? 'its video and audio' : video ? 'its video' : audio ? 'its audio' : undefined;
}

/**
 * A chosen quality no node can convert at real speed (core's
 * `TOO_SLOW_TO_PLAY_CODE`). The web client's `tooSlowToPlayText`, word for word.
 */
export function tooSlowToPlayText(quality?: QualityClass, transform?: { video: string; audio: string }): string {
  const streams = transform && convertedStreams(transform.video === 'transcode', transform.audio === 'transcode');
  return `Macha can't play ${quality ? qualityLabel(quality) : 'this quality'} because the server can't convert ${streams ?? 'it'} fast enough to keep up.`;
}

/** Core stepped its choice down to a quality a node can keep up with. The web client's words. */
export function qualitySteppedDownText(quality?: QualityClass): string {
  return `Switched to ${quality ? qualityLabel(quality) : 'a lower quality'}: the server can't convert a higher quality fast enough.`;
}

/**
 * Why Play chooses the file it does, in one sentence: the file chosen, a
 * larger one passed over for needing conversion (`passedOver`), and a ceiling
 * that kept a larger one out (`limitedBy`). The web client's
 * `qualityChoiceText` (`macha-client/src/text/viewerText.ts`), word for word.
 * Undefined when Play chooses the largest file.
 */
export function qualityChoiceText(
  versions: Pick<PlaybackVersions, 'files' | 'automatic' | 'limitedBy' | 'passedOver'>,
): string | undefined {
  const { automatic, limitedBy, passedOver } = versions;
  if (!automatic) return undefined;
  const clauses: string[] = [];
  const { video, audio } = passedOver?.converts ?? { video: false, audio: false };
  const converted = video && audio ? 'its video and audio' : video ? 'its video' : audio ? 'its audio' : undefined;
  // A node measured the conversion as slower than real time.
  const tooSlow = passedOver?.reasons.includes('transcode-below-real-time');
  if (passedOver && converted) {
    clauses.push(`${qualityLabel(passedOver.quality)} needs ${converted} converted${tooSlow ? ", which the server can't do fast enough" : ''}`);
  }
  const above = limitedBy
    ? Math.max(...versions.files.map((file) => file.quality).filter((quality) => quality > limitedBy.quality))
    : Number.NEGATIVE_INFINITY;
  if (limitedBy && Number.isFinite(above)) {
    const larger = qualityLabel(above as QualityCeiling['quality']);
    clauses.push(
      limitedBy.reason === 'ceiling-display' ? `${larger} is more than this screen shows`
      : limitedBy.reason === 'ceiling-device' ? `${larger} is more than this device plays`
      : limitedBy.reason === 'ceiling-cellular' ? `${larger} is more than Play uses on mobile data`
      : `${larger} is more than the most set in Settings`,
    );
  }
  if (clauses.length === 0) return undefined;
  const plays = automatic.instruction.video !== 'transcode' && automatic.instruction.audio !== 'transcode';
  const chosen = `Play chooses ${qualityLabel(automatic.quality)}${passedOver && converted && plays ? ', which plays without converting' : ''}.`;
  return `${chosen} ${clauses.join(', and ')}. Pick a quality to play another.`;
}

/** A file's line: core's `technicalSummary` parts in core's order, joined with every client's separator. */
export function fileLine(summary: TechnicalSummary): string {
  return summary.parts.join(' · ');
}

/** The Settings choice that leaves the ceiling to the screen. */
export function automaticCeilingLabel(display: QualityClass | undefined): string {
  return display ? `Screen (${qualityLabel(display)})` : 'Screen';
}

// ── The alphabet strip ─────────────────────────────────────────────────────

/** Core's catch-all key is `'other'`; the strip shows it as `#`. */
export function alphabetKeyLabel(key: string): string {
  return key === 'other' ? '#' : key;
}

// ── Errors ─────────────────────────────────────────────────────────────────

export const SESSION_ENDED_TEXT = 'Your session has ended. Sign in again.';

/** A node answered but could not serve the request, and said nothing of its own. */
export const SERVER_BUSY_TEXT = "The Macha server couldn't answer right now. Try again shortly.";

/** No connection at all. The web client's sentence, word for word. */
export const SERVER_UNREACHABLE_TEXT =
  'The Macha server cannot be reached. Check that the server is running and that the API address is correct.';

/**
 * Every node was tried and none answered. The web client's sentence, word for
 * word (`macha-client` `src/text/viewerText.ts`).
 */
export const NO_NODE_ANSWERED_TEXT =
  'No Macha server answered. Try again in a moment; if it keeps happening, check that the servers are running.';

/**
 * A sentence for any error a viewer might be shown. Never the error's
 * message, which is log text: decided from the class, the HTTP status and the
 * server's code.
 */
export function errorText(error: unknown): string {
  if (error instanceof MachaClusterRouteError) {
    if (error.unreachable) return NO_NODE_ANSWERED_TEXT;
    // The nodes refused: the server's sentence, as the web client's
    // `viewerErrorText` gives it, else ours.
    return playbackFailureDetail(error) ?? SERVER_BUSY_TEXT;
  }
  if (error instanceof MachaConnectionError) return SERVER_UNREACHABLE_TEXT;
  if (error instanceof SessionAuthError) return SESSION_ENDED_TEXT;
  if (playbackFailureCode(error) === NOT_PLAYABLE_CODE) return "This can't be played on this television.";
  // Core's own codes, checked before the status: their 504 would otherwise
  // read as `SERVER_BUSY_TEXT`. The player builds the fuller too-slow sentence.
  if (playbackFailureCode(error) === TOO_SLOW_TO_PLAY_CODE) return tooSlowToPlayText();
  if (playbackFailureCode(error) === START_NO_PROGRESS_CODE) return 'The node stopped making progress starting this stream.';
  // The web client's sentence (`playbackFailureCodeText`), word for word.
  const code = playbackFailureCode(error);
  if (code === SESSION_PROVENANCE_UNKNOWN_CODE || code === REGENERATION_ENDPOINT_GONE_CODE) {
    return 'This stream is no longer available. Start it again.';
  }
  const status = playbackFailureStatus(error);
  if (status === 401 || status === 403) return SESSION_ENDED_TEXT;
  if (status === 404 || status === 410) return "That isn't available any more.";
  if (status !== undefined && status >= 500) return SERVER_BUSY_TEXT;
  return 'Something went wrong.';
}

/**
 * The note under Settings > Server, or nothing while the node is serving.
 * Worded from `ServerStatus.code` (the codes of `GET /api/v1/playback/status`,
 * in `macha` `src/service.cpp` and `src/playback.cpp`), never from `detail`.
 * Any other code, or none (a node before 0.56.0), falls back to the HTTP status.
 */
export function serverStatusText(status: ServerStatus): string | undefined {
  if (status.playbackAvailable) return undefined;
  switch (status.code) {
    case 'service_recovering':
      return 'The Macha server is still starting up. Try again shortly.';
    case 'startup_failed':
      return "The Macha server couldn't start.";
    case 'streaming_disabled':
      return 'Playback is switched off on this Macha server.';
    case 'unauthorized':
    case 'forbidden':
      return SESSION_ENDED_TEXT;
    default:
      break;
  }
  const http = status.httpStatus;
  if (http === 401 || http === 403) return SESSION_ENDED_TEXT;
  if (http >= 500) return SERVER_BUSY_TEXT;
  return 'Playback is not available on this Macha server.';
}

/**
 * The note under Settings > Catalogue, or nothing while it is ready. Worded
 * from `error_code`, never from `error` (the server's English, all a node
 * before 0.56.0 sends).
 */
export function catalogueStatusText(status: CatalogueStatus): string | undefined {
  if (status.ready) return undefined;
  if (status.error_code === 'converging') return 'The catalogue is still being brought up to date.';
  if (status.error_code || status.error) return "The catalogue isn't available on this server right now.";
  return undefined;
}

/** Whether this failure means the viewer is signed out, so a `401` is never reported as an outage. */
export function isSignedOut(error: unknown): boolean {
  if (error instanceof SessionAuthError) return true;
  const status = playbackFailureStatus(error);
  return status === 401 || status === 403;
}

/**
 * Why a sign-in failed: the server's own sentence where it gave one. The
 * server answers an unknown user and a wrong password identically; rewording
 * here could reintroduce the difference.
 */
export function signInErrorText(error: unknown): string {
  const server = playbackFailureDetail(error);
  if (server) return server;
  const status = playbackFailureStatus(error);
  if (status === 401 || status === 403) return "That username and password weren't recognised.";
  return errorText(error);
}

/** A sign-out whose revoke failed: signed out locally, but the session may still be live on a node. */
export const SIGN_OUT_REVOKE_FAILED =
  "Signed out on this television, but the server couldn't be told, so the session may stay open until it expires.";

// ── The player's stream lines ──────────────────────────────────────────────

/**
 * The trail's stream lines ("DIRECT · HEVC · 1920×1080 · 5.6 Mb/s"), composed
 * from `describePlaybackSession`'s data. Strings, because the description's
 * `video` and `audio` are objects and rendering one in a `<Text>` throws.
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

/**
 * A node's name on the Status screen: its `node_name` unless blank, else its
 * address, else the start of its id. The web client's `statusNodeName`
 * (`macha-client/src/screens/StatusScreen.tsx`), but with `host:port`.
 */
export function statusNodeName(node: Pick<ClusterNodeStatus, 'id' | 'host' | 'port' | 'node_name'>): string {
  const name = node.node_name?.trim();
  if (name) return name;
  if (node.host) return `${node.host}:${node.port}`;
  return node.id.slice(0, 12);
}
