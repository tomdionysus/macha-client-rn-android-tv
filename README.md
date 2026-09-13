# macha-client-rn-tv

The Macha client for **Android TV** — React Native, leanback, D-pad only.

It reproduces the appearance and D-pad behaviour of the WebView TV interface in
[`macha-client`](../macha-client), though not yet all of its screens — nine of
that client's twenty-eight routes, with a tenth only half-built. There is no
music, search, status or endpoint editing here yet; ingest and the sponsor page
are deliberately not planned for a television.

Everything that is not presentation is shared with the other clients through
[`@macha/core`](../macha-ts), and the remaining gap is almost entirely
presentation: core already ships the search, music, status and alphabet-index
logic those screens would sit on.
[`TODO/ACTIVE.md`](TODO/ACTIVE.md) §4 is the complete parity list.

> **Status: builds; not yet installed or run on the television.** The APK is
> produced and statically verified, and the hardware facts below were measured
> off the device and the cluster — but no screen has been rendered and nothing
> has been played. Treat behaviour as unproven. [`docs/HISTORY.md`](docs/HISTORY.md)
> distinguishes what was measured from what is merely asserted.

## Where this sits

Macha has four clients over one core. Two of them are televisions, which is the
distinction most easily got wrong:

| Repo | What it is | Owns |
| --- | --- | --- |
| `macha-ts` | `@macha/core` — API, cluster routing, playback coordination, client state | the shared brain |
| `macha-client` | React web client; also the **Samsung/Tizen** TV app | web + Samsung |
| `macha-client-rn` | React Native **phone** app | iOS/Android handsets |
| **`macha-client-rn-tv`** | **this** — React Native **Android TV** | the TCL set |

This is not the phone app, and the phone app's screens are not a reference for
it. This targets the 10-foot UI only — no touch, no gestures, no phone layouts —
and declares `android.software.leanback` as **required**, so the APK will not
install on a handset.

## Why it exists

**The React UI in a WebView is insufficient to properly play media on a
television.** That is the whole reason for this project, and it is not a
question of polish: a browser engine cannot reach the set's hardware decoders,
so anything it cannot decode itself must be converted by the node before it
arrives, and the channel layout is destroyed on the way.

The WebView host does render and does put a picture on screen. That is not the
same as playing the media properly, and the difference is audible rather than
visible.

Chromium ships no AC-3/E-AC-3 support whatever the panel is wired to, so the
node is forced to transcode 5.1 E-AC-3 into 5.1 AAC. Chromium then hands
AudioFlinger a six-channel track with an *index* channel mask rather than a
positional one, the mixer cannot fold it down, and the centre channel — the
dialogue — is lost.

The panel's own decoders are much wider than the browser's:

| | Platform decoders | Chromium reports |
| --- | --- | --- |
| Video | avc, hevc, vp8, vp9, av01, mpeg2, mp4v, dolby-vision | h264, vp8, vp9 |
| Audio | aac, **ac3**, **eac3**, **ac4**, mp3, mp2, flac, opus, vorbis, raw | aac, opus, vorbis, mp3, flac |

ExoPlayer can use those decoders and direct-play the original file, leaving the
television to perform its own downmix. **Whether that actually rescues the
dialogue is untested by anyone** — see [Open questions](#open-questions); it is
the hypothesis this client exists to try, not a result it has delivered.

**So the measure of this client is how little it transcodes.** Capabilities are
built from `MediaCodecList`, not a browser probe, and what was actually read off
the hardware is shown on the Settings screen — because the failure that matters
here is silent. A probe that under-reports means the node transcodes a library
that would have direct-played, the picture still works, and nothing prompts
anyone to look.

## Architecture

```
PlaybackRuntime ── PlaybackCoordinator ── ExoPlayerAdapter ── MachaPlayer ── ExoPlayer
   (@macha/core)       (@macha/core)        (src/player)      (modules/, Kotlin)
```

**Playback goes through `PlaybackCoordinator`.** Nothing here drives
`ClusterPlaybackResolver` directly. The coordinator is what provides node
failover, stall recovery, standby promotion and segment-container restatement;
a host gets all of it by handing over a `Player` and reimplementing none of it.

`ExoPlayerAdapter` implements that `Player` and nothing more. No playback
*policy* lives on the native side — which node, when to fail over, what
instruction to ask for are all core's decisions.

**The native module** (`modules/macha-player`, a local Expo module) owns only
what the platform can answer:

- capabilities from `MediaCodecList`, with HDR and Dolby Vision gated on the
  *display* agreeing as well as the decoder, since an over-claim is a black
  screen. Containers are curated — `MediaCodecList` says nothing about them.
- audio focus, held as `AUDIOFOCUS_GAIN` and yielded on loss;
- `FLAG_KEEP_SCREEN_ON`, or the set dims and sleeps through a film;
- failure classification into core's evidence kinds, so a decoder failure is not
  reported as a stream failure and retried around the whole cluster.

**Two faults reach core only because they are wired here.** ExoPlayer reports
real errors, but a source that delivers no bytes and a picture frozen with bytes
still arriving are not errors on any platform. Core's `MediaStartWatchdog` and
`MediaStallWatchdog` cover them and are deliberately *not* inside the
coordinator — each host wires its own. Without them `prepareAlternate` is
unreachable, since it is fed only by the optional `subscribeDegradation`.

**The player is `expo-video` for now** (Tom, 2026-09-10), not the native engine
in `modules/macha-player`. That engine is complete and has never been run, and
the shortest path to the 5.1 measurement this project exists to make is the
component the phone client has already proven. It is Media3 underneath, so the
hardware-decoder premise above is unaffected — but it builds its
`OkHttpDataSource.Factory` internally with no injection point, so seamless
failover is not available while it stands. `ExoPlayerAdapter` and
`PlayerEngine.kt` remain in the tree for the revisit.

**Capabilities did not move with it.** `expo-video` exposes no codec enumeration
at all, so `MediaCodecList` is still read through the native module. Answering
from a hardcoded list, as the phone client does, would make the node transcode
what the panel decodes natively — which is the failure this client exists to
prevent.

**Seamless failover is required, and not yet built here.** It already works in
`macha-client`, which implements core's `preflightSource` and
`addDirectSourceAlternative`; the client it is *not* possible in is the phone
one, where `expo-video` builds its `OkHttpDataSource.Factory` internally with no
injection point. `PlayerEngine.kt` builds its own and owns its `ExoPlayer`
instances, so the seam is here as well.

The cost that matters is not the one a cold recovery pays: a **warm standby** has
already paid the endpoint walk, and promotion itself is milliseconds, so player
priming is nearly all the remaining visible cost. Two ways to preflight are open
— port the web client's fetch-based validation, which allocates no decoder, or
prime a real second player, which proves decodability but needs a spare decoder
instance. Promotion becomes a surface handover rather than a reload either way.
See [`TODO/ACTIVE.md`](TODO/ACTIVE.md) §2.1.

**The focus model** (`src/hooks/tvFocus.ts`) is a port of the web client's
`useTvNavigation.ts`, scoring weights and all. Android's own focus engine would
also move focus, but it would move it *differently*, and the requirement is that
this client behaves like the web TV client. `tvFocus.test.ts` asserts the weights
so a divergence fails.

**The appearance** (`src/styles/theme.ts`) is ported from `macha-client`'s
`src/styles/base.css` and is the single source; every component cites the rule it
came from. The web client sets `html { font-size: 87.5% }`, so 1 rem is 14 px,
and Android TV's 1920×1080 dp grid matches the TV WebView's CSS px viewport — so
`rem()`/`vw()` reproduce the stylesheet rather than approximate it. CSS
gradients, coloured `box-shadow` glows and `mask-image` do not survive the port
and say so where they occur.

## Building

The target set is **`armeabi-v7a` only** — 32-bit ARM, no arm64. Check any new
native dependency ships it.

```sh
npm install                                    # .npmrc sets legacy-peer-deps
EXPO_TV=1 npx expo prebuild --platform android --clean
cd android && EXPO_TV=1 ./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a
```

`assembleRelease` embeds the JS bundle and signs with the debug keystore, so the
APK runs standalone with no Metro server.

Two things that will catch you:

- **`android/` is generated** by `expo prebuild` and is gitignored. Manifest
  changes belong in `plugins/withAndroidTvOnly.js` or they vanish on the next
  prebuild — and a plugin added without re-running prebuild silently does
  nothing.
- **`@macha/core` is a `file:` link and npm will not build it for you.** A stale
  `dist/` typechecks green and fails at runtime. `npm test` runs core's
  `dist:check` first to catch it; that check cannot see src that is ahead of its
  last build, so run `cd ../macha-ts && npm run build` after changing core.

## Checks

```sh
npm run typecheck
npm test                              # focus parity, timing-budget guards
npx expo export --platform android    # proves @macha/core bundles through Metro
```

The export is not redundant with the typecheck: it is what proves core's ESM
resolves through the RN bundler.

Timing budgets live in `src/player/timingBudgets.ts` and are guarded by tests
asserting *relationships*, not values — that a read deadline exceeds the server's
segment hold, for instance. One test reads the constant back out of
`PlayerEngine.kt`, so the TypeScript and Kotlin copies cannot drift apart
silently. Follow that pattern rather than pinning numbers.

## Open questions

Three things are unverified and want the television. All are recorded in
[`docs/HISTORY.md`](docs/HISTORY.md) with what is and is not known.

1. **Does the set fold down 5.1?** Core has no concept of speaker layout —
   `choosePlaybackInstruction` decides audio on codec alone and never reads
   `channels` — so a 5.1 E-AC-3 track is copied straight through and the downmix
   is the device's business. That is the intent, but there is an open report
   against core of exactly this going 5.1-into-stereo with no downmix. **If the
   set does not fold down, that is core's gap rather than this client's.**
2. **Does a promoted standby play *here*?** It does in `macha-client`, which
   implements the same core hooks. Unverified on this client, and now testable
   at all because the watchdogs make promotion reachable.
3. **Audio focus behaviour**, which is asserted from media3's contract and not
   yet confirmed on hardware.

## Further reading

- [`TODO/ACTIVE.md`](TODO/ACTIVE.md) — open work, highest first, and what is
  blocked on the television.
- [`TODO/COMPLETED.md`](TODO/COMPLETED.md) — what has landed, and the
  experiments and theories that did not survive.
- [`docs/HISTORY.md`](docs/HISTORY.md) — measurements with their provenance,
  decisions and why, and theories that did not survive contact.
- [`AGENTS.md`](AGENTS.md) — the working rules for changing this repo.
- `macha-ts/docs/writing-a-player.md` — the contracts behind `Player`, most of
  which are not visible in its type signature.
