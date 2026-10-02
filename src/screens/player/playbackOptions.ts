import type {
  OfferedMode,
  PlaybackDecisionReason,
  PlaybackInstructionReport,
  PlaybackMode,
  PlaybackStreamInfo,
  PlaybackTransform,
  VersionStep,
} from '@machafoundation/core';

/**
 * The rules behind the options panel, separated from the panel itself.
 *
 * All of this is plain data and none of it needs a renderer, which matters
 * because a missing note fails silently: it turns the chooser's worst failure
 * into no symptom at all.
 */

/*
 * A mode press sends `{ mode }` alone. The server resets `video`, `audio`,
 * `max_height` and `max_bitrate` the moment `mode` is named, and what a mode
 * implies per stream is the server's judgement, not this client's.
 *
 * Read the per-stream answer, not the mode: **a 5.1 downmix arrives as
 * `mode: 'transcode', video: 'copy', audio: 'transcode'`**, which the mode
 * alone would call a video re-encode. `session.transform` is stated by the
 * node that served it, and is what `audioProcessingNote` below shows.
 */

export const MODE_LABELS: Record<PlaybackMode, string> = {
  direct: 'Direct',
  remux: 'Remux',
  transcode: 'Transcode',
};

const REASON_TEXT: Record<PlaybackDecisionReason, string> = {
  'source-plays-as-is': 'this device plays the file as it is',
  'container-not-playable': 'this device cannot play the container',
  'video-codec-not-playable': 'this device cannot decode the video',
  'video-codec-not-deliverable-over-hls': 'the video cannot be delivered over HLS here',
  'video-bit-depth-exceeds-client': 'the video is deeper than this device decodes',
  'video-size-exceeds-client': 'the picture is larger than this device decodes',
  'video-transfer-not-presentable': 'this device cannot present the colour transfer',
  'video-dolby-vision-not-supported': 'this device does not support this Dolby Vision profile',
  'audio-codec-not-playable': 'this device cannot decode the audio',
  'audio-codec-not-deliverable-over-hls': 'the audio cannot be delivered over HLS here',
  'host-policy-forbids-direct': 'this device is not trusted to play files directly',
  'host-policy-excludes-container': 'this device is not trusted with the container',
  'host-policy-excludes-codec': 'this device is not trusted with the codec',
  'host-policy-prefers-container': 'this device is served a segment format it handles better',
  'no-technical-facts': 'the server did not report what this file is',
  'executor-refused-copy': 'this server refused to copy the streams',
  'executor-cannot-direct': 'this server cannot serve the file directly',
  'executor-cannot-copy-video': 'this server cannot repackage the video',
  'executor-cannot-copy-audio': 'this server cannot repackage the audio',
  'player-could-not-decode': 'this television could not decode the original streams',
  // A node's measured conversion rate. The web client's words.
  'transcode-below-real-time': 'the server cannot convert this picture fast enough to play',
};

/** A stream, named the way a viewer choosing between two of them needs. */
export function streamLabel(stream: PlaybackStreamInfo, fallback: string): string {
  const parts = [stream.language ? stream.language.toUpperCase() : fallback, stream.codec.toUpperCase()];
  if (stream.channels) parts.push(`${stream.channels}ch`);
  if (stream.forced) parts.push('forced');
  return parts.join(' · ');
}

/**
 * Why this stream is being served the way it is.
 *
 * **The chooser's worst failure has no symptom without this.** When the facts
 * lookup fails the coordinator falls back to transcode — the right answer,
 * since it is the only instruction always performable — and the viewer sees a
 * picture that works. So a client can quietly transcode a whole library that
 * would have direct-played, on a cluster that looks healthy, and nothing ever
 * prompts anyone to look.
 *
 * That argument is the web client's, and it applies **harder here**: a
 * television has no console anyone will open, so this panel is the only place
 * on this platform where the difference can show.
 */
export function instructionNote(instruction: PlaybackInstructionReport | undefined): string | undefined {
  if (!instruction) return undefined;
  if (instruction.chosenByViewer) return 'Chosen by you.';
  if (instruction.withoutFacts) {
    return 'Chosen without facts — transcoding because nothing could be reasoned from.';
  }
  const reasons = instruction.reasons.map((reason) => REASON_TEXT[reason] ?? reason);
  return reasons.length > 0 ? `Chosen automatically: ${reasons.join('; ')}.` : 'Chosen automatically.';
}

/**
 * Inputs nobody supplied, named rather than left to a reasonable default.
 *
 * A reasonable default produces a plausible instruction, so a field populated
 * by nobody never looks wrong. This client intends to wire all of them, so
 * anything listed here is a defect and not a note.
 */
export function assumptionNote(instruction: PlaybackInstructionReport | undefined): string | undefined {
  if (!instruction || instruction.chosenByViewer || instruction.assumed.length === 0) return undefined;
  return `Decided without: ${instruction.assumed.join(', ')}.`;
}

/** True when a note is reporting a problem rather than describing a decision. */
export function noteIsWarning(instruction: PlaybackInstructionReport | undefined): boolean {
  return Boolean(instruction?.withoutFacts);
}

/** How the server is handling audio, in its own terms. */
export function audioProcessingNote(
  transform: PlaybackTransform | undefined,
  outputCodec: string | undefined,
): string {
  if (transform === 'transcode') {
    return `Server processing: transcode${outputCodec ? ` → ${outputCodec.toUpperCase()}` : ''}`;
  }
  return transform === 'copy' ? 'Server processing: copy' : 'Server processing: omitted';
}


/** A mode the panel offers, and what the device says against it if anything. */
export interface ModeChoice {
  mode: PlaybackMode;
  objections: PlaybackDecisionReason[];
}

/**
 * The modes to offer: the node's, less those this set cannot play.
 *
 * Limited to the device's capabilities, with a setting to turn the limit off.
 * Core's `offeredModes` decides per mode for the file playing; with the
 * setting on it offers every mode and still says why the device objects,
 * which `modeObjectionNote` shows. Without facts there is nothing to reason
 * from, so every mode the node offers stays.
 */
export function modeChoices(
  serverModes: readonly PlaybackMode[],
  offered: readonly OfferedMode[] | undefined,
): ModeChoice[] {
  if (!offered) return serverModes.map((mode) => ({ mode, objections: [] }));
  return serverModes.flatMap((mode) => {
    const verdict = offered.find((entry) => entry.mode === mode);
    if (!verdict) return [{ mode, objections: [] }];
    return verdict.offered ? [{ mode, objections: verdict.reasons }] : [];
  });
}

/** Why a mode offered only because the viewer asked for everything may not play. */
export function modeObjectionNote(choices: readonly ModeChoice[]): string | undefined {
  const objected = choices.filter((choice) => choice.objections.length > 0);
  if (objected.length === 0) return undefined;
  return objected
    .map((choice) => `${MODE_LABELS[choice.mode]}: ${choice.objections.map((reason) => REASON_TEXT[reason] ?? reason).join('; ')}.`)
    .join(' ');
}

/** One choice in the player's single Quality row. */
export type QualityChoice =
  | { kind: 'version'; step: VersionStep }
  | { kind: 'cap'; height: number }
  | { kind: 'original' };

/**
 * The player's one Quality row: versions and quality caps are one control.
 *
 * With several versions, the versions (4K, 2K, 1080p, 720p: a file, or a
 * capped transcode of a larger one), then any smaller cap the node offers
 * below the smallest version (480p, 360p). "Original" goes: a version already
 * plays a file at its own size, and picking one clears any cap. With one
 * version or none, the node's caps, Original first. Caps only while
 * the node can change quality (a transcode); versions whatever the mode.
 */
export function qualityChoices(
  steps: readonly VersionStep[],
  qualityHeights: readonly number[],
  canChangeQuality: boolean,
): QualityChoice[] {
  const versions: QualityChoice[] = steps.length > 1 ? steps.map((step) => ({ kind: 'version', step })) : [];
  if (versions.length > 0) {
    const smallest = Math.min(...steps.map((step) => step.quality));
    const below = canChangeQuality ? qualityHeights.filter((height) => height < smallest) : [];
    return [...versions, ...below.map((height): QualityChoice => ({ kind: 'cap', height }))];
  }
  if (!canChangeQuality) return [];
  return [{ kind: 'original' }, ...qualityHeights.map((height): QualityChoice => ({ kind: 'cap', height }))];
}
