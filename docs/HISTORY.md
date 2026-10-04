# History

What was measured, what was decided and why, and which theories failed. Read
it before re-running an experiment. "Measured" means read off a device or a
node; "asserted" means taken from an implementation or a contract. The
day-by-day record is in [`../TODO/COMPLETED.md`](../TODO/COMPLETED.md).

## Why this client exists

The web client in a WebView renders and plays, but Chromium cannot reach the
set's decoders. Measured on the TCL 55B6B:

| | Platform decoders | Chromium |
| --- | --- | --- |
| Video | avc, hevc, vp8, vp9, av01, mpeg2, mp4v, dolby-vision | h264, vp8, vp9 |
| Audio | aac, ac3, eac3, ac4, mp3, mp2, flac, opus, vorbis, raw | aac, opus, vorbis, mp3, flac |

So for the WebView the node transcodes E-AC-3 to AAC, and Chromium hands
AudioFlinger six channels with an index mask (`0x8000003F`) that the mixer
cannot fold down: dialogue is lost. This client direct-plays the file, and 5.1
reaches AudioTrack as six channels with a positional mask (`0x0000003F`,
measured).

A peer client's report is evidence to verify, never a change to this client's
purpose.

## The sets

- Both TCL sets are `armeabi-v7a` only, `leanback_only`, with no touchscreen
  (measured). Every build is pinned to that ABI.
- Both have real AC-3 and E-AC-3 decoders (measured).

## Timing budgets

A node holds a request for a fragment it has not produced for 6000 ms
(`SERVER_SEGMENT_HOLD_MS`), then answers `500 segment_not_ready`. That is the
node working correctly: it is reported to core as `not-ready` and retried on
the same node.

| Budget | Value | Calibrated against |
| --- | --- | --- |
| `readTimeoutMs` (`PlayerEngine.kt`) | 15000 | The 6000 ms hold: a deadline below it reports a working node as a network fault. |
| Hold retry backoff | 1000 to 8000 | The same hold. |
| `MEDIA_STALL_TIMEOUT_MS` (core) | hold + 1000 | The same hold, from core's side. |
| `CHROME_HIDE_MS` | 4000 | Nothing on the wire: long enough to read the status line. |
| `SCRUB_COMMIT_MS` | 400 | The remote's auto-repeat (60 to 100 ms), so a long hold costs one seek. |

Decisions:

- **A node's stated deadline is taken whole, even when shorter than ours.**
  Core owns when to stop; of two deadlines the shorter silently wins and the
  other layer looks broken. The local constant is only for a node that states
  none.
- **Tests assert relationships, not values**, and read the Kotlin copy out of
  the source. A test pinning `15000` fails on every deliberate retune; a test
  pinning "must clear the hold" fails only when the retune is wrong.

## Playback decisions

- **A `404` is `not-found`, not evidence against the node.** A reaped session
  and a fragment past the end of a plan answer identically. An adapter
  reporting `not-found` must keep its presentation up: the buffer covers the
  replacement core builds.
- **Ask the node what the loader asked**, not whether the session is alive: a
  live session does not prove a fragment is servable.
- **Latch the status where it is seen; never classify from an error message.**
  `expo-video`'s `PlayerError` carries only a message.
- **The floor for an unmapped failure is `unknown`.** A false `not-found` stops
  recovery; a false `unknown` only prepares a standby.
- **A fatal error raised while paused is parked** and met again on resume. A
  paused session is reaped after 30 minutes (`SERVER_SESSION_IDLE_MS`), which
  on a television is ordinary. `expo-video` owns its loader, so a parked source
  is re-attached and the held frame blanks briefly.
- **The readiness probe's budget is the runway less core's replacement lead
  time**, floored at one transport allowance, and the runway is the last figure
  carried less the time since.
- **A standby against a transcode holds that node's only transcode slot**
  (`max_video_transcodes: 1`, measured), so prepare late rather than eagerly.
- **Background means stop.** A session left open costs the next viewer a 429.

All of the recovery behaviour above is asserted. On the set, failover has run
twice; standby promotion, the park and the probe have not been seen to act.

## Theories that failed

- **"`PlaybackRuntime.attach` takes an `HTMLElement`."** True of a stale
  `dist`, false of core's source. Core's `dist` can lag `src`; check the built
  artifact.
- **"Warm standbys die by aging out."** A standby promoted after 3 ms cannot
  have aged. The report came from a client that bypassed the coordinator; its
  cause is unknown.
- **"`expo-video` rules out seamless failover."** Handover is not in the
  transport: a second `VideoPlayer` can be primed and promoted. It does cost
  per-request control and HTTP status reporting.
- **"Seamless failover is not worth building here."** That conclusion was the
  phone client's, for a player that cannot prime a second instance. Cold
  recovery and warm promotion are different costs; do not import a peer's
  constraint.

## Given to core

`SERVER_SEGMENT_HOLD_MS`, `playbackFailureKindForStatus`,
`checkPlatformSurface`, `formatPlaybackTime` and `availableToPlay` started here
and live in core.

- **Refused:** D-pad focus scoring. Geometry deciding what a viewer looks at is
  presentation, so the two TV clients each carry the scorer, with tests pinning
  the weights.
- **Cannot move:** media3's `LoadErrorHandlingPolicy` decides retries on a
  thread that cannot call JavaScript, so "500 means hold" exists in Kotlin too.
  `timingBudgets.test.ts` reads it from `PlayerEngine.kt` and checks it against
  core.

## Build lessons

- A config plugin added after `prebuild` does nothing. Verify the APK with
  `aapt2 dump badging`, not the source manifest.
- `expo-module-gradle-plugin` wires Kotlin and publishing itself; applying
  them by hand fails with "SoftwareComponent with name 'release' not found".
  It also requires `versionName` in `defaultConfig`.
- A synchronous Expo `Function` has no `runOnQueue`; `PlayerEngine` marshals
  onto ExoPlayer's looper itself.
- `react-native-tvos` publishes prereleases, which fail plain semver peer
  ranges; `legacy-peer-deps` is the fork's documented install mode.
- Media3 is declared by this repo's module and by `expo-video` at different
  versions; Gradle resolves to the highest (1.9.0).

## Standing unknowns

1. **Whether the set's own downmix of 5.1 sounds right.** The channels arrive
   correctly; the stereo A/B needs a listener (`TODO/ACTIVE.md` §1.8).
2. **Standby promotion:** provoke a stall and see whether the promoted session
   plays.
3. **Audio focus:** asserted from media3's contract, not confirmed on hardware.
4. **What Media3 puts on the wire.** This client originates no header (read
   from source); capture a fragment request to confirm
   (`scripts/verify-on-device.sh headers`).
