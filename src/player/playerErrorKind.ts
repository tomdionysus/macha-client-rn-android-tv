/**
 * Whether expo-video's error says this set's decoder failed. Such a failure
 * follows the file to every node, so core must hear `media` or `unsupported`
 * (it retries the same node with a transcode) rather than `unknown` (it moves
 * node). expo-video passes only ExoPlayer's message, not its error code, so
 * this reads the sentence. Mirrors `platformKindOf` in `PlayerEngine.kt`: a
 * refused format is `unsupported`, a failure after accepting it is `media`.
 * ExoPlayer words a renderer failure `<Renderer> error, index=…, format=…,
 * format_supported=…` (measured on the TCL set). Platform, so not core's.
 */
export function decoderFailureKind(message: string): 'media' | 'unsupported' | undefined {
  if (/Decoder init failed|format_supported=NO\b/.test(message)) return 'unsupported';
  if (/\b\w+Renderer error, index=/.test(message)) return 'media';
  return undefined;
}
