# Active

Open work on the Macha Android TV client. What has landed is in
[`COMPLETED.md`](COMPLETED.md), **including the mistakes** — read those before
re-deriving anything. Reasoning lives in [`../docs/HISTORY.md`](../docs/HISTORY.md);
conventions and traps live in [`../AGENTS.md`](../AGENTS.md).

---

## 0. Where this stands

**It runs.** On 2026-09-12 the client was installed on the TCL, launched,
rendered Home with real artwork, and reached the cluster at
`http://10.34.1.50:7438` — `route-success`, health `reachable: 3, known: 5`,
posters served from the node. Screenshots in
[`../docs/evidence/`](../docs/evidence/).

**Nothing has been played.** No film has started, no watchdog has fired, no
failover has happened, and §1.2 — the measurement this project exists to make —
is still open. Every playback claim in this file is unexercised on hardware.

**There is a build waiting to be installed.** The set is currently running the
2026-09-12 build, in which the D-pad moves focus in *registration order*
because the focus scorer never received any geometry. That is fixed, tested and
committed, but the link to the `10.34` site dropped before it could be
installed.

### The single next action

When the television answers:

```sh
cd android && ./gradlew assembleRelease          # the APK on disk may predate src/
TV=10.34.1.116:5555 ./scripts/verify-on-device.sh install
```

The install stage **asserts** that the set is running the APK just built,
comparing `versionCode` and `versionName` from `dumpsys` against the artifact.
If it refuses, do not debug against that install.

Then confirm a Down press from the nav enters the Movies row rather than moving
sideways along it. That one press is the whole verification of §1.1.

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

### 1.0b Cluster health, as of core on `develop` (2026-09-13)

Asked and answered by Macha NPM Core; **nothing here needs changing**, recorded
so it is not re-investigated.

- **Liveness is now `GET /api/v1/health`, unauthenticated and role-free.**
  Verified against `10.34.1.50`: `200 {"status":"ok"}` with no session. The old
  probe (`/api/v1/catalogue/status`) needs `media_viewer`, so under the roles
  model a session granted nothing would have had **every node marked failed on
  every cycle, permanently**. That is fixed in core, not here.
- **Nothing became sticky.** The cooldown ladder is unchanged (500 ms, 2 s,
  10 s, 30 s, recovery on the next good probe) and a probe failure does not
  displace the endpoint real traffic prefers. A `401`/`403` now records nothing
  in either direction — reached, nothing learned — rather than counting as a
  failure. For this client's link, which drops several times an hour, that is
  strictly better than before.
- **Keep the preflight.** Core's liveness asks "is this node serving at all",
  every ten seconds. `src/player/preflight.ts` asks "can this manifest and its
  segments actually be read before I promote this standby". A node can be
  perfectly live with a dead generation, which is the case failover exists for.
  No overlap, nothing to delete.
- **If endpoint health ever reaches a screen here, use `EndpointCandidate.ready`,
  never `health.retryAt`.** `retryAt` is a reading of `machaHost().now()`, a
  duration clock with an arbitrary origin, so comparing it against `Date.now()`
  compares two unrelated number lines. The web client's status screen has that
  bug today.

**One thing that is a decision rather than a defect**, raised and left with
Tom: `discoverClusterEndpoints` reads `/api/v1/status`, which needs
`view_status`. A no-roles session gets `403`, so it never learns cluster
membership or the self-reported capacity that rides on it — the failover pool
stays frozen at the bootstrap list. Harmless for a client that may play
nothing, except that **this is the login state**: the viewer must reach some
node to sign in, and liveness is the only grading available until they do.

### 1.0a Reported to core: refused is not unreachable

Raised 2026-09-13, not a task here and **must not be worked around here**.
`SessionManager` cannot tell "the server refused" from "we could not ask":
`mintNow`'s catch is bare, so a `403` from a node that answered in 40 ms
publishes "All configured API endpoints are unreachable", and
`authorization()` returns `undefined` for both cases.

`mintAnonymousSessionAnyNode` also stops at the first `403` as though it were
cluster-wide. For a credentialed sign-in that is right; for an **anonymous**
mint it is a node-level configuration fact, and during the rolling deployment
on 2026-09-13 one node answered `403 anonymous_disabled` while the others
minted happily. One stale node can therefore deny a session the cluster was
willing to grant.

**A gate built on that confusion was written and removed the same day** — see
the note in `useCurrentSession.ts`. It would have raised a login wall on a
network blip and killed playback mid-film. The honest UI needs the reason, and
only core has it.

### 1.0 Verify the login gate against a server that grants nothing

**Added 2026-09-13, and it needs a real server as much as a real set.** The
client now locks itself when the session carries no roles — the deployment
where `media_viewer` is taken off `anonymous`. Three things want checking on
hardware, none of which can be checked here:

- **The keyboard.** `TvTextInput` raises the platform IME and suspends the
  focus registry while it is open. `tvFocus.suspend()` was written for this and
  **has never run on a device**; if it leaks a suspension the whole client goes
  unnavigable with no visible cause.
- **The escape hatch.** Settings must stay reachable from behind the wall and
  Back must return to the login. Without it a set whose node stops granting
  roles is bricked — no address bar, reinstall the only remedy.
- **That the wall does not flash on a cold start.** `known` is what prevents
  it, and the window it guards is exactly the one this client's flaky link
  makes wide.
- **That an unreachable cluster does *not* raise the wall.** Pull the network
  mid-session: the viewer should keep what is on screen and see a connectivity
  notice, never a login. This is the failure the removed gate would have
  caused, and the only way to know it is gone is to cause it.

**Confirmed working on the set 2026-09-13**: with every node minting
`roles: []`, the wall appears with the right wording, the username field takes
default focus, "Browse as guest" is correctly absent and "Server settings" is
present. Typing through the IME is still unexercised.

### 1.1 Install the pending build and confirm the D-pad

The focus-geometry fix is committed and unit-tested but has never run on
hardware. Until a Down press is seen entering the Movies row, the ported scorer
remains **unproven on this device** — it has never once chosen a candidate
there.

Both D-pad bugs and their causes are in `COMPLETED.md`; this item is purely the
verification.

### 1.2 The 5.1 downmix measurement — the one that tests the premise

`verify-on-device.sh audio`, with a film playing. Criteria are fixed in advance
in `HISTORY.md` so the standard cannot be set after seeing the result. Three
things must hold: a platform E-AC-3/AC-3 decoder (not AAC), 6 channels reaching
AudioTrack, and a **positional** channel mask rather than the `0x8000003F`
index mask.

If the first two hold but the mask is an index mask, this client is
direct-playing correctly and the set still cannot fold down — which is **core's
speaker-layout gap, not a defect here**. Core wants the answer either way; a
clean positional mask points the other way and is worth as much.

Owed to: the NPM session, the site session (it changes a published sentence),
and this repo's own README premise.

**If the session shows unexplained mid-playback failovers**, there are three
candidate causes and they are distinguishable: §2.0's missing hold-aware `500`
retry, §2.2b's backward-seek eviction (the tell is a rewind immediately before
the failover), or a genuine node fault.

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

### 1.6 First real output from the platform-surface probe

Core's probe has produced no runtime truth on any host. Its first output comes
from the Settings screen here. A required member reported absent is a finding
for core, not a defect in this client.

**The three `titleIndex` probes are now in core** (added 2026-09-12 on Tom's
approval, after this client raised it): `Intl.Collator` with sensitivity and
numeric, `String.prototype.normalize`, and the `\p{M}` escape built at runtime.
Each asserts a specific answer rather than mere presence, because presence is
what a partial implementation has.

This bears directly on §4.3's `AlphabetIndex`, built on
`sortMediaByIndexedTitle` and `availableAlphabetKeys`. A Hermes `Intl` that
ignores `numeric`, or a `normalize` that no-ops, degrades into **silently wrong
sort order** rather than an exception — the strip would index the wrong letters
and nothing would say so.

---

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
- **Hold-aware loading is gone, and this is the loss most likely to bite.**
  `PlayerEngine.kt:450` retried an HTTP `500` on the *same* node with
  exponential backoff, because `500 segment_not_ready` is the node stating it is
  already working on a fragment it promised — failing over cannot help, since no
  other node has it, and the replacement starts a cold generation from nothing.
  `expo-video` has no such rule. **Expect spurious failovers under load**, and
  expect them to look like node faults rather than like this decision. The web
  client solves it in JS (`NATIVE_HLS_FIRST_FRAGMENT_TIMEOUT_MS` and its
  readiness walk), which is the shape of a fix without returning to the native
  engine.
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

### 2.3 Player options — the largest functional gap in the player

`PlayerOptions` in the web chrome: audio and subtitle track selection, and mode
override. The chrome currently displays the chosen instruction but cannot change
it — and **forcing a mode by hand is how a downmix problem gets isolated**, so
this is wanted *during* §1.2 rather than after it.

`expo-video` exposes `availableAudioTracks` / `availableSubtitleTracks` with
selection, so the data side is there.

**This is the best use of a window when the television is unreachable.**

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

Pushed to `git@github.com:tomdionysus/macha-client-rn-android-tv.git` on
2026-09-13. **Visibility unconfirmed** — `gh` was not available to check.

This matters beyond tidiness: the site session has **published a statement that
this repo is not fetchable**, with `macha-ts` and `macha-client` as precedent.
If it is public that published sentence is now wrong, and it is Macha UI Work's
to correct rather than ours.

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
| `/login` | **yes** (2026-09-13) | `sessionManager.signIn`, `UsersApi.currentSession` |
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

- **Options** — §2.3, the largest functional gap.
- **Previous / next** — needs `PlaybackQueueStore` (§2.5).
- ~~Volume and mute~~ — **done 2026-09-13**. Not a slider: the control takes
  left and right while focused, as the scrubber does, since a D-pad is the only
  input and a separate slider would be two controls where one will do.
- **Mini player** and its minimise/expand pair.
- **Failure trail** (`screens/player/failureTrail.ts`) — worth more on a
  television than on the web, since there is no console to inspect.
- **Seek acceleration** (`screens/player/seekAcceleration.ts`) — the native key
  bridge already passes `repeatCount` through, so the input side is done.

Fullscreen is **not applicable** — a TV app is always fullscreen.

### 4.3 Components — 9 of 21 ported

Ported: `MediaCard`, `MediaRow`, `Status`, `PlayerIcons`, `LazyArtwork`,
`AlphabetIndex`, plus TV-only `Focusable`, `TopBar` and `EpisodeCard`.

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

`ContinueWatchingStore` is used. `PlaybackQueueStore` and `VolumeStore` are
constructed and never read (§2.5). `MusicPlaylistStore` is **not constructed at
all** and is needed by every music route.

The clearest illustration of rule 1: all four stores are core's, already written
and tested, and the work here is to render them.
