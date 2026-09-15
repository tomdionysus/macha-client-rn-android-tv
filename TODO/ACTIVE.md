# Active

Open work on the Macha Android TV client. What has landed is in
[`COMPLETED.md`](COMPLETED.md), **including the mistakes** — read those before
re-deriving anything. Reasoning lives in [`../docs/HISTORY.md`](../docs/HISTORY.md);
conventions and traps live in [`../AGENTS.md`](../AGENTS.md).

---

## 0. Where this stands

**It works.** 0.3.3 is on the TCL, installed and version-asserted. The remote
navigates it, `tvtest` signs in through the platform IME, the library and
detail screens render, and a film direct-plays with 5.1 intact. Tom confirmed
the remote on 2026-09-13.

**§1.2 is answered and the premise holds** — `matroska / direct / video copy /
audio copy`, six channels, positional `0x0000003F`. Full reading and its two
stated limits in [`COMPLETED.md`](COMPLETED.md) and §1.2 below.

**Still never exercised: failover.** No watchdog has fired and no standby has
been promoted on this set. Every failover claim in this file remains unproven,
which is the largest block of untested behaviour left.

### The single next action

**Fix the Settings scroll fault (§1.1).** It is small, and it unblocks
everything diagnostic: the on-screen failure trail is built and shipped and
*cannot be switched on*, because its toggle sits below the fold where focus
lands invisibly and the page never scrolls. Every open question below — a
spurious failover, core's backward-seek eviction, a genuine node fault, a
session silently re-minting to no roles — is diagnosed from that surface, and
on a television there is no console to fall back on.

Then, in one device session while the set is up: §1.2's two remaining captures,
§1.3 decoder instances, §1.4 headers, §1.5 audio focus, and §1.6's unread
platform-surface findings. They all want the same sitting.

### Getting a build onto the set

```sh
cd android && ./gradlew assembleRelease          # ~4 min cold
TV=10.34.1.115:5555 ./scripts/verify-on-device.sh install
```

`npm test` runs `version:check` first, which compares `package.json`,
`app.json` **and the generated `android/` tree** — bump a version and you must
`npx expo prebuild --platform android` or it fails. The install stage then
asserts the device is running the APK just built. If it refuses, do not debug
against that install.

### Reaching the device

- The TCL answered all of 2026-09-13 at **`10.34.1.115:5555`**, already
  adb-connected. Its address is DHCP and has moved before (`.115` → `.116`).
- `getprop ro.product.manufacturer` must say **TCL**; it is `armeabi-v7a` only.
  A Blackview phone also appears on adb — that is the phone client's device,
  not this one.
- The set reaches its cluster node in **0.65 ms**; the laptop's link to the
  site is the unreliable half and dropped once mid-session. A slow or failed
  adb call says nothing about the set's own health.
- **`com.tcl.esticker`** — TCL's in-store demo overlay — took the foreground
  after ~52 minutes idle and drew over everything. Disabled with
  `pm disable-user --user 0 com.tcl.esticker`; reverse with
  `pm enable com.tcl.esticker`. It matters beyond tidiness: if it steals the
  foreground mid-film, `AppState` goes background and
  `usePlaybackRuntime` fires `terminateForPageExit()`, killing the session.
- **Driving the set over adb has two traps.** Back sent when no IME is open
  exits the app, and `com.tcl.tv` is `FLAG_SECURE` so `screencap` then returns
  an empty file. And pressing faster than ~2 s during a row scroll scores focus
  against stale `measureInWindow` rects.
- The screensaver takes the foreground while idling. Wake, foreground the app
  and act in one pass.

### Two standing rules

- **Take everything possible from `@machafoundation/core`.** Anything that is
  not presentation is already in the NPM module and is to be consumed rather
  than rewritten. It installs from the registry under its real name; there is
  no alias and no local link, so imports read `@machafoundation/core`.
- **Claims about other codebases get read, not remembered.** Every cross-repo
  assertion here has been wrong at least once — including two of this
  session's, listed in `COMPLETED.md`. Open the peer before writing "only",
  "never" or "nowhere else".

## 1. On the television

**The set is no longer the blocker.** It runs 0.3.3, navigates, signs in and
plays. What is left here is measurement and three faults found by using it.
The records of what was settled on 2026-09-13 — the sign-in P0, the D-pad
verification and the 5.1 measurement — are in
[`COMPLETED.md`](COMPLETED.md).

### 1.1 Three navigation faults found on hardware

None of these is fixed. The first is ahead of everything else in this file.

- **Settings has no focus-follows-scroll, and it makes the failure trail
  unreachable.** The Diagnostics toggle sits below the fold; focus moves to it
  invisibly, the page never scrolls, and Down and centre then appear dead — the
  only escapes are Up and Back. So the on-screen failure trail is **built,
  shipped and impossible to switch on**, which is why §1.2 ran without it.
  `MediaRow` already does the right thing by wiring `onFocusChange` to scroll
  the focused item into view; `SettingsScreen` does not.
- **The nav bar does not trap horizontal movement at its ends.** Right from
  "Settings" escapes into the poster row, because a card further right still
  scores as a valid candidate. Left from "Home" presumably does the same.
- **Back from a top-level screen exits the app** rather than returning to the
  previous route. Conventional on Android TV, so possibly correct — but it
  means a stray Back drops out to the launcher, and `com.tcl.tv` is
  `FLAG_SECURE`, so screenshots silently return empty when it does. Worth a
  decision rather than a fix.

### 1.2 Close out the 5.1 measurement

§1.2 is answered and the answer is good — direct play, six channels, positional
`0x0000003F`. Two gaps remain, both cheap and both wanting the same session:

- **Criterion 1 is inferred, not observed.** The instantiated decoder's *name*
  was never captured — `dumpsys media.codec` was empty and logcat had rotated.
  Catch `OMX.realtek.audio.dolby.eac3.decoder` actually in use.
- **Whether the panel renders six discrete channels downstream is unproven.**
  The reading was taken at the AudioTrack and mixer layer, not at the HAL
  output, and the same dump showed a `Multichannel Downmix To Stereo` effect
  present in the system. Core has a P1 resting on this distinction
  (*"speaker layout is not a concept core has"*), so capture the HAL output
  configuration and the effect chain on the active track.

### 1.3 Decoder instance limits

**On the critical path for §2.1**, which is non-negotiable.
`MediaCodecInfo.CodecCapabilities.maxSupportedInstances` per codec, via
`verify-on-device.sh instances`.

It decides whether the **no-shutter** tier of seamless failover is available: a
standby that has rendered a first frame needs its own surface, so two concurrent
decoder sessions, and if the panel allows only one HEVC decoder the standby
fails to allocate exactly when it is most needed.

It now answers a second question — whether Tier 2's *surfaceless* standby
already costs a decoder session, which is not answerable off-device.

The gate applies the same way whether the standby is a second `VideoPlayer`
(`expo-video`, built) or a second `ExoPlayer` (native engine). Neither the fetch
preflight nor the buffer-only tier allocates a decoder, so both are unblocked
either way. Where the platform does not populate the field the honest answer is
"unknown", and the fallback is to attempt a second allocation in the app and
observe — app work, not a shell check.

### 1.4 Wire-verify "no custom headers"

`verify-on-device.sh headers`. Source-verified only so far: one
`setDefaultRequestProperties` call forwarding `PlaybackSource.headers` verbatim,
no `X-`/`Macha-` literals, nothing branching on a response header. Media3 sets
its own `User-Agent` and range headers, which are real traffic and neither
custom nor ours. Capture a real fragment request and tell the NPM session, who
tracks this across all four clients.

### 1.5 Confirm audio focus on hardware

We are on `expo-video`, so the thing to measure is its known-worse behaviour:
`AudioFocusManager.kt:205` halves `player.volume` on a transient duck and
restores from its own `userVolume`. The question is whether repeated ducks
compound on this set, and whether a restore is ever missed — which would leave
a viewer at half volume with no way to tell why.

Now cheap to test: a film plays, and volume and mute are in the transport
overlay.

### 1.6 Read the platform-surface findings

The capability half is done and recorded in `COMPLETED.md` — including the line
that matters, **`HLS AUDIO: aac`**: this panel decodes `eac3` and `ac4`
natively, but we advertise AAC alone for HLS, so any title the chooser sends
over HLS has its surround transcoded while a direct Matroska keeps it.
Whether that narrowing is correct is `MachaPlayerModule.kt`'s claim that
ExoPlayer's HLS path is narrower than its progressive extractors — now worth
testing rather than trusting, because it decides transcode-or-not for every HLS
title.

**Still unread: `checkPlatformSurface`'s own findings.** They render below the
capability block on the Settings screen and were never reached — see §1.1.
The three `titleIndex` probes core added on this client's prompt are in that
block, so §4.3's `AlphabetIndex` still has no runtime evidence behind it.

## 2. Player work

### 2.0 The player is `expo-video` for now

**Tom's decision, 2026-09-10.** Playback moved from the native
`modules/macha-player` engine to `expo-video`, the component the phone client
already uses and the only one in this project proven to play. This client had
never been run, so the shortest path to a picture — and therefore to §1.2 — was
the proven component.

**The premise is unaffected.** `expo-video` is Media3/ExoPlayer underneath, so
it reaches the panel's own decoders and can direct-play E-AC-3 exactly as the
native engine would.

**Capability detection deliberately did *not* move.** `MachaPlayer.capabilities()`
still reads `MediaCodecList` through the native module, because `expo-video`
exposes no codec enumeration whatever. The phone client answers this from a
hardcoded list, and copying that here would make the node transcode AC-4, AV1
and Dolby Vision the panel decodes natively.

**What this costs while it stands**, so none of it is rediscovered as a bug:

- **Byte-level source control is lost.** `expo-video` builds its
  `OkHttpDataSource.Factory` internally (`utils/DataSourceUtils.kt:19-45`, a
  top-level function making a fresh `OkHttpClient`) with no injection point.
  This does **not** block seamless failover — see §2.1 — but it does block
  per-request control and HTTP status reporting.
- **Failure evidence is weaker.** `expo-video` reports no HTTP status, so
  `playbackFailureKindForStatus` cannot be applied and the honest kind is
  `unknown`.
- ~~**Hold-aware loading is gone**~~ — **restored 2026-09-13**, in JS, without
  returning to the native engine. `src/player/readiness.ts` waits out a
  `500 segment_not_ready` on the *same* node before the source is ever handed
  to `expo-video`, because that status is the node stating it is already
  working on a fragment it promised: failing over cannot help, since no other
  node has it and the replacement starts a cold generation from nothing.

  The walk itself is **core's `probeHlsReadiness`**, not ours — core absorbed
  this client's copy and the web client's into `hlsWalk.ts` on 2026-09-13, so
  `src/player/preflight.ts` is **deleted** and only the retry budget is still
  local. Which status means "hold" is asked of `playbackFailureKindForStatus`
  rather than hardcoded, so a change in core reaches here without an edit.

  **The ordering is the fragile part.** `FIRST_FRAGMENT_TIMEOUT_MS` is 30 s and
  `MEDIA_START_STARVATION_MS` is 20 s, so the walk must finish *before* the
  start watchdog is armed. Arming first and then waiting puts the watchdog
  mid-walk and reports a spurious `stream` failure against a node behaving
  exactly as the protocol says — the very bug this removes, reintroduced by
  ordering alone. `ExpoVideoAdapter.startWatchdogs()` exists to keep that
  explicit, and a test pins it.
- **Ducking mutates user volume** — the phone client's known behaviour, now
  inherited. See §1.5.

**`ExoPlayerAdapter` and `PlayerEngine.kt` stay in the tree, unused.** A
now/later decision: revisit once §1.2 has an answer. Deleting them would make
the revisit a rewrite.

Two things came free: `availableAudioTracks` / `availableSubtitleTracks` with
selection, and `keepScreenOnWhilePlaying` replacing manual `FLAG_KEEP_SCREEN_ON`.

### 2.1 Seamless failover — Tier 3 remains

**Non-negotiable. Tom, 2026-09-12: "The literal reason this repo exists is to
have this."** Working in `macha-client` and confirmed by Tom on the Samsung set.

Tiers 1 and 2 have landed — see `COMPLETED.md`. What remains:

**Tier 3, the no-shutter handover.** One change: give the standby an off-screen
or alpha-0 `VideoView` so it renders a first frame, which flips
`hasSentFirstFrameForCurrentMediaItem` and holds the shutter open through the
swap. **Gated on §1.3.**

Until then, promotion shows a brief black frame: the standby has never rendered,
so `VideoView`'s setter closes the shutter over the swap. That is the tier's
known cost, not a fault.

**Carry into the device session:** the retired player is released by
*presentation*, not by the swap. The swap notifies through a React state update
and React commits after the current task, so releasing inside the swap would
destroy a player the mounted `VideoView` still holds. `PlayerScreen` calls
`releaseRetiredPlayer()` from an effect keyed on the player instance; `stop()`
and `detach()` are the backstop. **If a promotion ever leaves a dead surface,
this ordering is the first place to look.**

### 2.2 Does a promoted standby actually play?

Unverified **here**. `macha-client` does this and Tom confirms it works; the
phone client saw one promote in 3 ms onto a dead session and has withdrawn its
explanation, so what remains unknown is that client's failure, not the
mechanism. The web client is the control — if it works there and not here, the
difference is in this client, not in core or the cluster.

Watch for a standby holding a node's only transcode slot
(`max_video_transcodes` is 1) for up to the 30 s window.

**Half of that cost was a core defect and is now fixed** (core session,
2026-09-12). `PlaybackCoordinator.promoteReadyAlternate` passed a *fresh* record
to `beginSupersededCleanup`, which acts only on the record it already owns — so
the call was a no-op and the promoted-*from* session was never closed. On a
one-slot node every promotion permanently stranded the slot it walked away from.

Observable here as **one additional `resolver.stop` after a promotion**, the
cheapest confirmation that promotion is doing the whole job. It matters more to
this client than to the peers: §2.1's standby is a *second* concurrent session,
so the arithmetic on a one-slot node only works if the old session goes away.

### 2.2b Two core hazards that land hardest on a D-pad

From the core session's review (`macha-ts/TODO/REVIEW-2026-09-12.md`), both
**verified against core's source here** rather than taken on report. Neither is
fixed in core yet; both bear on §2.1. Core owns the fixes.

**The stall watchdog never re-arms after a suspend.**
`MediaStallWatchdog.suspend()` (`MediaWatchdog.ts:352`) disarms the deadline,
and only `note()` re-arms it — but `note()` returns early unless position or
buffer **advanced** (`:333-340`). So: pause, the node dies while paused, resume,
and nothing ever advances, so nothing ever re-arms. **A frozen frame sits there
indefinitely with the whole failover apparatus disarmed.** We wired both
watchdogs precisely so `prepareAlternate` was reachable; this is the case where
that wiring silently does nothing.

**A backward seek can evict a healthy node.** `note()` keeps the buffer baseline
as a running max. After a backward seek the reported buffer end drops below that
high-water mark, so `advanced` stays false against a node that is working fine,
and a below-realtime but healthy transcode is condemned at the stall deadline.

**This is worse on a television than anywhere else**, and the core session has
raised its severity on that basis: a D-pad *is* the seek affordance —
`PlayerScreen.nudge()` commits a `runtime.seek` after every rewind burst — so
this client generates backward seeks as ordinary viewing. Web and phone have
scrubbers people touch rarely.

### 2.3 Player options — done, and now exercised

Mode, quality, audio track, subtitle track and source switching, in a panel
with its own focus scope. Back closes the panel before the player.

The panel was not opened during the 2026-09-13 playback session, so its
contents are still unseen on hardware — but the transport overlay's stream
lines were, and they are what answered §1.2. Forcing a mode by hand is still
how a downmix would be isolated if the direct path ever stops being chosen.

### 2.4 Optional `Player` methods

Implemented: `detachHost`, `subscribeFailure`, `subscribeDegradation`,
`setSubtitle`, `preflightSource`.

- **`prepare(profile)`** — core calls it to start capability detection off the
  Play critical path. Nothing calls `runtime.prepare()` today, so every play
  pays that cost inline.
- **`addDirectSourceAlternative`** — see §3.1, a decision rather than a task.

`setSubtitle` is **narrower than the name suggests**: `expo-video` selects among
tracks the manifest already carries and cannot side-load a subtitle URL, so a
URL with no matching track leaves selection unchanged rather than silently
clearing it. Whether core ever hands us such a URL is untested.

### 2.5 Stores constructed but unused

**`VolumeStore` is now wired** (2026-09-13) — volume and mute in the chrome,
persisted across sessions. See `COMPLETED.md` for the one decision in it that
was not obvious.

Still dead:

- **`PlaybackQueueStore`**, built in `MachaProvider.tsx` and read by nothing.
  Needs episode-to-episode continuation and next/previous in the chrome, which
  means threading queue context through `App.tsx` rather than a local change.
- **`MusicPlaylistStore`** is **not constructed at all** and is needed by every
  music route. Full accounting in §4.5.

---

### 2.6 Core `0.10.0` — adopted and green, not ported

`@machafoundation/core 0.10.0` is installed and this tree builds and passes
against it (159 tests, typecheck clean). Nothing resolves a removed or renamed
symbol: the renames cost nothing because none of them were referenced by name,
and `MachaHost.ephemeralStorage` was removed with a note left where it was
decided. **The port itself has not been done.**

Not wired, in the order they matter here:

- **`SessionManager.lastIdentityChange`** — `{ from?, to?, at }`, set when a
  re-obtained session belongs to a different account than before.
- **`secureStorage`** — core takes an optional `StorageLike` and puts the token
  in it. `expo-secure-store` runs on Android TV and would make that
  Keystore-backed. Until it is supplied the token sits in app-private
  `AsyncStorage`, like the rest of this client's state.
- **`signOut()`** now revokes server-side and **throws** on failure rather than
  swallowing it, and does not mint a replacement.
- The session key is `macha.session.v1`; use the exported `isMachaStorageKey()`
  rather than a local prefix test.

**The part with real teeth, and it is worse on this cluster than elsewhere.**
The session lifetime is 30 days from creation with no sliding expiry and no
refresh tokens, so core's refresh timer **re-mints** rather than renewing. A
re-mint presents no credentials, and `anonymous` on Tom's cluster has held no
roles since 2026-09-13 — so a signed-in viewer degrades to `roles: []`, which
`accessState()` reads as `{ kind: 'sign-in' }`.

What saves it from being a wall in front of someone mid-film is
`useAccessLatched`, which admits the client once and never un-admits it. That
latch was written for a failed *refresh* and happens to cover this. The cost is
the deferral already documented in `access.ts`: **requests begin failing with
nothing on screen explaining why, and the viewer lands on the login wall at
next launch.** An auth event wearing the costume of a UI bug.

`lastIdentityChange` and `sessionLockedOut` are the two facts that tell "your
session aged out" apart from "this cluster refuses you" — identical to a gate,
very different to a person. Both belong on the failure trail (§4.2), which
means **§1.1's Settings scroll fault is ahead of this in the order**: the trail
is built and shipped and cannot currently be switched on.

## 3. Decisions for Tom

### 3.1 `addDirectSourceAlternative` — local proxy, or wait for the engine?

**Not a port.** The web client's implementation (`directPlayReadAhead.ts:300`)
is built on a **Service Worker**: it registers a source key, hands the player a
proxy URL on its own origin, and the worker fails byte-range requests over to
whichever node answers. The player never knows.

There is no Service Worker on React Native and `expo-video` fetches its own
bytes. The shape is reproducible — give the player a URL we control — but here
that means **running a local HTTP proxy inside the app**: real new
infrastructure, not a port. On the native engine it is straightforward instead,
since `PlayerEngine.kt` owns its `DataSource.Factory`.

**It matters more than its position suggests**: it applies only to
`mode: 'direct'`, and direct play is the *expected* case on a panel that decodes
E-AC-3 natively — the whole premise. Degradation is graceful either way: without
the hook the coordinator falls through to the ordinary reactive standby path
(`PlaybackCoordinator.ts:1310`), so direct sources still get a warm standby,
just not silent byte-level failover.

### 3.2 Is the GitHub repository public?

Pushed to `git@github.com:tomdionysus/macha-client-rn-android-tv.git`, and
`main`, `develop` and tags `0.1.0`–`0.3.3` are all on the remote as of
2026-09-13. **Visibility still unconfirmed** — `gh` is not available here.

It matters because the site session has published that this repo is not
fetchable, with `macha-ts` and `macha-client` as precedent. If it is public
that sentence is now wrong, and it is Macha UI Work's to correct rather than
ours. Loading the URL while signed out answers it in a second.

### 3.3 Are `/manage`, `/manage/files` and `/items/:id/edit` TV work at all?

The two remaining **decide** rows in §4.1. A 10-foot UI is a poor place to retag
a film. `/ingest` and `/sponsor` are already ruled out (Tom, 2026-09-10).

---

### 3.4 The `@macha/core` import alias — **done, 2026-09-15**

Renamed to `@machafoundation/core@^0.11.1`, resolved from the registry, with
the `file:../macha-ts` link and the `npm link` option both removed: the
development cycle is now what a user gets on install (Tom's decision).

The judgement recorded here before — *"this is not a defect"* — was wrong, and
for a reason worth keeping. The `@macha` scope is **unclaimed on npm**: the
old key resolved only because its value was a `file:` path. Anyone could have
registered the scope and published `core` into it, and any install that lost
the override — a regenerated lockfile, CI, a teammate without the sibling
checkout — would have fetched a stranger's package and run its install
scripts. A 404 was the only thing preventing it. An alias that is safe only
while nobody else claims the name is not a tidy-up.

Two things this cost, both recorded because a green check hid them:

- The lockfile cached the link at **version `0.7.0`** while `../macha-ts` on
  disk was `0.11.1`. Neither a version string nor a green suite proves what is
  installed; only the `resolved` URL and an integrity hash do.
- `pretest` ran core's `dist:check` against a sibling tree. Dropped — it
  answered a question about a directory this tree no longer compiles against.
  `version:check` is ours and stays.

Verified by fresh clone with no sibling `macha-ts`, `npm ci`, typecheck, 159
tests, and `expo export` — the last because Metro resolving core's ESM through
its `exports` map had only ever been exercised through a link.

### 3.5 Is Back from a top-level screen meant to exit the app?

It does today (§1.1). That is conventional Android TV behaviour, so it may be
correct — but combined with §1.0's requirement that Settings stay reachable
from behind the login wall, it is worth stating deliberately rather than
inheriting.

---

## 4. Parity with `macha-client` — the complete list

The whole distance from here to an application with the same functionality as
the web client. An enumeration, not a recollection: every row was read off
`../macha-client` and checked against this tree. The route count is 31 declared,
less the `*` catch-all and the two pure redirects, so **28 real destinations**.

**Two rules govern everything below.**

1. **Take it from the NPM module.** Anything not presentation is already in
   `@machafoundation/core` and must be consumed, not rewritten.
2. **Presentation is the only thing genuinely missing.** There is **no gap below
   that needs a new data layer.** Search, music, status, alphabet jumping and
   endpoint editing all have their logic shipped and tested in core; what is
   absent is the D-pad surface in front of them.

### 4.1 Screens — 9 of 28 routes, plus 1 partial

| Web route | Here | What core already gives us |
| --- | --- | --- |
| `/` Home + Continue Watching | **yes** | `ContinueWatchingStore`, `recentMedia` |
| `/movies`, `/series` libraries | **yes** | `MediaApi`, `titleIndex` |
| `/movies/:id`, `/episodes/:id`, `/items/:id` detail | **yes** | `MediaApi`, `MediaTechnicalProfile` |
| `/series/:id`, `/series/:id/seasons/:id` | **yes** (season folded in) | `MediaApi` |
| `/play/:id` player | **yes** | `PlaybackCoordinator`, `PlaybackRuntime` |
| `/settings` | **partial** — displays, cannot edit | `MachaServerApi`, `connectionConfiguration` |
| `/login` | **yes** (2026-09-13) | `sessionManager.signIn`, `sessionLockedOut`, `lastMintFailure` |
| *(offline gate)* | **yes** — no web equivalent | `lastMintFailure.reason` |
| `/search` | **no** | `MediaApi.search()` — the query side is done |
| `/music/*` (7 routes) | **no** | `MediaApi`, `MusicPlaylistStore`, `state/musicPlaylist` |
| `/status`, `/status/client`, `/status/connectivity`, `/status/nodes/:id` | **no** | `ClusterStatusApi`, `ClusterStatusRouter` |
| `/connection` endpoint gate | **no** | `shouldEnterConnectionGate`, `normalizeConnectionEndpoints` |
| `/manage`, `/manage/files` | **decide** (§3.3) | `ClusterManageApi` |
| `/items/:id/edit` metadata editor | **decide** (§3.3) | `ClusterCatalogueApi` |
| `/ingest`, `/sponsor` | **not doing** — Tom, 2026-09-10 | — |

**Search is the most conspicuous absence for a viewer**, and the design is
settled: **use the television's own on-screen keyboard** (Tom, 2026-09-10). A
React Native `TextInput` raises the platform IME — the leanback keyboard the
viewer already knows, with its own voice input. Drawing our own would be worse
and larger.

Its one integration point is **already built**: while the IME is open it owns
the D-pad, and `tvFocus.suspend()` now exists for exactly that. Search is
therefore unblocked.

**Music is seven routes**, the largest single block, and none of it is started.

### 4.2 Player chrome — 5 of 12 controls

Built: restart, rewind, play/pause, forward, close, plus the scrubber with a
buffered range.

Missing:

- ~~Options~~ — **done 2026-09-13**, §2.3.
- **Previous / next** — needs `PlaybackQueueStore` (§2.5).
- ~~Volume and mute~~ — **done 2026-09-13**. Not a slider: the control takes
  left and right while focused, as the scrubber does, since a D-pad is the only
  input and a separate slider would be two controls where one will do.
- **Mini player** and its minimise/expand pair.
- ~~**Failure trail**~~ — **built 2026-09-13, and currently unreachable.**
  `screens/player/failureTrail.ts` prints the last dozen warnings and errors
  under the failure message. Off by default; the switch is the first editable
  control on the Settings screen — **and that screen cannot scroll to it**
  (§1.1). The buffer it reads had to be wired too
  (`diagnostics/playbackLog.ts`, at `warn`), since this client had never
  called core's `createClientLogger` at all. Note `console` is `__DEV__`-only,
  so in a release build the trail is the *only* way to read that buffer:
  `verify-on-device.sh logs` greps `ReactNativeJS` and will show nothing.
- **Seek acceleration** (`screens/player/seekAcceleration.ts`) — the native key
  bridge already passes `repeatCount` through, so the input side is done.

Fullscreen is **not applicable** — a TV app is always fullscreen.

### 4.3 Components — 10 of 21 ported

Ported: `MediaCard`, `MediaRow`, `Status`, `PlayerIcons`, `LazyArtwork`,
`AlphabetIndex`, `ConnectionForm`-adjacent `TvTextInput`, plus TV-only
`Focusable`, `TopBar` and `EpisodeCard`.

**`TvTextInput` is the one to reuse.** It raises the platform IME and suspends
the focus registry while it is open, which is the integration point Search needs
and the reason `tvFocus.suspend()` exists. Built for the login screen; Search
should not write a second one.

Missing, in the order they matter on a D-pad:

- **`OverflowMenu`** and **`Modal`** — every "add to playlist / play next / play
  later" affordance hangs off these, so **music depends on them**.
- **`CardCloseButton`** — there is no way to dismiss a finished film from
  Continue Watching.
- **`MediaPageTitle`** refresh affordance, **`EpisodeRail`**, **`SectionNav`**,
  **`MusicNav`**, **`StatusNav`**, **`ConnectionForm`**, **`DeviceCapabilities`**,
  **`AsyncIconButton`**, **`EditButton`**, **`AppLogo`**, and **`ManageNav`** /
  **`ManageIcons`** (the last two only if §3.3 is taken).

**What `LazyArtwork` does not cover:** an `ArtworkRef` with no `url` at all,
which the web client fetches as a `Blob` via `useArtworkUrl`. Those render as
the letter placeholder here. The fix needs a different shape anyway —
`URL.createObjectURL` does not exist on this platform, so it is a fetch to a
data URI or a cached file.

### 4.4 Hooks — 4 of 9 ported

Ported: `useAsync`, `useRefreshableAsync`, `useTvNavigation`, `useAlphabetIndex`.

Missing: **`useArtworkUrl`** / **`useViewportArtworkUrl`** / **`artworkViewport`**
/ **`artworkRetry`** (20 uses in the web client — but most of what they are
*for* is now covered differently; see §4.3), and **`usePollingTask`** (7 — the
status screens need it).

### 4.5 Stores — one wired, one dead, one now ours

`ContinueWatchingStore` is used. `PlaybackQueueStore` is constructed and never
read (§2.5). `MusicPlaylistStore` is **not constructed at all**, is superseded
by core's `PlaylistStore`, and core says it should be deleted rather than
extended.

**`VolumeStore` is no longer core's.** Tom ruled on 2026-09-13 that volume is
player logic — *"Don't second guess the client"* — and it now lives at
`src/state/volumeStore.ts`, copied with its storage key unchanged so no
viewer's level resets. Core has deleted its original. `PlaybackRuntime.setVolume`
stays in core and stays in our path: it *applies* a volume where the store
*persists* one, and conflating those two is a mistake core made and corrected.

The clearest illustration of rule 1: all four stores are core's, already written
and tested, and the work here is to render them.
