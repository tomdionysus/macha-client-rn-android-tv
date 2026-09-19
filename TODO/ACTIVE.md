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

**Two of them are owed to the web session**, which cannot take either on a
desktop and has asked for them in this order (2026-09-19):

1. **Is the re-attach blank visible at ten feet?** Not whether it exists — it
   does (§2.6) — but whether it reads as a fault or as nothing. That is what
   decides whether holding the shutter open is worth a decoder instance
   (§2.1), and no measurement in milliseconds answers it.
2. **What does `session_idle` do to a set left paused, and after how long?**
   Their figure is thirty minutes from the node's reaper and the client half of
   it is an open P0 there. A television is where a pause that long is ordinary,
   so this set is the right place to find out.

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
- **Failure evidence is weaker.** `expo-video` reports no HTTP status —
  `PlayerError` is `{ message: string }` — so `playbackFailureKindForStatus`
  cannot be applied to anything the player itself reports. **Recovered
  differently since 0.14.0**: the readiness walk makes its own requests and does
  see statuses, so a refusal at `play()` is classified directly, and a terminal
  error from the player is classified by asking the node — one walk against the
  current source, latched per generation, conservative on anything short of a
  status. See §2.6. The kind is still `unknown` wherever the node does not
  answer, which is the honest outcome rather than a residual gap.
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

**Two things the web session paid for on the same approach** (2026-09-19,
unverified here and on a different platform, so treat as a warning rather than a
result):

- **A hidden element still buffers.** `display: none` does not gate MSE, so an
  off-screen standby fills normally and costs nothing while it waits. The other
  half of their finding — that *tab* visibility throttles loading as well as
  decoding — has no equivalent on a television.
- **Do not promote the moment it is ready.** An element holding almost nothing
  past the join starves seconds later, and picture-back-then-gone reads worse
  than the single gap it replaced. Their handover waits for the join plus a
  margin; their relocation hold promotes on `canplay` and they are not yet sure
  that is enough. **Open on their side, so do not copy the threshold** — copy
  the shape, and measure the margin here.

**It is also what would close the park gap** (§2.6): a source re-attached after
a park blanks the held frame, and a pre-warmed second player is exactly what
holds a shutter open across that.

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

### 2.2b Two core hazards that land hardest on a D-pad — **fixed in core, unproven here**

From the core session's review (`macha-ts/TODO/REVIEW-2026-09-12.md`), both
raised from this client because a D-pad meets them as ordinary viewing. **Both
are fixed in `@machafoundation/core 0.14.0`**, read out of the shipped
`MediaWatchdog.js` this tree compiles against rather than taken on report.

- **The stall watchdog never re-armed after a suspend.** `suspend()` disarmed
  the deadline and only advancement re-armed it, so a node that died while the
  viewer was paused left a frozen frame with the whole failover apparatus
  disarmed. `note()` now carries a `resumed` flag — set by `suspend()`, cleared
  by the first `note()` after it — which re-arms without requiring anything to
  have moved.
- **A backward seek could evict a healthy node.** The buffer baseline was a
  running max, so after a backward seek a node refilling perfectly well never
  counted as advancing and was condemned at the stall deadline. `note()` now
  detects the discontinuity — position or buffered end moving backwards, neither
  of which ordinary playback can do — and re-bases the high-water mark. Core's
  own comment names the television case: a D-pad is the only seek affordance, so
  this is routine viewing rather than an edge case.

**Neither fix has been exercised here**, and nor could it be: no watchdog has
ever fired on this set (§2.2). The pause case is the one to provoke first,
because it is also the case §2.6 leaves half-answered — pause past the node's
`session_idle`, resume, and watch whether the failure is reported as evidence
against a node that did nothing wrong.

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

### 2.6 Core `0.14.0` — the player contract is ported; the session work is not

`@machafoundation/core 0.14.0` is installed (2026-09-19, from `0.12.0` — the
registry has no `0.13.0` gap, both minors landed in four days) and this tree
builds and passes against it: 179 tests, typecheck clean, `expo export` clean.

**What 0.13.0 and 0.14.0 actually are** is one bug seen from four sides — a
viewer pauses for half an hour, the node reaps the play session exactly as
`session_idle` says it should, and the viewer comes back to a failure screen
naming a node their session was never on. The three parts of the answer are a
status that was read as the wrong kind of evidence, a replacement built at the
wrong time, and a look-ahead figure no client could see. All three touch the
player seam, which is why this was a port rather than a version bump.

**Ported here** (see `git log` for the argument in each):

- **`not-found`.** A `404` on a playback route is a statement about one
  session's existence, not about the node that answered. Read as `stream` it is
  endpoint evidence, so the honest node is charged a failure and dropped while
  the viewer is sent to one that never held the session.
  `ExpoVideoAdapter.nodeWillServe` now maps the readiness walk's status through
  `playbackFailureKindForStatus` instead of reporting a blanket `stream`, and
  core answers a `not-found` by asking that same node whether the session is
  still there and regenerating on it — no failover, no failure recorded.
  **The kind carries an obligation**: an adapter reporting it must not tear the
  presentation down, because the element's buffer is the cover core builds the
  replacement behind. Nothing here does, and a test pins it.
- **Node-stated budgets.** `PlaybackSource.budgets` carries the serving node's
  own acquisition deadline and fragment hold. `firstFragmentTimeoutMs()` takes
  the stated deadline **whole, including when it is shorter** than this
  client's five-holds constant — core owns when to stop and the host owns what
  happens until then, and of two deadlines the shorter silently wins while the
  other layer looks broken. The constant is now only what a node too old to say
  gets, and a node that cannot say is not one that needs less time.
- **`MediaStallWatchdog.useSourceBudgets()`** at every attach, including a
  promotion. The watchdog outlives a generation while the figure belongs to a
  node, so a host that states it once judges every later node by the first
  one's hold — which is how a node configured with a longer hold gets called
  dead for using it.
- **`PlaybackTransition`.** `play()` now takes it, and a warm standby is cut to
  **only on `continue`**. A viewer's seek and a session-reap recovery arrive
  byte-identical — measured, by the web client — so this is the one bit no host
  can derive. Hiding a seek holds the viewer where they were while the clock
  says they arrived: fourteen seconds of it, measured there. Absent means
  `relocate`, which is core's default and the behaviour every player had before
  seamless replacement existed. Tier 2's promotion still shows a black frame so
  the cost of getting it wrong is small *today*; Tier 3 (§2.1) is what makes
  the swap invisible, and an unasked-for hide then becomes a lie.
- **`sessionAlive` / `regenerate`** arrive free through
  `ClusterPlaybackResolver`, and the node budgets reach the source through
  `EndpointHealthMonitor`, which this client already runs. Neither needed
  wiring — but both are **unexercised here**, like everything else about
  failover (§2.2).

**A statusless terminal error is now classified rather than guessed at.**
`expo-video`'s `PlayerError` is `{ message: string }`, so until this the
`not-found` work above reached core only from the readiness walk at `play()` —
and the likeliest failure on a television is the one it could not see: a
session reaped while the viewer was paused, found by the player's own loader
and reported as `unknown`, which core treats as possible endpoint evidence.

The answer is the web client's, taken on its advice (**Tom, 2026-09-19: the
experience must be as close as possible to the web client**) and corrected by
it in one place worth keeping:

- **Ask the node, not the session.** Their first instinct here was a session
  `GET`; it is wrong, because a fragment past the end of a live plan and a
  reaped session both answer `404 not_found` and differ by one word of English
  in a body no loader surfaces. A session that reports itself alive therefore
  does not prove the fragment was servable. `kindForTerminalError()` re-runs
  core's readiness walk against the current source, which asks exactly what the
  loader asked.
- **Latch it.** The web adapter has this problem on Direct Play — a 404 body
  handed to the element raises a generic decode error — and did not parse the
  message: the layer that does see statuses latches its verdict and the
  statusless error is read against it. `sourceVerdict` is that latch, fed by
  the walk, keyed by URL because a generation is its URL.
- **Classify conservatively.** `ready`, `holding`, `unassessable` or no answer
  all leave the kind `unknown`.
- **No message parsing.** Nothing in the web adapter classifies from text, and
  the one place they were tempted they used a latch instead.

**The reason for that floor was wrong as first written here, and the core
session corrected it.** It said `unknown` costs a spinner while a wrong
`stream` costs a healthy node. `isEndpointRetryablePlaybackFailure` returns
true for **both** — verified in the shipped `Platform.js` — so an `unknown`
prepares a standby on another node and can escalate exactly as a `stream` does.
The floor is still right for a different reason: `unknown` is core's documented
answer for a status it has no rule for, and the standby behind it is the
recovery that works without knowing the cause. **The asymmetry that does hold
is against `not-found`**, which is excluded from that gate: a false one sends
core to ask about a session that was never reaped, and a session reported alive
stops the recovery dead. A false `not-found` buys silence; a false `unknown`
buys a standby.

**The walk is bounded against the runway, not by a fixed deadline** — also the
core session's, and the one change it asked for. Core defers building a
replacement while `runwayMs > leadTimeMs` and builds immediately below it, so
every second spent asking comes off the cover the deferral was protecting; and
`beginMissingSessionRecovery` returns handled when another recovery already
owns the source, so a verdict arriving after one has started is not late but
**void**. The budget is therefore `runway - leadTime`, computed from core's own
`replacementLeadTimeMs` against this node's attempt budget, with a floor of one
`ENDPOINT_TRANSPORT_ALLOWANCE_MS`. The floor is what makes asking worth it with
no cover left: a node that will answer answers within a round trip, and the
alternative is an `unknown` that fails over to a node which must cold-start —
9 s measured by core, against a floor of 4. **Asserted from those two figures,
not measured here.** The runway itself is the last figure the event stream
carried, not one read after the failure, because a player in its error state
may report nothing about a buffer it still holds.

**A pause no longer ends on a failure screen.** The web client measured exactly
that — a paused generation judged dead seven seconds in, then a failover that
could not succeed, and a viewer looking at `Playback failed` naming a node they
had never been on — and answered it with `park-paused`: a fatal error raised
while nobody is waiting is parked rather than judged, and met again on resume
with the viewer present. Every judgement here is "is this node failing the
person watching", and while playback is paused there is nobody to fail.

The same decision is now in `ExpoVideoAdapter`, keyed on **viewer intent**
rather than on the player, because between a play request and the element
running nothing is playing while the viewer is very much waiting. `startPaused`
counts as not-waiting, as it does there.

**Where this client cannot match it**, all four from the web session and none
measured here:

- Their park keeps the element's buffer and its frame — `hls.stopLoad()`, then
  `startLoad()` on resume. `expo-video` owns its loader and a player in its
  error state will not resume, so the source is re-attached instead: **the
  viewer will see the held frame blank and come back**, and the buffer is gone.
  Worth revisiting if Tier 3 lands, since a pre-warmed second player is exactly
  what holds a shutter open (§2.1, gated on §1.3).
- Their per-generation latches key on a source generation a re-attach would
  bump. Ours is keyed by URL and a re-attach does not change it, so the same
  404 cannot be re-reported as new — but this is the thing to check first if it
  ever is.
- Their position mapping had a negative-origin bug on exactly this re-attach
  shape. This client re-attaches the *same* source, so the generation origin is
  unchanged and element time still maps as it did.
- **Their 404 policy is shipped in source and not deployed.** `fi-1` and `es-1`
  run 0.17.1; `isHlsSourceNotFound`, `fail-not-found` and the Direct Play latch
  are in 0.17.2, which is tagged and not out. So a behavioural comparison
  against a live web client today compares against a build that still condemns
  the node on a 404, and a difference seen there is not this platform.

**None of it is observed.** Everything above is asserted from two implementations
and a contract. The web session has not watched a parked-then-resumed session
either — their "no spinner on resume" is a reading of their own code, stated as
such when asked. **The pause case is now the first thing to provoke on the set**
(§2.2b), and whoever gets there first owes the other the answer.

**Still not wired, from `0.10.0` and unchanged by this port:**

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
