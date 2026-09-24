/**
 * Whether expo-video's error says *this set's decoder* failed.
 *
 * A decoder failure follows the file to every node, so it is never node
 * evidence. Core (its `e840d72`) answers `media` and `unsupported` by asking
 * the same node for a transcode, once per playback. Reported as `unknown`, it
 * checks the session instead, finds it alive and moves node: measured on `.133`
 * 2026-09-24, *Classroom 216* sat at 0:00 on another address of the same
 * machine.
 *
 * **Read from a sentence because that is all expo-video passes.** Android's
 * `PlaybackError` is "A playback exception has occurred: " plus ExoPlayer's
 * message and its cause's; the error code does not cross (read in
 * `expo-video` `android/.../records/PlaybackError.kt`). ExoPlayer names a
 * renderer failure `<Renderer> error, index=…, format=…, format_supported=…`
 * (the line `.133` logged). The split mirrors `PlayerEngine.kt`'s
 * `platformKindOf`, which has the real codes: a decoder that would not take
 * the format is `unsupported`, one that took it and then failed is `media`.
 * A platform matter, so it stays here.
 */
export function decoderFailureKind(message: string): 'media' | 'unsupported' | undefined {
  if (/Decoder init failed|format_supported=NO\b/.test(message)) return 'unsupported';
  if (/\b\w+Renderer error, index=/.test(message)) return 'media';
  return undefined;
}
