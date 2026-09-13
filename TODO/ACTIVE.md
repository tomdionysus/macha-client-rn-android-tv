# Active

Open work on the Macha Android TV client. What has landed is in
[`COMPLETED.md`](COMPLETED.md), **including the mistakes** — read those before
re-deriving anything. Reasoning lives in [`../docs/HISTORY.md`](../docs/HISTORY.md);
conventions and traps live in [`../AGENTS.md`](../AGENTS.md).

---

## 0. Where this stands

**It runs.** Installed on the TCL and launched; it renders the library and
reaches the cluster. Screenshots in [`../docs/evidence/`](../docs/evidence/).

**A film has played, and §1.2 is answered.** On 2026-09-13, 0.3.2 on the TCL:
*28 Years Later*, `matroska / direct / video copy / audio copy`, running past
7 minutes, with an **active 6-channel AudioTrack on a positional `0x0000003F`
mask** — not the `0x8000003F` index mask. **The premise holds: this panel
direct-plays surround and folds down correctly.** Full reading in §1.2.

Still unexercised: no watchdog has fired and no failover has happened, so
every *failover* claim in this file remains unproven.

**The set is running 0.3.2**, installed and version-asserted 2026-09-13.
Verified on it: the login wall, signing in through the platform IME, D-pad
navigation, the library, detail pages, Settings, and playback.

**The cluster requires an account**, and signing in **works**. `media_viewer`
is off `anonymous`, a session mints with `roles: []`, the wall appears, and
`tvtest` signs in through the platform IME to a full library. Confirmed on the
set 2026-09-13.

Getting there cost a P0: **the first version of `TvTextInput` bricked the
remote.** See §1.0.

### The single next action

When the television answers:

```sh
cd android && ./gradlew assembleRelease
```

```sh
TV=10.34.1.115:5555 ./scripts/verify-on-device.sh install
```

The install stage asserts the set is running the APK just built, comparing
`versionCode` and `versionName` against the artifact. If it refuses, do not
debug against that install.

Then, in order: sign in through the on-screen keyboard (§1.0), confirm a Down
press enters the Movies row (§1.1), and start a film for §1.2.

**A credential is needed and this session never had one.** Anonymous has no
roles, so nothing here can drive an authenticated request — that blocked the
`MODE_TRANSFORMS` test too (§2.3).

### Reaching the device

- The TCL is on `10.34.1.x`, port `5555`. **Its address is DHCP and it moves** —
  it was `.115`, then `.116`. A moved set and a powered-off set look identical
  from outside, which cost a wrong conclusion on 2026-09-10.
- `10.34.1.50` (the site's cluster node, API on `:7438`) is the control for *is
  the site reachable*, not for which address the set holds. A `401` from
  `/api/v1/server/info` means the node is alive.
- **The link to that site is unreliable.** It dropped three times during the
  2026-09-12 session, twice taking the cluster node with it. Expect to retry;
  never read a single failure as the set being off.
- Confirm the device before installing: `getprop ro.product.manufacturer` must
  say TCL. It is `armeabi-v7a` only.
- **To find it when the address has moved**, sweep and then try adb:

  ```sh
  for i in $(seq 100 140); do (ping -c 1 -W 900 10.34.1.$i >/dev/null 2>&1 \
    && echo "10.34.1.$i alive") & done; wait
  ```

  On 2026-09-13 that found `.103`, `.115` and `.132` alive; `.103` and `.132`
  actively refused `5555` so they are other devices, and `.115` timed out rather
  than refusing — which is the shape of the set with adb not yet listening, or
  of the link dropping mid-attempt. Unresolved: the site went down again during
  the check.
- The set's screensaver takes the foreground while idling. Wake, foreground the
  app and act in one pass rather than leaving gaps.

### Two standing rules

- **Take everything possible from `@macha/core`.** Anything that is not
  presentation is already in the NPM module and is to be consumed rather than
  rewritten. Where this list names a gap, it also names what core provides.
- **Claims about other codebases get read, not remembered.** Every cross-repo
  assertion here has been wrong at least once — see `COMPLETED.md`. Open the
  peer before writing "only", "never" or "nowhere else".

---

## 1. Blocked on the television

Ordered by consequence. Nothing here moves until the set answers, and §1.1
gates the rest because everything else needs a navigable app.

### 1.0 Sign in through the on-screen keyboard — done 2026-09-13

**Works, and finding out cost a P0.** `tvtest` signs in through the platform
IME to a full library. Typing, the focus suspension, and the return to
navigation are all exercised on hardware.

**The P0, because it will be tempting to write this code again.** `TvTextInput`
took a `tvFocus.suspend()` on `TextInput.onFocus` and released it on `onBlur`.
On Android TV **`onBlur` never fires**: the leanback IME closes as its own
window while the `ReactEditText` underneath keeps native focus. Measured on the
set: `mInputShown=false` with `mServedView` still pointing at the field. So the
suspension was held for the life of the process, `useTvNavigation` returned
early on every key, and **after typing once the D-pad did nothing at all** — on
a screen whose only other control is a second text field. Nothing on screen
said why; only restarting the app cleared it.

Fixed in 0.3.1, three ways, because the consequence is out of all proportion to
the cause:

- release on `keyboardDidHide` and blur the field, since `onBlur` will not come;
- release on unmount — the token lives in a ref, so nothing else can ever reach it;
- **a backstop in the key path**: if the registry is suspended while
  `Keyboard.isVisible()` is false, the suspension is stale, so `resumeAll()`
  clears it and the key is handled. Reference counting cannot recover from a
  lost token by construction, and the failure is a television whose remote has
  stopped working.

Still unverified: **Back from the login returning from Settings**, and **that an
unreachable cluster shows the offline screen and not the wall.** The second is
still the one worth causing deliberately.

### 1.1 D-pad navigation — done 2026-09-13

**The ported scorer has now chosen candidates on this panel.** Down enters the
Movies row, Up returns to the nav bar, Left/Right move along both, the row
scrolls the focused card into view, and the player controls take focus. Tom
confirms the physical remote navigates the set.

**A second focus defect was found and fixed on the way** (0.3.2), separate from
§1.0's. `tvFocus.handle()` asked `current()` for a fallback when `selectedId`
named nothing reachable — after a scope change, or after the screen owning the
selection unmounted — then computed the move *from* that fallback without ever
selecting it. So a direction with a candidate silently skipped the first
element, and **a direction with no candidate returned false, leaving the screen
with no selection and no focus ring at all.** Reproduced on the library after
Back from a detail page: no ring anywhere, Up doing nothing however many times
it was pressed. The first press now reveals focus; the second moves it.

**Three navigation faults remain open**, all found on the set and none fixed:

- **Settings has no focus-follows-scroll.** The Diagnostics toggle sits below
  the fold; focus moves to it invisibly, the page never scrolls, and Down and
  centre then appear dead. The only escapes are Up and Back. `MediaRow` wires
  `onFocusChange` to scroll and this screen does not — which is why **the
  failure trail could not be switched on during the first playback session.**
- **The nav bar does not trap horizontal movement at its ends.** Right from
  "Settings" escapes into the poster row, because a card further right still
  scores as a valid candidate. Left from "Home" presumably does the same.
- **Back from a top-level screen exits the app** rather than returning to the
  previous route. Conventional on Android TV, but it means a stray Back during
  a test session drops out to the launcher — and `com.tcl.tv` is `FLAG_SECURE`,
  so screenshots silently come back empty when it does.

### 1.2 The 5.1 downmix measurement — ANSWERED 2026-09-13

**The premise holds.** *28 Years Later* on the TCL, 0.3.2, direct-played:

```
matroska / direct / video copy / audio copy      (the node's own per-stream answer)

Id 75  Active=yes  Client=2108  Chn mask=0000003F  SRate=48000  FrmRdy=21560  Underruns=0
Channel count: 6
Channel mask: 0x0000003f (front-left, front-right, front-center, low freq, back-left, back-right)
```

PID 2108 is `foundation.macha.client.tv`, so the active track is ours.

Against the three criteria fixed in advance:

| # | Criterion | Result |
| --- | --- | --- |
| 1 | platform E-AC-3/AC-3 decoder, not AAC | **inferred, not directly observed** |
| 2 | 6 channels reaching AudioTrack | **confirmed** |
| 3 | positional mask, not `0x8000003F` | **confirmed — `0x0000003F`** |

**Criterion 1 is honestly weaker than the other two and should be closed
properly.** `dumpsys media.codec` returned nothing and logcat had rotated, so
the instantiated decoder's *name* was never captured. What is known: audio is
`copy`, so nothing was re-encoded to AAC; six channels reach AudioTrack; and
the panel carries `OMX.realtek.audio.dolby.eac3.decoder` and
`OMX.realtek.audio.dolby.ac3.decoder`. Consistent with one story only, but
inference. Catch the decoder name on the next session.

**A prediction made from the capability panel did not come true, and the
reasoning is worth keeping.** `HLS AUDIO: aac` (§1.6) says the HLS delivery
path advertises AAC alone, so any surround title going over HLS *will* be
transcoded. That remains true — it simply did not apply, because the chooser
picked `direct` with a Matroska container and never went near HLS. The concern
is real for the HLS path and was stated too strongly as a prediction about this
title.

Owed to: the NPM session, the site session, and this repo's README premise.
**The answer is the good one** — a clean positional mask, so the set folds down
correctly and this client direct-played it.

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

**This item inverted when §2.0 landed.** It used to read "confirm media3 keeps
ducking as a separate multiplier". We are now *on* `expo-video`, so the thing to
measure is its known-worse behaviour: `AudioFocusManager.kt:205` halves
`player.volume` on a transient duck and restores from its own `userVolume`. The
question is whether repeated ducks compound on this set, and whether a restore
is ever missed — which would leave a viewer at half volume with no way to tell
why.

The phone session was told the *old* claim, flagged as unconfirmed. It is no
longer this client's position and they should be told so.

### 1.6 First real output from the platform-surface probe — partly done

**The capability panel has produced real numbers from this panel** (Settings,
0.3.2, 2026-09-13):

```
VIDEO       av1, h263, h264, hevc, mpeg2, mpeg4, vp8, vp9
AUDIO       aac, ac3, ac4, amrnb, amrwb, eac3, flac, mp3, opus, pcm, vorbis
CONTAINERS  mp4, m4v, mov, mkv, matroska, webm, avi, ts, mpegts, ps, mp3, m4a,
            aac, wav, flac, ogg, oga, opus
HLS VIDEO   h264, hevc
HLS AUDIO   aac
```

**`HLS AUDIO: aac` is the line that matters.** The panel decodes `eac3` and
`ac4` natively on the progressive path, but we advertise AAC alone for HLS
delivery — so any title the chooser sends over HLS will have its surround
transcoded, while a direct Matroska keeps it (§1.2). Whether that narrowing is
correct is `MachaPlayerModule.kt`'s claim that ExoPlayer's HLS path is narrower
than its progressive extractors; it is now worth testing rather than trusting,
because it decides transcode-or-not for every HLS title.

**Still not read: the `checkPlatformSurface` findings themselves.** The Settings
screen renders them below the capability block, and they were never reached —
see §1.1's scroll fault. The three `titleIndex` probes core added on this
client's prompt are in that block, so §4.3's `AlphabetIndex` still has no
runtime evidence behind it.

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

### 2.3 Player options — done 2026-09-13

Mode, quality, audio track, subtitle track and source switching, in a panel with
its own focus scope. Back closes the panel before the player.

**Unverified on hardware**, and worth exercising during §1.2: forcing a mode by
hand is how a downmix gets isolated, and the instruction notes under the mode
row are the only place on a television where a silently-transcoding library can
show itself.

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

Pushed to `git@github.com:tomdionysus/macha-client-rn-android-tv.git`.
**Visibility still unconfirmed** — `gh` is not available here to check.

It matters because the site session has published that this repo is not
fetchable, with `macha-ts` and `macha-client` as precedent. If it is public that
sentence is now wrong, and it is Macha UI Work's to correct rather than ours.

**Pushing is Tom's, never this session's.** Commit locally and hand over the
commands.

### 3.3 Are `/manage`, `/manage/files` and `/items/:id/edit` TV work at all?

The two remaining **decide** rows in §4.1. A 10-foot UI is a poor place to retag
a film. `/ingest` and `/sponsor` are already ruled out (Tom, 2026-09-10).

---

## 4. Parity with `macha-client` — the complete list

The whole distance from here to an application with the same functionality as
the web client. An enumeration, not a recollection: every row was read off
`../macha-client` and checked against this tree. The route count is 31 declared,
less the `*` catch-all and the two pure redirects, so **28 real destinations**.

**Two rules govern everything below.**

1. **Take it from the NPM module.** Anything not presentation is already in
   `@macha/core` and must be consumed, not rewritten.
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
- ~~**Failure trail**~~ — **done 2026-09-13**. `screens/player/failureTrail.ts`
  prints the last dozen warnings and errors under the failure message on the
  player. Off by default; the switch is the first editable control on the
  Settings screen. This client had never called core's `createClientLogger` at
  all, so the buffer it reads had to be wired too
  (`diagnostics/playbackLog.ts`, configured at `warn`).
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

### 4.5 Core stores — 3 constructed, 1 wired

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
