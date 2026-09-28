import {
  MachaClusterRouteError,
  MachaConnectionError,
  NOT_PLAYABLE_CODE,
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
 * An episode's mark: "S04E08", or "Episode 8" with no season (the web client's
 * `episodeCode`). Tom, 2026-09-27: "it should be S04E08 in all cases", on
 * the season page, the player, and the Continue Watching and search cards,
 * which had read "Season 4 Episode 8" and "4×08".
 */
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

/**
 * What a track is, for the lines under its artwork in the player: the artist,
 * the album with its year, and where it sits on the album. Tom's request,
 * 2026-09-24, matching the web client's `TrackFacts`. A track restored from
 * before core 0.19.0 may carry no music context; it shows what it has.
 */
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
    // Core d1069d2: its own choice stepped down to a quality a node keeps up
    // with. `quality` is the one now playing.
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
      // Core `de86392` carries the node's refusal as data. Server 0.58.0
      // refuses a track the file does not have instead of falling back, and
      // that one a viewer can act on; anything else keeps the plain sentence.
      if (notice.refusal?.code === 'choice_not_available') {
        return "That track isn't in this file, so nothing was changed.";
      }
      // Server 0.60.0 releases the transcode slot on a PATCH out of
      // transcode, so a change back into it (a Mode, Quality or Version pick)
      // can find another viewer holding the slot: 429 `resource_limit`.
      if (notice.refusal?.code === 'resource_limit') {
        return "This server is converting for another viewer right now, so that change wasn't made.";
      }
      return 'That change could not be applied.';
    default:
      return '';
  }
}

// ── The player's spinner ───────────────────────────────────────────────────

/**
 * Under the spinner once a start runs long: the web client's sentence. A node
 * that reports its start's progress (server 0.69.0) names the stage, which
 * replaces the general words; the seconds stay where they are.
 */
export function startWaitText(elapsedMs: number, stage?: string): string {
  return `${stage ?? 'Waiting for the node to start the stream'} — ${Math.floor(elapsedMs / 1_000)}s`;
}

/** A whole percentage of `done` over `total`, when the node measured both. */
function measuredPercent(done: number | undefined, total: number | undefined): number | undefined {
  if (done === undefined || total === undefined || !Number.isFinite(done) || !Number.isFinite(total) || total <= 0) return undefined;
  return Math.min(100, Math.max(0, Math.floor((done / total) * 100)));
}

/**
 * What a start or a change is doing, from core's counters (server 0.69.0):
 * the stage, and how far through it when the node measured that. Never an
 * estimate: a counter the node did not report shows no figure at all.
 *
 * The web client's `startProgressText` (`macha-client/src/text/viewerText.ts`),
 * word for word. `node` names where the work is happening: a change names it
 * throughout, because the viewer is watching one stream while another is
 * built; a start names it only while planning. `standalone` marks an open
 * stage with an ellipsis, for a line with nothing after it.
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
 * The status line while a new stream is prepared behind the one playing, the
 * web client's `preparingStreamText` (`macha-client/src/screens/PlayerScreen.tsx`).
 *
 * A change (a seek, a mode or quality switch) is built on the node already
 * serving, so that node is named. A failover arrives as a *start*, on a node
 * this line cannot name: the endpoint it holds is the one being replaced. So a
 * start is worded as a new stream with no node, and a node that reports no
 * progress keeps the sentence it always had.
 */
export function preparingStreamText(progress: PlaybackStartProgress | undefined, node?: string): string {
  const staged = progress && startProgressText({ ...progress, kind: 'change' }, progress.kind === 'change' ? node : undefined, true);
  return staged ?? (node ? `Preparing new stream on ${node}…` : 'Preparing new stream…');
}

// ── Versions and the quality ceiling ───────────────────────────────────────

/**
 * Quality names ("4K", "2K", "1080p") are core's `qualityLabel`, as are every
 * file's technical facts (`technicalSummary`): Tom, 2026-09-27, "Format,
 * codec, bitrate etc details are non i18n and technical. They are core's
 * responsibility ... The client should still 'format' them, in terms of
 * layout." Re-exported here so the screens take all their words from one
 * module. The sentence below is this client's.
 */
export { qualityLabel };

/** "its video", "its audio", "its video and audio", or undefined for neither. */
function convertedStreams(video: boolean, audio: boolean): string | undefined {
  return video && audio ? 'its video and audio' : video ? 'its video' : audio ? 'its audio' : undefined;
}

/**
 * A quality the viewer chose that no node can convert at real speed (core's
 * `TOO_SLOW_TO_PLAY_CODE`, d1069d2), built from the facts where they are
 * known: the quality playing, and which streams the session converts. Tom:
 * "clear, concise, and visible 'Macha can't play this quality because...'".
 * The web client's `tooSlowToPlayText`, word for word.
 */
export function tooSlowToPlayText(quality?: QualityClass, transform?: { video: string; audio: string }): string {
  const streams = transform && convertedStreams(transform.video === 'transcode', transform.audio === 'transcode');
  return `Macha can't play ${quality ? qualityLabel(quality) : 'this quality'} because the server can't convert ${streams ?? 'it'} fast enough to keep up.`;
}

/** Core stepped its own choice down to a quality a node can keep up with. The web client's words. */
export function qualitySteppedDownText(quality?: QualityClass): string {
  return `Switched to ${quality ? qualityLabel(quality) : 'a lower quality'}: the server can't convert a higher quality fast enough.`;
}

/**
 * Why Play chooses the file it does, as one sentence built from every fact
 * core gives (`PlaybackVersions`): the file chosen, a larger one passed over
 * because it would need converting (`passedOver`, core 03b0bdb), and a ceiling
 * that kept a larger one out (`limitedBy`, with its reason). Tom: automatic
 * play is capped "with context to the user as to why", and the facts are
 * parsed into one sentence rather than a line each.
 *
 * The web client's `qualityChoiceText` (`macha-client/src/text/viewerText.ts`,
 * f512cdc) word for word, by Tom's ruling that every client shows the same.
 * "Which plays without converting" is said only when a larger file was passed
 * over for needing it, since only then is it the reason. Undefined when Play
 * is choosing the largest file there is, which needs no explaining.
 */
export function qualityChoiceText(
  versions: Pick<PlaybackVersions, 'files' | 'automatic' | 'limitedBy' | 'passedOver'>,
): string | undefined {
  const { automatic, limitedBy, passedOver } = versions;
  if (!automatic) return undefined;
  const clauses: string[] = [];
  const { video, audio } = passedOver?.converts ?? { video: false, audio: false };
  const converted = video && audio ? 'its video and audio' : video ? 'its video' : audio ? 'its audio' : undefined;
  // A node's measured rate for this kind of picture (server 0.70.0): the
  // conversion is not only needed but too slow to watch.
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

/**
 * A file's line: core's summary parts, in core's order, joined with the
 * separator every client uses. The facts, their labels, the class after the
 * resolution ("3840×2160 (4K)"), the channels after the codec ("TRUEHD · 7.1")
 * and the files' order (largest picture first) are core's (`technicalSummary`,
 * `fileSummaries`, core 29fa878, from Tom's ask of 2026-09-27); the layout is
 * the client's.
 */
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
  // Core's own, when a start that reports progress (server 0.69.0) stops
  // reporting any: no server sentence behind it, and its 504 would otherwise
  // read as the server being unable to answer, which is not what happened.
  // The fact-free form; the player builds the full one from what was playing.
  if (playbackFailureCode(error) === TOO_SLOW_TO_PLAY_CODE) return tooSlowToPlayText();
  if (playbackFailureCode(error) === START_NO_PROGRESS_CODE) return 'The node stopped making progress starting this stream.';
  const status = playbackFailureStatus(error);
  if (status === 401 || status === 403) return 'Your session has ended. Sign in again.';
  if (status === 404 || status === 410) return "That isn't available any more.";
  if (status !== undefined && status >= 500) return "The Macha server couldn't answer right now. Try again shortly.";
  return 'Something went wrong.';
}

/**
 * The note under Settings > Server, or nothing while the node is serving.
 *
 * Worded from the server's code (core's `ServerStatus.code`, from server
 * 0.56.0), never from its `detail` sentence. The codes are the ones that can
 * answer `GET /api/v1/playback/status`, read from `macha` `src/service.cpp`
 * and `src/playback.cpp` at `60ce47a`; any other, and an older node's
 * missing code, falls back to the HTTP status as `errorText` does.
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
      return 'Your session has ended. Sign in again.';
    default:
      break;
  }
  const http = status.httpStatus;
  if (http === 401 || http === 403) return 'Your session has ended. Sign in again.';
  if (http >= 500) return "The Macha server couldn't answer right now. Try again shortly.";
  return 'Playback is not available on this Macha server.';
}

/**
 * The note under Settings > Catalogue, or nothing while it is ready.
 *
 * Worded from server 0.56.0's `error_code` (`converging`, `unavailable`),
 * never from `error`, which is the server's English. An older node sends only
 * the English; it gets this client's own sentence instead.
 */
export function catalogueStatusText(status: CatalogueStatus): string | undefined {
  if (status.ready) return undefined;
  if (status.error_code === 'converging') return 'The catalogue is still being brought up to date.';
  if (status.error_code || status.error) return "The catalogue isn't available on this server right now.";
  return undefined;
}

/**
 * Whether this failure means the viewer is signed out, not that anything is
 * down. §1.12: signed out, Settings used to report a `401` as an outage.
 */
export function isSignedOut(error: unknown): boolean {
  if (error instanceof SessionAuthError) return true;
  const status = playbackFailureStatus(error);
  return status === 401 || status === 403;
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

/**
 * A node's name on the Status screen: the operator's own name for it where
 * the server sends one (server 0.70.0, `node_name`; Tom: "show the names the
 * server sends"), else its address as this screen always showed it, else the
 * start of its id. An empty or blank name counts as none. The web client's
 * `statusNodeName` (`macha-client/src/screens/StatusScreen.tsx`), keeping this
 * screen's `host:port` where the web shows the host alone.
 */
export function statusNodeName(node: Pick<ClusterNodeStatus, 'id' | 'host' | 'port' | 'node_name'>): string {
  const name = node.node_name?.trim();
  if (name) return name;
  if (node.host) return `${node.host}:${node.port}`;
  return node.id.slice(0, 12);
}
