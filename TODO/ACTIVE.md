# Active

Open work on the Android TV client. Reasoning lives in
[`../docs/HISTORY.md`](../docs/HISTORY.md); this is the list.

Status of the whole client: **it runs.** On 2026-09-12 it was installed on the
TCL and launched, rendered Home with real artwork, and reached the cluster at
`http://10.34.1.50:7438` — `route-success`, health `reachable: 3, known: 5`,
posters served from the node. Screenshots in [`../docs/evidence/`](../docs/evidence/).

**Nothing has been played yet**, so every playback claim in this file is still
unexercised: no film has started, no watchdog has fired, no failover has
happened, and §1.2 — the measurement this project exists for — is still open.
The session that got this far ended when the link to the whole `10.34` site
dropped mid-navigation, not because anything in the app failed.

Ordered by consequence: the on-device session first because everything else is
waiting on what it tells us, then the feature work that is required, then
decisions, then **§4, the complete parity list against `macha-client`** — the
whole distance from here to an application with the same functionality.

Two standing rules apply throughout, not only where they are repeated:

- **Take everything possible from `@macha/core`.** Anything that is not
  presentation is already in the NPM module and is to be consumed rather than
  rewritten. Where this list names a gap, it also names what core already
  provides for it.
- **Claims about other codebases get read, not remembered.** Every cross-repo
  assertion here has been wrong at least once — see `COMPLETED.md`. Open the peer
  before writing "only", "never" or "nowhere else".

---

## 1. The on-device session

The hold on the television (`10.34.1.115:5555`) was lifted on 2026-09-10 and an
install was attempted the same day. **The set did not answer** — no adb, no
ping, while the cluster node `10.34.1.50` replied in ~75 ms, which is the
script's own signal for a set that is powered off rather than a routing problem.
So §1.1 is still open and still the first thing to do.

Do not poll for it; run the pass when the set is known to be on. Everything here
is scripted in
[`../scripts/verify-on-device.sh`](../scripts/verify-on-device.sh) so the
session is one pass rather than improvised.

### 1.1 Install — DONE 2026-09-12

**Answered: the set had no Macha app at all.** The interrupted operation of
2026-09-10 did remove the WebView client (`media.macha.client`) and the device
dropped before ours was installed, so the television sat with no Macha client
for two days. `pm list packages | grep -i macha` returned nothing.

Installed and launched on Tom's explicit instruction, which lifted the standing
"install without starting" rule for that session.

**The set was not off — it had moved to `10.34.1.116`.** `.115` was silent
because nothing is there. A relocated set and a powered-off set are
indistinguishable from outside, and the 2026-09-10 conclusion that the set was
off was therefore wrong. Its address is DHCP; confirm it rather than assume it,
and confirm the *device* too — `getprop ro.product.manufacturer` must say TCL —
before installing anything.

### 1.1b The D-pad — two bugs, both fixed, install pending

**Found on hardware 2026-09-12. Both are fixed in the tree and verified by
tests; the fixed APK has *not* yet been installed** — the set had the
key-bridge build without the geometry fix when the link to the site dropped.
Reinstalling and confirming a Down press enters the Movies row is the first
thing to do when it is reachable.

#### The second bug: geometry was measured and thrown away

Only visible once keys worked. The registry reported **`registered=46
measured=0`** while all 46 `measureInWindow` callbacks fired with correct
rectangles.

`measure()` delegated to `update()`, which returns silently for an unknown id —
right for an arbitrary patch, catastrophic for geometry. And the id was *always*
unknown, because registration lost a race it loses every time: registration was
a `useEffect`, a passive effect React defers, while Fabric dispatches `onLayout`
from native the moment layout commits.

**So the ported scorer had never once chosen a candidate on this device.** Every
move came from `sequentialCandidate`, which is exactly what the set showed:
Down from a nav item went *sideways* to the next nav item, because that was next
in mount order.

Three things were wrong and all three are closed:

- `measure()` now holds an early rectangle in `pendingRects` rather than
  dropping it, and `register()` claims it.
- `register()` preserves geometry **and order** across a re-registration. It
  rebuilt the entry from scratch, so any prop change silently dropped that
  element back to sequential navigation — the same bug a second time.
- Registration is a `useLayoutEffect`, so it stops losing the race rather than
  only recovering from it.

**The existing 13 focus tests passed throughout**, because every one of them
called `register()` then `measure()` in the tidy order. Nothing exercised the
order the platform actually delivers, so a green suite sat on top of a focus
model that could not navigate. Five tests now encode the real order, two of them
named for the television's own symptom; reverting `measure()` fails them.

#### The first bug: no key ever reached JavaScript The app renders, connects
and serves its library, but **no remote key has ever reached JavaScript.** The
focus model — the ported scorer, `Focusable`, scopes, its tests, and the suspend
added the same day — is correct code wired to a dead input.

Verified in `react-native-tvos@0.86.2-0`'s own Android source, not inferred:


- The app runs **bridgeless** (`newArchEnabled=true`; the startup log says
  `BridgelessReact`). Key events go `ReactSurfaceView.dispatchJSKeyEvent` →
  `JSKeyDispatcher`, which dispatches view-level `KeyDownEvent`/`KeyUpEvent`
  and **never emits `onHWKeyEvent`**.
- `useTVEventHandler` listens for **`onHWKeyEvent` only**
  (`Libraries/Components/TV/TVEventHandler.js:46`). That is emitted solely by
  `ReactAndroidHWInputDeviceHelper`, which is called only from the **legacy**
  `ReactRootView` and from `ReactModalHostView`. Neither is in the bridgeless
  path.
- The replacement path is doubly unavailable: `ReactNativeFeatureFlags.enableKeyEvents`
  defaults to **false**, and `JSKeyDispatcher.handleKeyEvent` opens with
  `if (focusedViewTag == View.NO_ID) return` — so with **no natively-focused
  view it discards every event**. `Focusable` renders a plain `<View>` and never
  takes Android focus, so even with the flag on, nothing would arrive.
- There is no touch fallback either: `Focusable` has no `Pressable` and no
  `onPress`, so `input tap` cannot drive the app.

Confirmed on device: `mCurrentFocus` is our `MainActivity`, key events are
delivered natively, and `DPAD_DOWN`/`DPAD_RIGHT` change nothing.

**Decided, Tom, 2026-09-12: option 1, a native key bridge of our own.**
Implemented as `foundation.macha.tvinput.MachaTvInputModule`, awaiting
verification on the set. `useTvNavigation` now listens to that module instead of
`useTVEventHandler`, and Back moved to `BackHandler` — the only mechanism that
can tell the platform *synchronously* whether the app consumed the press, which
a bridge emitting into JavaScript cannot.

The module wraps `Window.Callback` rather than overriding `dispatchKeyEvent` on
`MainActivity`, because the activity is generated under `android/` and a
prebuild would erase the override — the way this project has already lost its
leanback flags once and its ABI pin twice.

**Options as they stood:**

1. **A native key bridge of our own.** Intercept `dispatchKeyEvent` in the
   Activity and emit to JS from the Kotlin module this project already owns and
   builds. Keeps the focus model, the scorer and every test unchanged; depends
   on no RN feature flag and no native focus. It is the same reasoning that
   keeps `Capabilities.kt`: own the native seam where RN's abstraction does not
   serve a television.
2. **Native focus owner + `enableKeyEvents`.** One invisible permanently-focused
   `View` at the root, the flag turned on natively, and `onKeyDownCapture`
   feeding `tvFocus.handle()`. Also keeps the scorer, but rests on a flag that
   defaults false and on holding native focus forever — and the flag must be set
   from Kotlin anyway, so it is not less native work.
3. **Adopt Android's focus engine**, abandoning the ported scorer. Cheapest in
   code and the worst fit: the requirement is that this client navigates *like
   the web TV client*, which is the whole reason the scorer was ported and
   pinned by tests.

**A latent bug to fix whichever path is taken:** the legacy helper emits for
both `ACTION_DOWN` and `ACTION_UP`, and `useTvNavigation` reads only
`eventType`, never `eventKeyAction` (`useTvNavigation.ts:42-71`). Had the old
path ever worked, every press would have moved focus **twice**. Nothing on
hardware could have revealed this until the input works.

### 1.2 The 5.1 downmix measurement — the one that tests the premise

`verify-on-device.sh audio`. Criteria are fixed in advance in `HISTORY.md` so
the standard cannot be set after seeing the result. Three things must hold: a
platform E-AC-3/AC-3 decoder (not AAC), 6 channels reaching AudioTrack, and a
**positional** channel mask rather than the `0x8000003F` index mask.

If the first two hold but the mask is an index mask, this client is
direct-playing correctly and the set still cannot fold down — which is **core's
speaker-layout gap, not a defect here**. Core wants the answer either way; a
clean positional mask points the other way and is worth as much.

Owed to: the NPM session, the site session (it changes a published sentence),
and this repo's own README premise.

### 1.3 Decoder instance limits

**Promoted: this is now on the critical path for §2.1**, which is
non-negotiable. `MediaCodecInfo.CodecCapabilities.maxSupportedInstances` per
codec. Cheap, and it decides whether the **no-shutter** tier of seamless
failover is available: a standby that has rendered a first frame needs its own
surface, so two concurrent decoder sessions, and if the panel allows only one
HEVC decoder then the standby fails to allocate exactly when it is most needed.

This gate applies the same way whether the standby is a second `VideoPlayer`
(`expo-video`, buildable today) or a second `ExoPlayer` (native engine). Neither
the fetch preflight nor the buffer-only degraded tier allocates a decoder, so
both are unblocked either way; this measurement decides only whether the
seamless-with-no-shutter variant is available on top.

`verify-on-device.sh instances` reads it where the platform populates it. Where
it does not, the honest answer is "unknown" and the fallback is to attempt a
second allocation in the app and observe — which is app work, not a shell check.

### 1.4 Wire-verify "no custom headers"

`verify-on-device.sh headers`. Currently source-verified only: one
`setDefaultRequestProperties` call forwarding `PlaybackSource.headers` verbatim,
no `X-`/`Macha-` literals, nothing branching on a response header. Media3 also
sets its own `User-Agent` and range headers, which are real traffic and neither
custom nor ours. Capture a real fragment request and tell the NPM session, who
is tracking this across all four clients.

### 1.5 Confirm audio focus on hardware

**This item inverted when §2.0 landed.** It used to read "confirm media3 keeps
ducking as a separate multiplier, unlike `expo-video`". We are now *on*
`expo-video`, so the thing to measure is its known-worse behaviour:
`AudioFocusManager.kt:205` halves `player.volume` on a transient duck and
restores from its own `userVolume`. The question is whether repeated ducks
compound on this set, and whether a restore is ever missed — which would leave
a viewer at half volume with no way to tell why.

The phone session was told the *old* claim, flagged as unconfirmed. It is no
longer this client's position and they should be told so.

### 1.6 First real output from the platform-surface probe

Now core's, and it has produced no runtime truth on any host. Its first output
comes from the Settings screen here. A required member reported absent is a
finding for core, not a defect in this client.

**Three probes are missing and should be added before that first run** — raised
by the core session 2026-09-12, verified here the same day. `titleIndex.ts` uses
`Intl.Collator('en', { sensitivity: 'base', numeric: true })` (`:12`),
`.normalize('NFKD')` (`:23`) and `/\p{M}/gu` (`:11`); `platformSurface.ts`
probes none of the three. Hermes has shipped all three partially at different
versions — `Intl` options are the usual casualty — and a `Collator` that ignores
`numeric` or a `normalize` that no-ops degrades quietly into **wrong sort order**
rather than an exception.

This is not abstract here: `sortMediaByIndexedTitle` and `availableAlphabetKeys`
are what §4.3's `AlphabetIndex` is built on, so the strip would silently index
the wrong letters. Getting the probe extended first means one device run answers
both questions.

---

## 2. Required feature work

### 2.0 The player is `expo-video` for now

**Tom's decision, 2026-09-10.** Playback moved from the native
`modules/macha-player` engine to `expo-video`, the component the phone client
already uses and the only one in this project proven to actually play. The
reasoning is that this client has never been run, so the shortest path to a
picture on the screen — and therefore to §1.2, the measurement the whole project
exists to make — is the proven component, not the unproven one.

**The premise is unaffected.** `expo-video` is Media3/ExoPlayer underneath, so
it reaches the panel's own decoders and can direct-play E-AC-3 exactly as the
native engine would. §1.2 is runnable against it.

**Capability detection deliberately did *not* move.** `MachaPlayer.capabilities()`
still reads `MediaCodecList` through the native module, because `expo-video`
exposes no codec enumeration whatever — verified, zero hits for `MediaCodecList`
in its Android source. The phone client answers this from a hardcoded list, and
copying that here would make the node transcode AC-4, AV1 and Dolby Vision the
panel decodes natively. `Capabilities.kt` and `PlayerEngine.kt` are independent,
so keeping the reader costs nothing.

**What this knowingly gives up while it stands**, so none of it is rediscovered
later as a bug:

- **Byte-level source control is lost.** `expo-video` builds its
  `OkHttpDataSource.Factory` internally (`utils/DataSourceUtils.kt:19-45`, a
  top-level function making a fresh `OkHttpClient`) with no injection point, so
  nothing can reach into the transport the way `PlayerEngine.kt` could.

  **This does *not* block seamless failover — an earlier version of this bullet
  said it did, and that was wrong.** It reasoned from the data-source layer to a
  conclusion about the player layer. Handover does not live in the transport; it
  lives in `VideoView`'s player slot, and `expo-video` supports it deliberately.
  See §2.1, which is now a build, not a wait. What is genuinely lost here is
  narrower: per-request control (the hold-aware `500` retry below) and HTTP
  status reporting.
- **Failure evidence is weaker.** `expo-video` reports no HTTP status, so
  `playbackFailureKindForStatus` cannot be applied and the honest kind is
  `unknown`. The native engine reported the status and let core apply its own
  rule.
- **Hold-aware loading is gone, and this is the loss most likely to bite.**
  `PlayerEngine.kt:450` retried an HTTP `500` on the *same* node with
  exponential backoff, because `500 segment_not_ready` is the node stating it is
  already working on a fragment it promised — failing over cannot help, since no
  other node has that fragment either, and the replacement starts a cold
  generation from nothing. `expo-video` has no such rule: a `500` surfaces as a
  terminal player error, this adapter reports it as a failure, and core walks to
  another node. **Expect spurious failovers under load**, and expect them to
  look like node faults rather than like this decision. If §1.2 turns up
  unexplained mid-playback failovers, look here first. The web client solves
  the same problem in JS (`NATIVE_HLS_FIRST_FRAGMENT_TIMEOUT_MS` and its
  readiness walk), which is the shape of a fix if one is wanted without
  returning to the native engine.
- **Ducking mutates user volume.** `AudioFocusManager.kt:205` does
  `player.volume /= 2f` and restores from its own `userVolume`, rather than
  keeping ducking as a separate multiplier. This is the phone client's known
  behaviour, now inherited. §1.5 changes meaning accordingly: it is no longer
  "confirm media3's contract holds" but "measure how bad this is".

**`ExoPlayerAdapter` and `PlayerEngine.kt` stay in the tree, unused.** This is
explicitly a *now/later* decision: revisit once §1.2 has an answer. Deleting
them would make the revisit a rewrite.

Two things came free with the move, both bearing on §2.3: `expo-video` exposes
`availableAudioTracks` / `availableSubtitleTracks` with selection, which the
native engine did not, and `keepScreenOnWhilePlaying` replaces the manual
`FLAG_KEEP_SCREEN_ON` handling.

### 2.1 Seamless failover — required, and buildable now

**Non-negotiable. Tom, 2026-09-12: "The literal reason this repo exists is to
have this."** It is already working in `macha-client` and confirmed by Tom on
the Samsung set.

**It is buildable on `expo-video` today.** This section previously said the
opposite — that it was blocked until the native engine returned — and that was
the *third* wrong claim about this feature (see the history below). It was wrong
because it inherited §2.0's layer mistake: no injection point in the data-source
factory is true, and irrelevant to handover.

What the `expo-video` source actually provides, read on 2026-09-12:

- **`createVideoPlayer` is exported**, so a second `VideoPlayer` is a
  first-class object, not a hack.
- **`VideoView.videoPlayer`'s setter (`VideoView.kt:125-145`) is a handover.**
  It reads `newPlayer.firstFrameEventGenerator.hasSentFirstFrameForCurrentMediaItem`
  and sets `shouldHideSurfaceView = !hasEmittedFirstFrame`. Swap in a player
  that has **already rendered a frame** and the shutter never closes.
- **`onSourceChanged` (`VideoView.kt:290-299`) proves the intent.** It hides the
  surface *only* when media is replaced on the **same** player, with a comment
  citing expo issue #44385 about a stale mis-scaled frame. The two cases are
  distinguished on purpose; the cross-player case is the one we want.

**The one real constraint:** `hasSentFirstFrameForCurrentMediaItem` can only be
true if the standby has had a surface to render into. So the no-shutter path
needs the standby attached to an off-screen or alpha-0 `VideoView` —
`expo-video` already does `playerView.videoSurfaceView?.alpha = 0f` for its own
fullscreen transitions, so the technique is in-house. That means **two
concurrent decoder sessions, which puts §1.3 back on the critical path** exactly
as it gates the native-engine variant.

**The degraded tier is still worth having**, and it is unconditional: prime the
standby with no surface, pre-pay the buffering — the dominant cost, since
promotion itself measured 3 ms — and accept a brief shutter on the swap. That is
still far better than a cold endpoint walk, and it is not gated on §1.3.

Everything below was written for the native engine and still describes the
design; read "prime a second `ExoPlayer`" as "prime a second `VideoPlayer`". This was written down twice before and wrong
both times: first as "deliberately not doing" on the strength
of the phone client's measurement, then as "the only client that can do it" —
which was asserted without looking at the web client at all. The web client
implements both hooks and Tom confirms it works on the Samsung set. So this is a
**port against a working reference**, not a design to invent; the reasoning that
survives is preserved in `HISTORY.md`.

**Cold recovery and warm promotion are not the same cost.** The phone session
measured 7–8 s to admit a replacement — almost all of it the endpoint walk
trying a non-answering candidate — against ~1 s to prime a player, and concluded
the win is in the walk. True for a *cold* failover, where the walk has yet to
happen. Not true for a **warm standby**, which is what `PlaybackCoordinator`
prepares and what the watchdogs here made reachable: the walk is already paid,
promotion itself was measured at 3 ms, so player priming is very nearly *all*
the remaining visible cost. That is exactly what this removes.

Among the React Native clients the seam exists here alone — `expo-video` builds
its `OkHttpDataSource.Factory` internally with no injection point, while
`PlayerEngine.kt` builds its own and owns its `ExoPlayer` instances outright.
The web client has its own seam and already uses it; the phone client is the one
that cannot.

Design direction, using hooks core already provides:

- **`Player.preflightSource(source)`** — "validate a transformed source without
  replacing the active presentation". `macha-client` implements this as
  `preflightWebHlsSource` (`src/platform/WebPlatform.ts:110`): walk the manifest
  at most one variant deep, then `Range: bytes=0-65535` each media target and
  require that bytes actually arrive, under a 5 s abort. **No decoder is
  involved.** Two strategies are therefore open here, and they differ in what
  they cost and what they prove:
  - **Port the fetch preflight.** Cheap, proven, and it does not allocate a
    decoder — so §1.3's instance limit stops gating it entirely. Proves the node
    will serve bytes, not that Media3 will decode them.
  - **Prime a second paused `ExoPlayer`.** Proves "this will play" and pre-pays
    the buffering that promotion would otherwise cost, which was the original
    point. Costs a concurrent decoder session, so it stays gated on §1.3.

  These are not exclusive: the fetch preflight is the fallback where a second
  decoder cannot be allocated. Start from the ported one, since it is the half
  that is known to work.
- **Promotion** — recognise that `play()` has been handed the already-primed
  source and perform a **surface handover** (`playerView.player = standby`)
  rather than loading it again. The swap is cheap; the buffering is what costs,
  and it has already been paid.
- `addDirectSourceAlternative` is the related hook for the Direct Play
  byte-source case; the web client implements it too
  (`WebPlatform.ts:685` → `addDirectPlayReadAheadAlternative`), so read that
  before writing anything. Do it at the same time.

Order: read the web implementation first, then port the fetch preflight, then
the handover, then verify against a deliberately stopped node — **which is the
same test as §2.2**, so they are one piece of work. §1.3 only gates the
second-`ExoPlayer` variant, so it no longer blocks starting.

**Tiers 1 and 2 landed 2026-09-12.** `preflightSource` walks the node
(`src/player/preflight.ts`), and passing that walk now also primes a second
`VideoPlayer`, which a later `play()` for the same URL promotes by handing the
surface over instead of reloading (`ExpoVideoAdapter.promoteStandby`).

**Tier 3 is what remains here**, and it is one change: give the standby an
off-screen or alpha-0 `VideoView` so it renders a first frame, which flips
`hasSentFirstFrameForCurrentMediaItem` and holds the shutter open through the
swap. **Gated on §1.3**, which is also the measurement that tells us whether
Tier 2 is already paying a decoder session — a surfaceless prepared player may
or may not allocate one, and that is not answerable off-device.

Two things about Tier 2 to carry into the device session:

- **Expect a brief black frame on promotion.** The standby has never rendered,
  so `VideoView`'s setter closes the shutter over the swap. That is the tier's
  known cost, not a fault.
- **The retired player is released by presentation, not by the swap.** The swap
  notifies through a React state update and React commits after the current
  task, so releasing inside the swap would destroy a player the mounted
  `VideoView` still holds. `PlayerScreen` calls `releaseRetiredPlayer()` from an
  effect keyed on the player instance; `stop()` and `detach()` are the backstop.
  If a promotion ever leaves a dead surface, this ordering is the first place to
  look.

### 2.2 Does a promoted standby actually play?

Unverified **here**, and the earlier "unverified on any client" was wrong for the
same reason §2.1 was: `macha-client` does this and Tom confirms it works. The
phone client saw one promote in 3 ms onto a dead session and has withdrawn its
explanation, so what remains unknown is that client's failure, not the mechanism.

Wiring the watchdogs made promotion reachable here, so the open question is
narrow: does a standby promoted by *this* client play. The web client is the
control — if it works there and not here, the difference is in `PlayerEngine`,
not in core or the cluster.

Watch for a standby holding a node's only transcode slot (`max_video_transcodes`
is 1) for up to the 30 s window — a cost independent of pipeline reclaim, and
one nobody had named until the phone session raised it.

**Half of that cost was a core defect and is now fixed** (core session,
2026-09-12, unreleased on top of 0.7.0). `PlaybackCoordinator.promoteReadyAlternate`
passed a *fresh* record to `beginSupersededCleanup`, which only acts on the
record it already owns — so the call was a no-op and **the promoted-*from*
session was never closed**. A node counts that session against
`max_video_transcodes` until `session_idle` at 30 minutes, so on this one-slot
cluster every promotion permanently stranded the slot it walked away from.

Observable here as **one additional `resolver.stop` after a promotion**, which
is worth watching for specifically, since it is the cheapest confirmation that
promotion is doing the whole job. It matters more to this client than to the
peers: §2.1's standby is a *second* concurrent session, so the arithmetic on a
one-slot node only works if the old session actually goes away.

### 2.2b Two core hazards that land on the D-pad — raised 2026-09-12

From the core session's review (`macha-ts/TODO/REVIEW-2026-09-12.md`), both
**verified against core's source here** rather than taken on report. Neither is
fixed in core yet, and both bear directly on §2.1.

**The stall watchdog never re-arms after a suspend.** `MediaStallWatchdog.suspend()`
(`MediaWatchdog.ts:352`) disarms the deadline, and only `note()` re-arms it — but
`note()` returns early unless the position or buffer **advanced**
(`MediaWatchdog.ts:333-340`). So: pause, the node dies while paused, resume, and
nothing ever advances, so nothing ever re-arms. **A frozen frame sits there
indefinitely with the whole failover apparatus disarmed.** We wired both
watchdogs precisely so `prepareAlternate` was reachable; this is the case where
that wiring silently does nothing.

**A backward seek can evict a healthy node.** `note()` keeps the buffer baseline
as a running max — `this.lastBufferedEndMs = Math.max(bufferedEndMs, ...)`. After
a backward seek the reported buffer end drops below that high-water mark, so
`advanced` stays false against a node that is working fine, and a below-realtime
but healthy transcode is condemned at the stall deadline.

**This is worse on a television than anywhere else.** A D-pad *is* the seek
affordance — `PlayerScreen.nudge()` (`:123-132`) commits a `runtime.seek` after
every rewind burst — so this client generates backward seeks as ordinary
viewing, not as an edge case. Web and phone have scrubbers a viewer touches
rarely; here, rewinding is how anyone watches anything.

Both belong to core and the fix is core's. What this repo owes is the
observation that a D-pad client meets them constantly, and a note against §1.2:
**if the 5.1 session shows unexplained mid-playback failovers, this is the third
candidate cause** after §2.0's missing hold-aware retry and a genuine node
fault. A rewind immediately before the failover is the tell.

### 2.3 Player options

`PlayerOptions` in the web chrome: audio and subtitle track selection, and mode
override. **The largest functional gap in the player.** The chrome currently
displays the chosen instruction but cannot change it — and forcing a mode by
hand is how a downmix problem gets isolated, so this is likely to be wanted
*during* the 5.1 work rather than after it.

### 2.4 Optional `Player` methods not implemented

Implemented: `detachHost`, `subscribeFailure`, `subscribeDegradation`, and now
`setSubtitle` — `expo-video` exposes track selection, so it came free with §2.0.
Missing, each with a real cost:

- **`prepare(profile)`** — core calls it to start capability detection off the
  Play critical path and to do local setup from advisory facts. Nothing calls
  `runtime.prepare()` today, so every play pays that cost inline.
- **`preflightSource`** — **done, 2026-09-12.** `src/player/preflight.ts`,
  wired in `ExpoVideoAdapter`, 27 tests. Tier 1 of §2.1.
- **`addDirectSourceAlternative`** — **not a port, and needs a decision.** The
  claim above that "nothing in it needs player internals" was checked and is
  wrong: the web client's implementation
  (`directPlayReadAhead.ts:300`) is built on a **Service Worker**. It registers
  a source key, hands the player a proxy URL on its own origin
  (`buildDirectPlayReadAheadProxyUrl`), and the worker fails byte-range requests
  over to whichever node in the set is answering. The player never knows.

  There is no Service Worker on React Native, and `expo-video` fetches its own
  bytes. The shape is reproducible — give the player a URL we control — but on
  this platform that means **running a local HTTP proxy inside the app**, which
  is real new infrastructure rather than a port. On the native engine it is
  straightforward instead: `PlayerEngine.kt` owns its `DataSource.Factory`, so a
  resolving data source covers it.

  So this one is genuinely a §2.0 consequence, unlike `preflightSource`. It is
  **decide** rather than **do**: local proxy, or wait for the native engine.

  It matters more here than the ordering suggests, because it only applies to
  `mode: 'direct'` — and direct play is the *expected* case on a panel that
  decodes E-AC-3 natively, which is the whole premise. Degradation is graceful
  either way: without the hook the coordinator falls through to the ordinary
  reactive standby path (`PlaybackCoordinator.ts:1310`), so direct sources still
  get a warm standby, just not silent byte-level failover.

`setSubtitle` is implemented but **narrower than the name suggests**:
`expo-video` selects among tracks the manifest already carries and cannot
side-load a subtitle URL, so a URL with no matching track leaves selection
unchanged rather than silently clearing it. Whether core ever hands us a URL
that is not in the manifest is untested.

### 2.5 Stores constructed but unused

`PlaybackQueueStore` and `VolumeStore` are both built in `MachaProvider` and
never read. That is dead wiring until:

- **queue** — episode-to-episode continuation, next/previous in the chrome;
- **volume** — there is no volume affordance in the player chrome at all,
  though `PlayerIcons.tsx` already carries the unused `volume` and `mute` icons.

`MusicPlaylistStore` is the third of core's stores and is not constructed at
all. Full accounting in §4.5.

---

## 3. Decisions for Tom

### 3.1 Focus-scoring duplication

`src/hooks/tvFocus.ts` is a hand-port of the web client's scorer, and the two
must agree or the TV clients navigate differently. Core **refused** it, rightly:
its scope is "everything a client does that is not presentation", and geometry
deciding what a viewer looks at next is presentation.

**Decided, Tom, 2026-09-12: accept the duplication. No `@macha/tv` yet.**

The two scorers were compared on the day of the decision and are identical line
for line — `../macha-client/src/hooks/useTvNavigation.ts:87-108` against
`src/hooks/tvFocus.ts:71-95`: the same `±1` deadzone, the same
`secondary * 0.2` cross-axis discount, the same `laneGap * 6` lane penalty, and
a matching `sequentialCandidate`. So there is nothing to reconcile today; the
cost of the decision is only that it must stay that way.

**The asymmetry to know about:** all three constants are pinned by named tests
here (`tvFocus.test.ts`), but the web client's `scoreTvCandidate` is
module-private and not directly unit-tested — its coverage goes through
`attachSpatialTvNavigation`. A drift is therefore loud on this side and quiet on
theirs, which means **this repo's tests are the shared guard**. Change a weight
here and a test fails; change one there and nothing does.

Revisit `@macha/tv` if a third TV surface appears, or if the weights ever need
to diverge per-platform — at which point the package is the honest answer rather
than a second hand-port.

### 3.2 Is this a git repository?

It is not — no `.git`, no commits, no remote. The site session has published a
section saying outright that it is not fetchable, with precedent (`macha-ts` and
`macha-client-rn` appear there without links). An initial commit was offered and
not made, because it was not asked for.

---

## 4. Parity with `macha-client` — the complete list

This is the whole distance from here to **a working application with the same
functionality as the web client**. It is an enumeration, not a recollection:
every row was read off `../macha-client` on 2026-09-10 — its route table
(`src/App.tsx:520-550`), `src/components/`, `src/hooks/` and
`src/screens/player/` — and checked against this tree. The route count is 31
declared, less the `*` catch-all and the two pure redirects (`/music`,
`/settings`), so **28 real destinations**. The previous version of
this section was written from memory and was wrong in both directions — §2.1's
mistake in a different place.

**Two rules govern everything below.**

1. **Take it from the NPM module.** Anything that is not presentation is already
   in `@macha/core` and must be consumed, not rewritten. That is Tom's standing
   rule and it is what makes this list far shorter than its length suggests.
2. **Presentation is the only thing genuinely missing.** Having gone through
   core's exports, there is **no gap below that needs a new data layer.** Search,
   music, status, alphabet jumping and endpoint editing all have their logic
   shipped and tested in core already; what is absent here is the D-pad surface
   in front of them.

### 4.1 Screens — 9 of the web client's 28 routes, plus 1 partial

| Web route | Here | What core already gives us |
| --- | --- | --- |
| `/` Home + Continue Watching | **yes** | `ContinueWatchingStore`, `recentMedia` |
| `/movies`, `/series` libraries | **yes** | `MediaApi`, `titleIndex` |
| `/movies/:id`, `/episodes/:id`, `/items/:id` detail | **yes** | `MediaApi`, `MediaTechnicalProfile` |
| `/series/:id`, `/series/:id/seasons/:id` | **yes** (season folded into `SeriesScreen`) | `MediaApi` |
| `/play/:id` player | **yes** | `PlaybackCoordinator`, `PlaybackRuntime` |
| `/settings` | **partial** — displays, cannot edit | `MachaServerApi`, `connectionConfiguration` |
| `/search` | **no** | `MediaApi.search()` (`src/api/MediaApi.ts:14`) — the query side is done |
| `/music/artists`, `/albums`, `/tracks` | **no** | `MediaApi`, `MusicPlaylistStore` |
| `/music/artists/:id`, `/music/albums/:id`, `/music/tracks/:id` | **no** | as above |
| `/music/playlist` | **no** | `state/musicPlaylist`, `state/playlist` — reorder, remove, clear all shipped |
| `/status`, `/status/client`, `/status/connectivity` | **no** | `ClusterStatusApi`, `ClusterStatusRouter` |
| `/status/nodes/:id` | **no** | `ClusterStatusApi` |
| `/connection` endpoint gate | **no** | `connectionConfiguration` — `shouldEnterConnectionGate`, `normalizeConnectionEndpoints` |
| `/manage`, `/manage/files` | **decide** | `ClusterManageApi` |
| `/items/:id/edit` metadata editor | **decide** | `ClusterCatalogueApi` |
| `/ingest` | **not doing** — Tom, 2026-09-10 | — |
| `/sponsor` | **not doing** — Tom, 2026-09-10 | — |

**Search is the most conspicuous absence for a viewer**, and it no longer needs
a design: **use the television's own on-screen keyboard.** Tom's decision,
2026-09-10. A React Native `TextInput` maps to an Android `EditText`, and
focusing one on Android TV raises the platform IME — the leanback keyboard the
viewer already knows from every other app on the set, with its own voice input.
Drawing our own would be worse and larger. Everything behind the field is
`MediaApi.search()`.

There is **one real integration point**, and it is in this repo rather than in
the keyboard: while the IME is open it owns the D-pad, but
`useTvNavigation` attaches `useTVEventHandler` once at the app root and has **no
way to be suspended** (`src/hooks/useTvNavigation.ts:22-37` — the options are
`onBack`, `onPlayPause`, `onRewind`, `onFastForward`, `onStop`, and nothing
else). Left as is, the focus scorer would keep moving selection behind the open
keyboard. Adding a suspend is small, and it is the first thing Search needs.
`Focusable`'s existing `ownsDirection` is the narrower alternative if a
whole-registry suspend proves too blunt.

**Music is seven routes**, the largest single block, and none of it is started.

**Not doing** (Tom, 2026-09-10): `/ingest` and `/sponsor`. Kept as rows so the
list stays a complete accounting of the web client and neither gets re-proposed
as an oversight.

The two still marked **decide** are the "is this TV work at all" question — a
10-foot UI is a poor place to retag a film.

### 4.2 Player chrome — 5 of the web client's 12 controls

Built: restart, rewind, play/pause, forward, close, plus the scrubber with a
buffered range (`PlayerScreen.tsx:194-231`).

Missing:

- **Options** (`PlayerOptions.tsx`) — mode override, quality, **audio track**,
  **subtitle track**, and source switching where `canSwitchMedia`. This is §2.3
  and the largest functional gap in the player.
- **Previous / next** — needs `PlaybackQueueStore`, which is §4.5.
- **Volume slider and mute** — needs `VolumeStore`. The icons already exist
  unused in `PlayerIcons.tsx` (`volume`, `mute`).
- **Mini player** (`.player-presentation-mini`) and its minimise/expand pair —
  title, subtitle, elapsed time, progress bar and transport.
- **Failure trail** (`screens/player/failureTrail.ts`) — the per-endpoint account
  of why playback failed. Worth more on a television than on the web, since there
  is no console to inspect.
- **Seek acceleration** (`screens/player/seekAcceleration.ts`) — a held D-pad
  seek that speeds up. Web has it for TV keys; here it is arguably *more*
  needed, since a D-pad is the only input there is.
- Fullscreen is **not applicable** — a TV app is always fullscreen.

### 4.3 Components — 8 of 21 ported

Ported: `MediaCard` (with progress foot), `MediaRow`, `Status`, `PlayerIcons`,
**`LazyArtwork`** (2026-09-12), plus TV-only `Focusable`, `TopBar` and
`EpisodeCard`.

**What `LazyArtwork` does and does not cover.** It handles the signed-capability
path: node failover on a refused image, and a memory of the URL that last
loaded so the server re-signing on every catalogue fetch does not churn
`expo-image`'s cache key and re-download every poster on every revisit. It does
**not** cover the authenticated fallback — an `ArtworkRef` with no `url` at all,
which the web client fetches as a `Blob` through `useArtworkUrl` and
`fetchArtworkWithRetry`. Those refs render as the letter placeholder here. That
is the honest remaining part of §4.4's artwork group, and it needs a different
implementation anyway: `URL.createObjectURL` does not exist on this platform, so
the RN shape is a fetch to a data URI or a cached file.

Missing, in the order they matter on a D-pad:

- **`AlphabetIndex`** — jump-to-letter. Matters far more with a D-pad than a
  pointer, because scrolling a long library one focus step at a time is the
  worst thing on this platform. **Core ships the whole mechanism**: `ALPHABET`,
  `availableAlphabetKeys`, `sortMediaByIndexedTitle`, `compareIndexedTitles`
  (`macha-ts/src/titleIndex.ts`). Only the strip is missing.
- **`OverflowMenu`** and **`Modal`** — every "add to playlist / play next / play
  later" affordance in the web client hangs off these, so music depends on them.
- **`CardCloseButton`** — remove an item from Continue Watching. Currently there
  is no way to dismiss a finished or abandoned film from the home row.
- **`MediaPageTitle`** refresh affordance, **`LazyArtwork`** retry behaviour
  (`hooks/artworkRetry.ts`), **`EpisodeRail`**, **`SectionNav`**, **`MusicNav`**,
  **`StatusNav`**, **`ConnectionForm`**, **`DeviceCapabilities`**,
  **`AsyncIconButton`**, **`EditButton`**, **`AppLogo`**, **`ManageNav`** /
  **`ManageIcons`** (the last two only if §4.1's two remaining *decide* rows are
  taken).

### 4.4 Hooks — 3 of 9 ported

**Corrected 2026-09-12**: this section listed `useRefreshableAsync` as missing
and counted `tvFocus` — which is ours, not the web client's — among the nine.
`useRefreshableAsync` has been present all along in `src/hooks/useAsync.ts`
(not a file of its own, which is how it was missed) and is used four times
across `HomeScreen`, `LibraryScreen` and `SeriesScreen`. The total of three was
right by coincidence; the composition was wrong.

Ported: `useAsync`, `useRefreshableAsync`, `useTvNavigation`.

Missing: **`useArtworkUrl`** / **`useViewportArtworkUrl`** / **`artworkViewport`**
/ **`artworkRetry`** (20 uses — but see §4.3, most of what they are *for* is now
covered differently), **`usePollingTask`** (7 — status screens need it),
**`useAlphabetIndex`** (6).

### 4.5 Core stores — 3 constructed, 1 wired

`ContinueWatchingStore` is used. `PlaybackQueueStore` and `VolumeStore` are
constructed in `MachaProvider.tsx:94-95` and never read — dead wiring until
§4.2's transport and volume land. `MusicPlaylistStore` is **not constructed at
all** and is needed by every music route.

This is the clearest illustration of rule 1 above: all four stores are core's,
already written and already tested, and the work here is to render them.
