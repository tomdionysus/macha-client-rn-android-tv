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

/*
 * `MODE_TRANSFORMS` lived here and has been **deleted**, not moved to core.
 *
 * It restated `video`/`audio` alongside `mode` on every mode press, justified
 * by a comment carried over from the web client: that the session keeps the
 * previous instruction's per-stream transforms, so a bare mode is judged
 * against them and refused as contradictory.
 *
 * **That was inherited, not observed.** This client never sent such a PATCH and
 * never saw the refusal. Two independent readings say the guard is unnecessary:
 * core investigated it at server 0.34.0 and concluded the fields should be left
 * to clear, and the server session has since confirmed against 0.39.1 that
 * `parse_preferences` resets `video`, `audio`, `max_height` and `max_bitrate`
 * the moment `mode` is named, before reading the rest of the object. The
 * contradiction it guarded against cannot be assembled.
 *
 * The stronger reason to delete rather than keep it harmlessly: it **asserted
 * what a mode implies per stream**, and that is the server's judgement, not
 * ours. `remux` was mapped to `audio: 'copy'`, but a remux can repackage the
 * container while still transcoding audio — and whether audio was copied or
 * transcoded is the exact question this project exists to measure. A panel
 * built to expose the 5.1 decision must not quietly pre-state it.
 *
 * A mode press now sends `{ mode }` alone and lets the server re-derive. If a
 * refusal ever appears, capture the body, status and `code` — the server
 * session wants them, and it would be a genuine regression rather than a
 * reason to restore this.
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
