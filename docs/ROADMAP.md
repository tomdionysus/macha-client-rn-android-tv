# Roadmap

Work this client should do and has deliberately not done. Each entry says what
is known (measured or asserted) and what it needs before it can be verified.

## Audio passthrough

**Status:** latent. Not verifiable on either set we have.

Capabilities come from `MediaCodecList`
(`modules/macha-player/.../Capabilities.kt`), which answers "can this device
decode it". A set that passes AC-3 or E-AC-3 to a receiver or soundbar over
HDMI/ARC lists no decoder for them and plays them in 5.1. On such a set this
client would stop claiming `ac3`, the node would transcode to AAC, and the
viewer would lose multichannel with nothing visibly broken.

Both TCL sets have real AC-3 and E-AC-3 decoders (measured), so the claim is
correct on them and the passthrough path cannot be exercised there.

A solution:

1. Claim a codec if a decoder exists **or** passthrough is supported
   (`AudioTrack.isDirectPlaybackSupported`, or media3's `AudioCapabilities`,
   present in the linked media3 1.9.0).
2. Respect `Settings.Global.ENCODED_SURROUND_OUTPUT`: it is the viewer's stated
   intent and outranks a probe.
3. Offer an override in Settings, because EDID is often wrong.
4. Recompute when the audio route changes (`AudioCapabilitiesReceiver`).

Point 4 makes capabilities mutable at runtime; today they are read once.
Whether to re-resolve playback when the chain changes, or accept a stale claim
until the next play, is undecided and is core's question as much as ours.

**Needs:** a set with a receiver or soundbar on its HDMI chain for points 3 and
4. Points 1 and 2 can be tested on the TCLs.

## Delivery claims nothing checks

**Status:** live. Testable here.

`MachaPlayerModule.kt`'s `capabilities()` reads decoders from the device but
states six things outright: the container list, `hlsFmp4`, `hlsTs`,
`hlsVideoCodecs` (`h264`, `hevc`), `hlsAudioCodecs` (`aac`) and `dash`. Each is
a claim about what the linked media3 does, and a media3 or `expo-video` upgrade
can change the truth without changing the file. The failure is a node
transcoding what it need not, or a viewer with no audio.

Android has no runtime probe for container or delivery support, so the fix is a
test, not a probe:

1. Assert the claims against `DefaultExtractorsFactory` and the HLS extractor
   factory of the linked media3, in a test naming the version it was calibrated
   against. The effective version is the highest any module requests: 1.9.0,
   read from `android/app/build/outputs/sdk-dependencies/release/sdkDependencies.txt`.
2. Settle `dash: true` first. Nobody has confirmed the DASH module is reachable
   through `expo-video`.

## Timestamps

**Status:** not yet applicable. This client renders no wall-clock time; the
failure trail shows elapsed time only. Core's log entries carry an ISO
timestamp that `failureTrail.ts` does not draw.

When a timestamp is first shown, the rule across Macha is:

- On screen: the viewer's zone, labelled, for example
  `21 Sep 2026, 18:51:52 GMT+3`.
- Everywhere else: epoch ms in data, Zulu in strings.
- A time never stated renders as a dash, not 1970.
- Take the instant from the API, not the device clock: a set in a rack can be
  hours wrong with nobody to notice.
