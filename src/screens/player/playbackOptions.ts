import type {
  PlaybackDecisionReason,
  PlaybackInstructionReport,
  PlaybackMode,
  PlaybackStreamInfo,
  PlaybackTransform,
} from '@macha/core';

/**
 * The rules behind the options panel, separated from the panel itself.
 *
 * All of this is plain data and none of it needs a renderer, which matters
 * because two of the rules below are the kind that fail silently: a mode press
 * that omits its transforms is refused by the server, and a missing note turns
 * the chooser's worst failure into no symptom at all.
 */

/**
 * What each mode means per stream, in the server's own terms.
 *
 * **A mode press must state the whole transform, not the shorthand for it.**
 * The session being amended already carries per-stream transforms from whatever
 * instruction created it, and naming only the mode leaves those in place. The
 * server then reads the result as a contradiction and refuses the entire
 * update — the viewer pressed one button and gets an error about a request they
 * did not make.
 *
 * Direct and remux copy both streams by definition; transcode as a viewer's
 * explicit choice means re-encode, not re-encode whatever the last instruction
 * happened to leave alone. Saying so outright leaves nothing to be merged with
 * and nothing to disagree about.
 */
export const MODE_TRANSFORMS: Record<PlaybackMode, { video: 'copy' | 'transcode'; audio: 'copy' | 'transcode' }> = {
  direct: { video: 'copy', audio: 'copy' },
  remux: { video: 'copy', audio: 'copy' },
  transcode: { video: 'transcode', audio: 'transcode' },
};

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
 * on this platform where the difference can show. It is also the reason this
 * whole component is wanted during the 5.1 measurement rather than after it.
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
 * A reasonable default produces a plausible instruction, which is how three
 * separate fields could be declared, consumed and populated by nobody without
 * anything ever looking wrong. This client intends to wire all of them, so
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
