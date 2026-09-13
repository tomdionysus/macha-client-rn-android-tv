# Completed

What has actually landed, and — following the phone client's convention —
**the experiments that failed and the theories that were withdrawn**, since
those are the entries that stop the next person repeating them.

Nothing here has been exercised on the television. "Done" means built,
typechecked, tested and statically verified; it does not mean observed working.

---

## It runs (2026-09-12) — the first execution, and what it cost

Installed on the TCL at `10.34.1.116:5555` and launched. Home rendered with real
artwork, the D-pad nav and platform badge drew correctly at 1920x1080, and the
client reached the cluster: `route-success` on `http://10.34.1.50:7438`, health
`reachable: 3, known: 5`, posters served from the node at 267x401. No crash, no
JS error, compositing at 60 fps.

**Three defects, none of which could have been found off-device**, and two of
which a *debug* build would have hidden completely:

- **The release APK could never have reached the cluster.** No
  `usesCleartextTraffic` in the release manifest against `targetSdk 34`, where
  the default is *denied* — and every Macha endpoint is `http://`. Expo writes
  `usesCleartextTraffic="true"` into the **debug** manifest only, so Metro
  works; the standalone release APK silently blocks every request. It presents
  as "Connecting…" forever, which looks exactly like a server or network fault,
  while the set pings the nodes perfectly. Fixed in `app.json` through
  `expo-build-properties`.
- **The 32-bit ARM pin had silently reverted** to a universal build —
  93 MB against 29 MB, carrying `arm64-v8a`, `x86` and `x86_64` to a set whose
  `abilist` is `armeabi-v7a,armeabi`. This file recorded the pin as *verified in
  the artifact* on 2026-09-10 and it was, but it lives in
  `android/gradle.properties`, which `expo prebuild` regenerates and
  `.gitignore` excludes. Now `plugins/withArmV7aOnly.js`.

  **That is the second setting lost the same way**, after the leanback flags
  that `withAndroidTvOnly` exists to defend. The rule this establishes:
  anything that must survive lives in `app.json` and a plugin, never in the
  generated tree — and "verified in the artifact" is only true of the artifact
  that was verified, not of the next build.
- **The television had moved to `.116`.** `.115` was silent because nothing is
  there, so the 2026-09-10 conclusion that the set was powered off was wrong.
  The site's cluster node is the control for "is the site reachable", not for
  which address the set holds.

## The D-pad works (2026-09-12/13) — two bugs, neither findable off-device

The client's entire interface is a D-pad, and **no remote key had ever reached
JavaScript**. Fixing it took two independent findings, the second only visible
once the first was fixed.

### One: React Native cannot deliver TV key events in a bridgeless build

Verified in `react-native-tvos@0.86.2-0`'s own Android source, not inferred:

- The app runs bridgeless (`newArchEnabled=true`). Key events go
  `ReactSurfaceView.dispatchJSKeyEvent` → `JSKeyDispatcher`, which dispatches
  view-level `KeyDownEvent`/`KeyUpEvent` and **never emits `onHWKeyEvent`**.
- `useTVEventHandler` listens for `onHWKeyEvent` **only**
  (`TVEventHandler.js:46`), emitted solely by `ReactAndroidHWInputDeviceHelper`,
  called only from the **legacy** `ReactRootView` and `ReactModalHostView`.
- The replacement path is doubly shut: `ReactNativeFeatureFlags.enableKeyEvents`
  defaults to **false**, and `JSKeyDispatcher.handleKeyEvent` opens with
  `if (focusedViewTag == View.NO_ID) return` — with no natively-focused view it
  discards everything. `Focusable` renders a plain `View` and never takes
  Android focus, so even with the flag on nothing would arrive.

**The fix is ours: `MachaTvInputModule.kt`**, a Kotlin bridge wrapping
`Window.Callback`. Same reasoning that keeps `Capabilities.kt` — own the native
seam where React Native's abstraction does not serve a television.

It wraps the window callback rather than overriding `dispatchKeyEvent` on
`MainActivity` because the activity is generated under `android/`, which a
prebuild regenerates. That is the third time this project has had to route
around generated-tree loss.

Two things fixed in passing:

- **The double-fire.** The legacy helper emitted on both `ACTION_DOWN` and
  `ACTION_UP`, and `useTvNavigation` never read `eventKeyAction` — so every
  press would have moved focus **twice** had that path ever run. The bridge
  emits on down only and consumes up.
- **Back moved to `BackHandler`**, which is a correctness fix rather than
  plumbing: `hardwareBackPress` is synchronous, so it can tell the platform
  whether the app consumed the press. A bridge emitting into JavaScript cannot
  answer in time, and guessing would either trap the viewer in the app or drop
  them out of it.

### Two: every measured rectangle was thrown away

Only visible once keys worked. The registry reported **`registered=46
measured=0`** while all 46 `measureInWindow` callbacks fired with correct
rectangles.

`measure()` delegated to `update()`, which returns silently for an unknown id —
right for an arbitrary patch, catastrophic for geometry. And the id was
**always** unknown, because registration lost a race it loses every time:
registration was a `useEffect`, a passive effect React defers, while Fabric
dispatches `onLayout` from native the moment layout commits.

**So the ported scorer had never once chosen a candidate on this device.** Every
move came from `sequentialCandidate` — registration order — which is exactly
what the set showed: Down from a nav item went *sideways* to the next nav item,
because that was next in mount order.

Three holes closed: `measure()` holds an early rectangle in `pendingRects`
rather than dropping it; `register()` preserves geometry **and order** across a
re-registration (it rebuilt the entry from scratch, so any prop change silently
dropped that element back to sequential navigation — the same bug a second
time); and registration is now a `useLayoutEffect` so it stops losing the race
at all.

**The existing 13 focus tests passed throughout**, because every one called
`register()` then `measure()` in the tidy order. Nothing exercised the order the
platform actually delivers, so a green suite sat on top of a focus model that
could not navigate. Five tests now encode the real order, two named for the
television's own symptom; reverting `measure()` fails them.

**Still unverified on hardware** — the fix was committed after the link to the
site dropped. `ACTIVE.md` §1.1.

## Alphabet jump (2026-09-13)

`AlphabetIndex` + `useAlphabetIndex`, which §4.3 names as the component that
matters most on this platform: a pointer makes a long library a scrollbar drag,
a remote makes it one focus step per card.

Core owns the bucketing, ordering and folding — `alphabetIndexKey` knows about
leading articles, combining marks and numeric titles. Nothing is re-derived.

**It parts company with the web client in the way that matters on a
television.** There, jumping calls `scrollIntoView` and stops. Here it moves
*focus* to the first title in the bucket and lets the library's existing
scroll-on-focus do the revealing — because scrolling without moving focus would
leave the next D-pad press scrolling straight back, so the jump would appear to
undo itself. Letters with nothing behind them are unfocusable, so the D-pad
skips them rather than making the viewer press through dead entries.

That is why focusables can now be addressed by a stable id: the strip has to
select a specific card by name.

## Versioning, branching and install verification (2026-09-13)

**`versionCode` is the only number Android compares.** It ignores `versionName`
entirely, so two builds sharing a code are the same build to the package
manager. Nothing set `android.versionCode`, so every APK this client ever built
shipped the Expo default of **1**.

Five genuinely different builds went onto the television in one afternoon —
native key bridge, focus fix, three instrumented variants — and the device could
not tell them apart. `install -r` hid it completely. The install was never the
risk: the risk was that the whole session was on-device debugging, and a build
that silently failed to replace would have had someone reading new source while
watching old bytecode, with no signal on either end.

Raised by the phone client, which hit the same thing. Its derivation adopted
unchanged so both Android clients read alike:

    major * 10000 + minor * 100 + patch        0.1.0 -> 100

Enforced by `npm run version:check` from `pretest`. Both failure modes — absent,
and stale at 1 — were confirmed to fail the check before it was wired in.

**`verify-on-device.sh install` now asserts what landed**, comparing
`versionCode` and `versionName` from `dumpsys` against what the APK declares,
refusing to remove anything and telling the operator not to debug against the
install when they disagree. The technique is the phone client's; comparing
against the artifact is the stronger form, since it catches a stale APK as well
as a failed replace.

**Branching convention adopted** (Tom, project-wide, relayed by the phone
client): work on `develop`, releases tagged on `main`, tags bare annotated
semver, version bump inside the release commit, and **never name a branch after
a version**. This repo had already made that mistake — `0.2.0` renamed to
`develop` hours after creating it. Recorded in `AGENTS.md`.

`0.1.0` is tagged at the commit that shipped `versionCode 1`, and the tag body
says so. The tag records what ran on the television; correcting it retroactively
would make it a lie. The phone client amended theirs instead, correctly — theirs
had never been built from, so there was nothing to preserve.

## Decisions taken

- **Focus-scoring duplication (Tom, 2026-09-12): accept it. No `@macha/tv`.**
  The two scorers were compared that day and are identical line for line —
  `../macha-client/src/hooks/useTvNavigation.ts:87-108` against
  `src/hooks/tvFocus.ts:71-95`: same `±1` deadzone, same `secondary * 0.2`, same
  `laneGap * 6`, matching `sequentialCandidate`. **The asymmetry to know:** all
  three constants are pinned by named tests here, but the web client's
  `scoreTvCandidate` is module-private and not directly unit-tested, so a drift
  is loud on this side and quiet on theirs — **this repo's tests are the shared
  guard**. Revisit if a third TV surface appears or the weights need to diverge
  per platform.
- **This is now a git repository** (2026-09-13), pushed to
  `git@github.com:tomdionysus/macha-client-rn-android-tv.git`. Visibility
  unconfirmed — see `ACTIVE.md` §3.2, which matters because the site session has
  published that this repo is not fetchable.

## Project and build

- **Scaffolded as an Android TV app**, not a phone app that tolerates a TV:
  Expo + `react-native-tvos` 0.86.2-0, leanback launcher, TV banner, landscape.
- **Made TV-only explicitly.** `config-tv` emits `leanback required="false"`,
  which permits phone installs; `plugins/withAndroidTvOnly.js` overrides it to
  `required="true"` with touchscreen/faketouch not required. **Verified in the
  artifact** with `aapt2 dump badging`, not in the source manifest — see the
  failure below for why that distinction was learned the hard way.
- **Pinned to `armeabi-v7a`** because the target set is 32-bit ARM only, with
  the APK confirmed to contain `native-code: 'armeabi-v7a'`.
- **Standalone release APK** — JS embedded, signed with the debug keystore, so
  it runs with no Metro server.
- **Checks**: typecheck, 30 tests, and `expo export` proving `@macha/core`'s ESM
  resolves through the RN bundler — which typechecking cannot tell you.

## Native player (`modules/macha-player`, Kotlin/Media3)

- **Capabilities from `MediaCodecList`**, not a browser probe. HDR and Dolby
  Vision gated on the *display* agreeing as well as the decoder, since an
  over-claim is a black screen. Containers curated, because `MediaCodecList`
  says nothing about them.
- **Audio focus** delegated to media3 (`handleAudioFocus = true`) rather than
  handled by hand. The intent is that ducking stays an internal multiplier that
  cannot compound, unlike `expo-video`'s handler — but that is media3's
  documented behaviour, **not something observed here**; confirming it is
  §1.5 of `ACTIVE.md`.
- **`FLAG_KEEP_SCREEN_ON`**, which the WebView client never had — a CPU wake
  lock alone does not stop a set dimming through a film.
- **Hold-aware loading**: a `500` retried on the same node with exponential
  backoff, because failing over cannot help a fragment that no other node has.
- **Main-looper marshalling inside the engine**, since Expo's synchronous
  `Function` has no `runOnQueue`.

## Core integration

- **Playback goes through `PlaybackCoordinator`** via `PlaybackRuntime`.
  `ClusterPlaybackResolver` is never touched. This and `macha-client` (which is
  both the web client and the Samsung TV app) go through the coordinator; the
  phone client does not, so coordinator-internal fixes reach two of the three
  codebases and silently miss one.
- **`MediaStartWatchdog` and `MediaStallWatchdog` wired.** Until this,
  `prepareAlternate` was unreachable — it is fed only by the optional
  `subscribeDegradation` — so the entire failover apparatus was present with
  nothing able to trigger it. ExoPlayer raises no error for a frozen picture.
  **Wired, never fired**: no watchdog has triggered on hardware.
- **`terminateForPageExit()` on AppState `background`**, deliberately not
  `inactive`, which is transient on Android. With `max_video_transcodes: 1` a
  leaked session costs the *next* viewer a 429.
- **Async storage bridged to core's synchronous `StorageLike`** — hydrate once,
  read from memory, write through a serialized chain so two writes to one key
  cannot land out of order.

## Seamless failover, Tier 1 — `preflightSource` (2026-09-12)

`src/player/preflight.ts` + 27 tests. Core calls it before accepting a warm
standby and destroys the standby when it returns `false`, so the module's one
invariant is that **`false` is a finding, never an inability to tell.**

**A re-implementation, not a port**, and both reasons are platform differences
that would have failed silently:

- **React Native's `URL` cannot resolve a relative reference.**
  `Libraries/Blob/URL.js:112-121` strips one trailing slash off the base and
  concatenates, so `.../abc/index.m3u8` + `seg1.m4s` gives
  `.../index.m3u8seg1.m4s`. HLS playlists carry relative URIs as standard, so
  every media target would 404, every preflight would answer `false`, and **every
  warm standby would be destroyed** — the web client's Tizen failure reproduced
  by a different mechanism. Replaced with an RFC 3986 §5.3 resolver, checked
  case-by-case against Node's WHATWG `URL`: 17 of 17 identical.
- **React Native's `fetch` ignores the `cache` option**, so the web version's
  `cache: 'no-store'` is a no-op here and a cached manifest could let a dead
  node pass its own preflight. Stated as request headers instead. Explicitly
  *not* a cache-busting query parameter, which would alter a signed capability
  URL.

One deliberate divergence in behaviour: a **non-manifest source answers `true`**
where the web client answers `false`. In a browser every non-`direct` mode is
HLS so the two never differ, but core states `isManifest` on the source rather
than deriving it from the mode (`types.ts:265` says not to infer it), and the
coordinator is explicit that a transport preflight "must never gate creation of
that standby". A source this walk cannot assess is not one it has judged.

## Seamless failover, Tier 2 — the warm standby (2026-09-12)

A second `VideoPlayer`, primed when `preflightSource` finds the node serving and
promoted when core calls `play()` with that source. 18 tests.

- **Promotion is recognised by URL**, because that is all core offers: there is
  no promotion hook, a promotion simply arrives as an ordinary `play()`
  carrying the source we were asked to preflight.
- **The standby is muted and never started.** Starting it would make it compete
  for audio focus behind the active source.
- **Promotion hands the surface over** — the promoted player is never told to
  `replace`, which is the whole point: it has already buffered, and promotion
  itself was measured at 3 ms against buffering that costs seconds.
- **A standby is released on `stop()` and `detach()`**, because it holds a
  session against `max_video_transcodes: 1` and a leaked one costs the next
  viewer a 429.

**The one design point worth keeping:** the player a promotion replaces is
*retired*, not released. The swap notifies presentation through a React state
update, and React commits after the current task — so releasing inside the swap
destroys a player the mounted `VideoView` is still rendering. Presentation calls
`releaseRetiredPlayer()` from an effect keyed on the player instance, which by
definition runs after commit. A test asserts the replaced player is **still
alive** immediately after promotion, which is the inverse of what the first
version of these tests asserted.

## Phase 0 foundations (2026-09-12)

**A suspend for the focus registry** (`tvFocus.suspend()`), the blocker §4.1
named as the first thing Search needs. Reference-counted with an opaque token,
so a menu opened over a search field nests and resumes independently and no
caller can lift another's suspension. While suspended `handle()` refuses every
command *including* notifying command observers — waking the player chrome on a
keystroke meant for the platform keyboard would be as wrong as moving focus
behind it — and `useTvNavigation` stands down entirely, since Back belongs to
the IME and the transport keys would otherwise act on playback nobody can see.
Distinct from a scope: a scope narrows what is reachable, this makes nothing
reachable and leaves selection exactly where it was.

**`LazyArtwork` + `artworkSources`**, with the plan logic split from the
component so it tests without dragging in the Expo runtime. Two behaviours that
are worse on a television than on a desktop, because a library screen here is a
grid of posters over wifi that gets re-entered constantly:

- **Node failover on a refused image.** Artwork is content-addressed, so any
  node holding it will do; one node failing should not cost the viewer the
  image. URLs needing an `Authorization` header are dropped rather than left to
  401, since an `Image` source cannot carry one.
- **A memory of the URL that actually loaded.** The server re-signs a capability
  URL on every catalogue fetch even when the image has not changed
  (`types.ts:9-15`). `expo-image` caches by URL, so handing it each fresh
  signature churns the cache key itself and re-downloads every poster already on
  screen. This was happening on every refresh before today.

## Given back to core

Under Tom's rule that shared, dependency-free functionality belongs in core with
every client refactored onto it:

| Moved | Now imported from core |
| --- | --- |
| `SERVER_SEGMENT_HOLD_MS` | had been three copies unable to see each other; `MEDIA_STALL_TIMEOUT_MS` is now expressed against it |
| `playbackFailureKindForStatus` | protocol, not platform — native reports the raw status, the adapter applies core's rule |
| `checkPlatformSurface` | core declares the surface, so core ships its check |
| `formatPlaybackTime` | common formatting |

## Interface

- **Appearance ported from `base.css`** through one theme module, with each
  component citing the rule it came from. `html { font-size: 87.5% }` makes
  1 rem = 14 px, and Android TV's 1920×1080 dp grid matches the TV WebView's CSS
  px viewport, so `rem()`/`vw()` reproduce the stylesheet rather than approximate
  it.
- **D-pad focus model ported** from `useTvNavigation.ts`, weights and all, with
  tests pinning them. Scope stacking reproduces the web client restricting
  selection to visible player chrome.
- **Screens**: Home with Continue Watching, Movies and TV Shows grids,
  series → season → episode with a back stack, movie detail, player, settings.
- **Settings shows what was read off the hardware**, because the worst failure
  here is silent: an under-reporting probe means the node transcodes a library
  that would have direct-played and nothing prompts anyone to look.

What is *not* built — search, music, status, endpoint editing, player options,
volume, queue — is enumerated in [`ACTIVE.md`](ACTIVE.md) §2 and §4 rather than
implied by omission here.

## Measurements taken

- **Decoder inventory** off the TCL set: ac3, eac3, ac4, hevc, av01 and more
  present, against Chromium's `aac, opus, vorbis, mp3, flac`.
- **`armeabi-v7a` only** — not in the brief, and easy to miss.
- **Cluster node facts** (`pipeline_idle_ms: 60000`, `max_video_transcodes: 1`,
  libav 7.1.5, no ffmpeg/ffprobe), which validated core's 30 s standby window as
  half the reclaim interval rather than merely plausible.

---

## Failed, withdrawn, or got wrong

Kept deliberately.

### Reported a core defect that did not exist

Reported `PlaybackRuntime.attach` as taking an `HTMLElement`. True of the built
`dist/`, false of core's source — it had already been widened to `PlaybackHost`.
The general trap survives: `dist:check` catches `dist` behind `src`, and nothing
catches `src` ahead of its last build. It caught three sessions in one day.

### Shipped two APKs that would install on a phone

Wrote the TV-only config plugin, added it to `app.json`, and did not re-run
`expo prebuild` — so `android/` was generated before the plugin existed and the
manifest still said `leanback required="false"`. **Verify the artifact, not the
source.** This is now how the manifest is checked.

### Let a peer revise the project's purpose

A peer reported that the WebView APK "plays" on the TCL set, and the README was
rewritten to open *"Not because Android TV is unsupported — it works."* That is
wrong on its own terms: rendering a UI and showing a picture is not properly
playing media. Reverted. Peer sessions supply evidence, not remit.

The same error had already happened in the opposite direction — relaying a
peer's blanket "Android DOESN'T work" to Tom as fact, and having to retract it.
Both were repeating instead of measuring.

### Uninstalled before installing, and lost the device mid-operation

Ran `uninstall` then `install` against a set on an unreliable link. The device
dropped between them, leaving the outcome unknown and possibly a television with
no Macha app. The two packages have **different ids and can coexist**, so there
was never a reason to remove first. The script now installs, verifies, then
removes — and refuses to remove anything if the install did not land.

### A probe whose failure mode was a false alarm

The platform-surface probe's `once` check needed a second dispatch, which needs
`Event` and `dispatchEvent` — neither in core's declared surface, neither
guaranteed on Hermes. Their absence threw into the catch and reported a
**required** member as absent. A required member wrongly marked absent is the
worst output a probe can produce. Fixed before handing it over, with a test that
manufactures the hostile host.

### Proposed something core was right to refuse

D-pad focus scoring, proposed for core, turned down because core's scope is
"everything a client does that is not presentation". Withdrawn: a boundary that
bends for a good-enough case stops being able to answer the question at all. The
duplication it was meant to solve is real and still open in `ACTIVE.md`.

### Claimed seamless failover was ours alone, without looking

`ACTIVE.md` §2.1 said "this client is the only one that can do it", and §2.2 said
a promoted standby was "unverified on **any** client". Both false: `macha-client`
implements `preflightSource` and `addDirectSourceAlternative`
(`src/platform/WebPlatform.ts:689` and `:685`) and it works on the Samsung set.
The claim was reasoned entirely from what `expo-video` cannot do — true about the
*phone* client, then generalised to every peer without opening one.

The inversion of the earlier lesson. "Peer sessions supply evidence, not remit"
guards against letting a peer rewrite the purpose; it is not licence to skip
reading them. Uniqueness is a claim about other codebases and cannot be
established from inside this one.

It cost real design work, too: the second-`ExoPlayer` preflight was invented
here and made to depend on §1.3's decoder-instance limit, when the working
implementation validates by fetching the first 64 KB and allocates no decoder at
all.

### Inherited a wrong diagnosis and disproved it by measuring

The phone client explained a dead warm standby as the node reclaiming its
pipeline after ~60 s idle. Measuring `pipeline_idle_ms: 60000` against core's
30 s expiry showed a 2× margin — and their own figure disproved it more simply,
since a standby promoted after **3 ms** cannot have aged into anything. Report
withdrawn; the cause remains unknown and is in `ACTIVE.md`.

### Declared seamless failover impossible on `expo-video`, from the wrong layer

**The fourth wrong claim about the same feature**, and the one that came closest
to doing damage: it had been written into `ACTIVE.md` §2.0, §2.1 and §2.4 as
settled, and was repeated to Tom on 2026-09-12 as a permanent gap in parity —
"no amount of screen work closes it". The reply was that seamless failover is
the literal reason this repo exists and is not negotiable, which is correct.

The evidence was real and the inference was not. `expo-video` does build its
`OkHttpDataSource.Factory` internally (`utils/DataSourceUtils.kt:19-45`, a
top-level function making a fresh `OkHttpClient`) with no injection point — that
much was verified and still holds. The mistake was concluding from the
**data-source layer** that handover was impossible at the **player layer**.

Reading the `expo-video` Android source settles it the other way:

- `createVideoPlayer` is exported; a second `VideoPlayer` is first-class.
- `VideoView.videoPlayer`'s setter (`VideoView.kt:125-145`) checks
  `hasSentFirstFrameForCurrentMediaItem` on the **incoming** player and sets
  `shouldHideSurfaceView = !hasEmittedFirstFrame`. A pre-warmed player swaps in
  with the shutter open.
- `onSourceChanged` (`VideoView.kt:290-299`) closes the shutter *only* for a
  replacement on the same player, citing expo issue #44385. The two cases are
  separated deliberately.

The lesson is narrower than "read the peer" and worth stating separately: **a
verified fact about one layer is not a conclusion about the layer above it.**
The transport was inspected, the view was not, and three sections were written
as settled on the strength of the half that was looked at.

It also contradicted itself in plain sight — §2.4 called `preflightSource`
unimplementable while §2.1, on the same page, said porting the fetch preflight
was "unblocked either way". A document disagreeing with itself is a signal that
one half was reasoned rather than read.

### Claimed typecheck passed while it did not

`COMPLETED.md` listed "typecheck, 15 tests" among the checks that hold. On
2026-09-12 the tests were 30, not 15, and **`tsc` was failing** on
`ExpoVideoAdapter.test.ts:158`: a hand-narrowed `{ forwardBufferMs: number }[]`
collecting `PlaybackEvent`, whose `forwardBufferMs` is optional because a
platform that cannot measure buffering omits it — the very distinction that test
was written to check. Both fixed.

It surfaced only because core landed playback fixes and the typecheck was run to
see whether they had broken anything. They had not — core's `types.ts` diff is a
doc comment — **and the check that was supposed to prove that had been broken
here for some time.** A test suite that runs green while `tsc` fails is the
reason the two are listed separately in this file; running one and reporting
both is how the claim got made.
