import { describe, expect, it } from 'vitest';
import { decoderFailureKind } from './playerErrorKind';

/**
 * expo-video hands JS only a sentence: "A playback exception has occurred: "
 * then ExoPlayer's message and its cause's (`expo-video`
 * `records/PlaybackError.kt`). The renderer message below is the one `.133`
 * logged on 2026-09-24 for *Classroom 216* (AVI, MPEG-4 Part 2), where the
 * failure reached core as `unknown`, was read as node evidence, and moved node.
 */
const PREFIX = 'A playback exception has occurred: ';

describe('decoderFailureKind', () => {
  it('reads a renderer failure as media, the kind core falls back to transcode on', () => {
    expect(decoderFailureKind(
      `${PREFIX}MediaCodecVideoRenderer error, index=0, format=Format(0, null, null, video/mp4v-es, null, -1, null, [624, 352, -1.0, null], [-1, -1]), format_supported=YES Error 0x80001009`,
    )).toBe('media');
    expect(decoderFailureKind(`${PREFIX}MediaCodecAudioRenderer error, index=1, format=Format(1), format_supported=YES `)).toBe('media');
  });

  it('reads a decoder that refused the format as unsupported, as PlayerEngine.kt does', () => {
    expect(decoderFailureKind(`${PREFIX}MediaCodecVideoRenderer error, index=0, format=Format(0), format_supported=NO `)).toBe('unsupported');
    expect(decoderFailureKind(`${PREFIX}Source error Decoder init failed: OMX.realtek.video.decoder, Format(0)`)).toBe('unsupported');
  });

  it('leaves anything else to the node probe', () => {
    expect(decoderFailureKind(`${PREFIX}Source error Response code: 404`)).toBeUndefined();
    expect(decoderFailureKind('Playback failed')).toBeUndefined();
  });
});
