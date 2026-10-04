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
 * The rules behind the options panel, as plain data.
 *
 * A mode press sends `{ mode }` alone: naming a mode resets `video`, `audio`,
 * `max_height` and `max_bitrate` server-side. Read `session.transform`, not
 * the mode: a 5.1 downmix arrives as
 * `mode: 'transcode', video: 'copy', audio: 'transcode'`.
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
  // The web client's words.
  'transcode-below-real-time': 'the server cannot convert this picture fast enough to play',
};

export function streamLabel(stream: PlaybackStreamInfo, fallback: string): string {
  const parts = [stream.language ? stream.language.toUpperCase() : fallback, stream.codec.toUpperCase()];
  if (stream.channels) parts.push(`${stream.channels}ch`);
  if (stream.forced) parts.push('forced');
  return parts.join(' · ');
}

/**
 * Why this stream is served the way it is. The only on-screen sign that a
 * facts lookup failed and the coordinator fell back to transcode.
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

/** Inputs the chooser defaulted because nobody supplied them; each is a defect. */
export function assumptionNote(instruction: PlaybackInstructionReport | undefined): string | undefined {
  if (!instruction || instruction.chosenByViewer || instruction.assumed.length === 0) return undefined;
  return `Decided without: ${instruction.assumed.join(', ')}.`;
}

/** True when the note reports a problem, not a decision. */
export function noteIsWarning(instruction: PlaybackInstructionReport | undefined): boolean {
  return Boolean(instruction?.withoutFacts);
}

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
 * The node's modes, less those core's `offeredModes` says this set cannot
 * play. A mode offered despite objections keeps them, for `modeObjectionNote`.
 * Without facts, every mode the node offers stays.
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

/** Why a mode offered despite the device's objections may not play. */
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
 * With several versions: the versions, then any cap the node offers below the
 * smallest, and no "Original". With one version or none: Original, then the
 * node's caps. Caps only while the node can change quality (a transcode).
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
