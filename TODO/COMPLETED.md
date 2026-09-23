# Completed

## 2026-09-21 to 2026-09-23 — a way out of an account, 0.6.0, the resume point that survives a kill, and the audio answered

**Four things landed, one release shipped, and the television corrected the
work twice.** The cluster's catalogue went to `503` on the evening of the 22nd
and Tom stood the client work down; everything after that is documentation.

### A viewer could not leave an account, and a lapsed session looked like a fault

**Tom, at the set: the client insisted the account had no media read access,
and there was no way to sign out of it.** The second was why the first was
inescapable.

**What the account actually has, measured against `10.35.1.50:7438`:**
`POST /api/v1/session` for `tvtest` with core's nested credentials envelope
returned `roles: ["media_viewer","view_status"]`; the same request with a
*flat* body returned `username: anonymous`, `roles: []`. The server grants what
it should; a session that cannot read the catalogue is one minted without
credentials.

**Why a client holding such a session could not escape it.** Core documents and
measured the degrade: a re-mint presents no credentials, so it returns the
anonymous account, and `/catalogue/items` answers `403 requires the
'media_viewer' role` — *"the library empties mid-use and the application
renders its refused state, unannounced, looking exactly like a fault"*. Core
publishes both halves of the answer, `lastIdentityChange` and `roles`, and
**this client consumed neither** — no reference to `lastIdentityChange` existed
in `src/`. `useAccessLatched` then held the shell up over it by design (its own
"known deferral"), and the account chip was a plain `View`, drawn and never
registered, so the D-pad walked past it to the cog.

**Landed:** `accessState` takes a fourth fact, `AdmissionEnded`, that outranks
`ready`; `stillAdmitted` is the latch's rule extracted so it is tested without a
renderer; `lapsedIdentity` reads core's two halves together. The chip is a
`Focusable` behind a `ConfirmDialog` — the web client's `ConfirmModal` re-laid
for a remote, own focus scope, **Cancel holding focus**, because an accidental
OK on a bar the viewer walks past constantly costs a password typed with a
D-pad. Sign-out stops playback and **awaits it** before the token changes. The
login screen takes a `notice`, used only for `identity-changed`.

**Run on `.133`**, APK hash-matched: chip reachable, dialogue correct, Cancel
returns without signing out, Sign out returns the wall, sign back in restores
the library. **What triggered the re-mint on Tom's session is not measured** —
the logcat buffer was lost to a reboot first. The `identity-changed` wall has
never been seen on hardware.

### `verify-on-device.sh bundle` was reporting false MISSINGs

Hermes stores any string containing a non-ASCII character as UTF-16. A byte
grep for `on this television only` found nothing while the string was plainly
in the bundle, and `This signs ` — the ASCII part of the *same template* — was
found at once. Every sentence this client shows a viewer is a candidate: the
house style uses `—` and `…` throughout. The stage now checks both encodings
and says which matched. **Second time that check has read "stale bundle" on a
good bundle**; the first was the `-I` grep wrapper.

### 0.6.0, and the tags put right

`main` fast-forwarded 27 commits and moved to **`^0.18.0` from the registry**,
published that day. The unlink verified as a check: real directory, lockfile
resolving to `registry.npmjs.org/…/core-0.18.0.tgz` with no `link: true`, and
the published `dist` carrying `lastIdentityChange` and `SessionIdentityChange`.
Three checks green against that copy. Bumped inside the release commit to
**0.6.0 / versionCode 600**, tagged annotated, pushed. `develop` was then
fast-forwarded and re-linked in a separate commit (the `eb156c1` shape), so it
carries the bump too — left at 0.5.0 it would have minted 500s again.

**The tags were audited retrospectively at Tom's ask, and `main` was already
fully tagged.** 0.3.1 and 0.3.2 never existed on any ref. The one defect was
**`0.5.0` being lightweight**; retagged annotated at the same commit and
force-pushed, so the tag object changed and what shipped did not. A `git push
--tags` run as belt-and-braces also published a genuine historical `0.2.0`
that had never been on the remote — an accident, and Tom kept it.

**Deployed from `main` at the tag**, `npm ci`, cold build 16m 48s, `aapt2`
confirming `versionCode='600'` and `armeabi-v7a` only, hash-matched on the set.

### The resume point survives a kill — and the television corrected it twice

**Tom, after the "crash" below: persist position and *currently watching* on
every pause and every five minutes while playing.**

The rule is pure and tested (`progressPersistence.ts`): no write with no
playback or no duration; a pause writes on the *edge*, not the state; the
interval runs only while playing. The hook sits at **app scope** for the reason
`usePlaybackRuntime` already gives for the live-session record, with two
triggers — every snapshot for the pause, a tick because snapshots cannot be
relied on to keep arriving while a film simply plays. Each rule was mutated and
shown to fail a test before being trusted.

**First device run failed, and it was right to.** A film killed at about
seventy seconds recorded nothing. Core's `ContinueWatchingStore.update` stores
nothing below `MINIMUM_PROGRESS_MS` — 30 s — and reports it by returning a list
the entry is absent from, not by throwing. This client wrote at a second or
two, had it silently declined, and **advanced its own clock anyway**, so the
next attempt was five minutes out and a kill anywhere between 30 s and 5 m 30 s
stored nothing. `nextWatermark` now leaves the clock alone on a decline, reading
the *outcome* rather than mirroring core's floor.

**Second bug caught by reading before shipping.** That fix made a declined
write retry on the next snapshot, and `ExpoVideoAdapter` sets
`timeUpdateEventInterval = 0.25` — 4 Hz, ~120 AsyncStorage writes in the first
30 s of every film on a set whose load average reached 30. The watermark now
records the last *attempt* as well as the last *store*, and the interval branch
needs both; the pause edge is exempt.

**Core corrected the calibration the same day, and it was right.** The interval
had been anchored to `SERVER_SESSION_IDLE_MS`; read back from
`macha-ts/src/playback/streamProtocol.ts`, that constant is *the server's
default*, nodes state their own, core deliberately does not read it, and its
docblock says **never let correctness depend on it**. This repo carries the
identical warning for `SERVER_SEGMENT_HOLD_MS` a few lines above where the
constant was added, and it was read and missed anyway. The relationship also
did no work — the interval alone bounds what a kill discards. Five minutes
unchanged; the test now asserts the declaration is arithmetic on literals, and
was mutated to prove it catches the original mistake.

**The rule is owed to core.** Put to the `macha-ts` session with the shape and
the four rules; **recorded in core under "P1 — design and contract"**, and they
will name the version on the thread. The removal obligation is at the
declaration and in `ACTIVE.md`. **The third on-device run is still owed** —
blocked by the catalogue `503`, not by the client.

### The "crash" was the set replacing Android System WebView

`ApplicationExitInfo`: sixteen recorded exits for this package, **every one
`reason=10 (USER REQUESTED)`**, none a crash. The one Tom saw:

    20:42:15.279 Force stopping com.google.android.webview ... installPackageLI
    20:42:15.284 Killing 3554:foundation.macha.client.tv/u0a96 (adj 0):
                 stop com.google.android.webview due to installPackageLI

`adj 0` — the foreground app, taken down by a system-package update. Load
average 30, logcat retaining two minutes. **Why our process was in the WebView
kill set is not established**: `expo-dom-webview` was the first guess and is
disproven (not in `node_modules`, gradle, the manifest, or the APK), and a fresh
process has zero WebView mappings in `/proc/<pid>/maps`.

### Quiet, and slightly out of sync — measured, and HISTORY's downmix question answered

§1.2's second open gap is closed. During a film on `.133`: route
`AUDIO_DEVICE_OUT_SPEAKER`, `STREAM_MUSIC` 86/100, our track on a **DIRECT**
output thread, **6 channels, positional `0x0000003F`**, all gains 0 dB, 0
underruns, **0 effect chains on our thread** while the mixer threads carry them,
write latency ~197 average. So criteria 2 and 3 hold — this client direct-plays
5.1 correctly — and that is exactly why it is quiet: DIRECT bypasses the mixer,
the fold-down never runs, and the set's own speaker processing is applied to
everything on the television except us. The fix and what remains asserted are
in `ACTIVE.md` §1.8; it is not started.

### Things this session got wrong, in order of cost

1. **Tied a timing budget to a server default**, with the warning against
   exactly that a few lines above the line being written. Core caught it.
2. **Claimed twice in writing that a film enters Continue Watching within a
   tick of starting.** Core's 30 s floor makes that false, and the claim was
   wrong before the set disproved it.
3. **Advanced the write clock on a declined write**, which the unit tests could
   not have found and the television did in one run.
4. **Nearly shipped a 4 Hz storage retry.** Found by reading the adapter, not
   by measuring — the right way round for once.
5. **Relaunched the app before querying the node** after the WebView kill, so
   whether a playback session was leaked and reclaimed cannot now be told from
   "never leaked".
6. **A bad reachability check** printed "reachable" because the `tail` in the
   pipeline succeeded rather than the connect.
7. **`git push --tags`** published a tag nobody asked for. Harmless, and Tom
   kept it, but it was an outward-facing action taken as belt-and-braces.
8. **Wrote §2.11 three times** — as a stream-switch indicator, then as any
   wait, then as a recovery no normal player could make — each narrower and
   more correct than the last, with Tom supplying the definition each time.

### And two traps that were real

- **Hermes UTF-16 strings** — above. A verification stage that reads "absent"
  for a present string is the one wrong answer it must never give.
- **The same `npm install` producing a link on one run and a directory on
  another** is still not isolated. The explicit `npm install <pkg>@<range>` is
  the only step that rewrote the lockfile every time.

### Cross-session

- **Core** took the resume-point rule (TODO recorded, version to be named) and
  corrected the calibration. They declined to read the phone and web trees on
  our behalf — right — and recorded our "do they write progress on a cadence"
  as asserted and unread.
- **Not sent:** the catalogue `503` and its error string were not passed to
  the server session; Tom's call, and he knew.

### Rationalised 2026-09-20 — anomalies found (moved from ACTIVE)

An audit of `ACTIVE.md` against the tree and the laws, after the 0.14.0 port
and the parity work. Kept because it says what was wrong and why.

1. The "single next action" had been done for a day; seven cross-references
   still named §1.1. Re-pointed.
2. The device section described the wrong television — measurements were on
   `10.35.1.133` (Android 12, 960×540 dp) while the file said `10.34.1.115`.
   Both recorded now.
3. The bootstrap-endpoints claim was superseded twice: `a0e134e` changed the
   list, and Tom then ruled the app ships with no endpoints (§3.6).
4. The parity tables were wrong in nine rows; corrected in place.
5. §2.5 and §4.2 disagreed about volume: store wired, control gone.
6. A hardware claim outlived its subject — the Settings nav item no longer
   exists, so the Right-escape fault is unverified, not fixed.
7. The priorities did not match the purpose: failover is the reason the repo
   exists and was a paragraph in §2.2. It is first now.

## 2026-09-20 (night) — the regenerate path, frozen once and recovered once, and the trail that can now tell the difference

**Three runs of the same reap in one evening, three different outcomes**, all
on the TCL, all *Life of Brian* on `10.35.1.50`:

| build | classification | path | outcome |
| --- | --- | --- | --- |
| core `32da3e0` | `unknown` | failover, cross-site | recovered in 7.2 s, copy kept, invisible |
| core `10a1d93` (walk fix) | `not-found` | regenerate, same node | **frozen indefinitely** — Tom watched it; this session had reported it as recovering |
| core `0e787f8` (close bounded, two lines at warn) + `info` trail | `not-found` | regenerate, same node | **recovered in 1.2 s**, copy kept, **invisible to Tom watching**, and the bound was not exercised |

The second row is the finding of the night and it is in `ACTIVE.md` as P-1:
a correct classification opened a path nobody had run, and the path hung.
Core found the one unbounded await on it — regeneration waits on the close of
the dead session, failover never does — and bounded it. The third row shows
the path working when the close settles, and shows the bound *not* needed
that time, so the freeze is **not reproduced**, not fixed. Five more reaps
across two sittings are the plan.

**The `info` trail is what made the third row readable**, and it was built
because the second row was not: everything between "regenerating" and
"attached" — `failed-session-closed`, `session-create`, `session-created`,
`session-regenerated`, `source-activate`, `first-fragment`,
`source-presented` — was at `info`, and the trail showed `warn`. With
Diagnostics on it now shows `info`, eight lines, and the whole recovery sat
on the screen with a timestamp on every step. Core has since moved
`generation-regenerate` and `session-regenerated` to `warn` for everyone.

### Four things this session got wrong tonight, in order of cost

1. **Reported a frozen television as recovering.** "Preparing new stream" was
   read as progress from screenshots taken every 25 s; it was a state that
   never ended. Tom corrected it from in front of the set. A capture cadence
   cannot distinguish "recovering" from "stuck" and should have been said so.
2. **Trusted a change detector that had never produced a change.** During the
   third run a `sips` crop silently wrote nothing, so the band hash never
   moved and "same" was reported for three minutes *after the recovery had
   happened*. The node's `sessions` count going `0 → 1` was the tell and was
   misattributed to another client. Caught by reading the frame. **A tool
   that has only ever said "no change" has not been tested.**
3. **Nearly recorded Wake-on-LAN as a working trick.** A magic packet and
   Tom's remote hit the set in the same minute; only one of them is proven.
4. **Read "sessions: 1 twenty seconds after leaving the player" as an
   orphaned session** for one message, before a `GET 404` on the session
   showed the count simply lags the pipeline drain.

### And two traps that were real

- **Gradle does not see a change inside the symlinked core.** An
  `assembleRelease` after core rebuilt `dist` took 6 s, executed 8 tasks, and
  shipped the *old* bundle; verified by the literal missing from the APK.
  `createBundleReleaseJsAndAssets --rerun-tasks` first, then grep the bundle
  for a string the change introduced, then hash the APK on the set.
- **The set leaves the network ten minutes after the last key.** Not powered
  off — `screen_off_timeout` — but indistinguishable from it over the
  network. In the device notes now, with the setting to raise for a sitting.


## 2026-09-20 (evening) — the reaped session, read on screen: it is a terminal error, and core's fix holds

**The question §1.0 could not settle is answered, and the answer is the
opposite of the hypothesis.** Measured on the TCL at `10.35.1.133`, client
`0.4.0` built against core `32da3e0` (APK verified byte-identical on the set by
`md5sum` against the local build, because both are `versionCode 400`), server
`0.46.2`, nodes `10.35.1.50` and `ramaroja.macha.network` (`10.34.1.50`).

**A reaped session reaches this client as a terminal error.** The trail, read
off the screen while the film was still playing:

    2748.3s playback failure       {"message":"A playback exception has occurred:
                                    Source error Response code: 404","kind":"unknown"}
    2748.3s playback.coordinator source-failover-start  {"mediaId":"tmdb:movie:583",…}
    2755.5s playback source-budgets {"url":"http://10.35.1.50:7438/api/v1/playback/
                                     stream/f2c7e503…/1/master.m…"}

`expo-video` **did** raise a terminal error, and it carried the status in its
message. There is no `stalled` line and no `alternate-promoted-on-degradation`:
the recovery went through the **failure** channel, not the degradation one. The
§1.0 hypothesis — that a `404` on a fragment presents to this player as a stall,
so `reportTerminalPlayerFailure` never runs and `not-found` cannot reach this
platform — **is wrong**, and the note that carried it to core has been
corrected.

**But the kind is `unknown`.** The message says `Response code: 404` and the
classification still produced `kind: "unknown"`, so the `not-found` path did not
fire even though the error arrived and the evidence was in it. That is this
client's own defect rather than core's, it is now the open question in its
place, and it is recorded as §2.8.

**Core's recovery fix works on hardware.** The replacement generation kept the
video copy — read three ways, which is why it is stated flatly:

| | before the reap | after the recovery |
| --- | --- | --- |
| endpoint | `https://ramaroja.macha.network` (`10.34.1.50`) | **`http://10.35.1.50:7438`** (this site) |
| video | COPY · HEVC 1920×1040 · 9.8 Mb/s | **COPY · HEVC 1920×1040 · 9.8 Mb/s** |
| audio | TRANSCODE · DTS 5.1 → AAC 5.1 384 kb/s | unchanged |
| session | `…::8f5b81e2012f6de51d2b4e1b654f8316` | `…::f2c7e503d6b7d5ca8f7343938a561513` |

The node agrees with the screen: `preferences.video: "copy"`,
`output.video.transform: "copy"`, and `running_video_transcode_pipelines: 0` on
both nodes afterwards. §1.0's expensive recovery — a copy turned into a full
re-encode on the cross-site node's only video slot — **did not happen**.

**The viewer saw nothing, again, and this time for a measured reason.** Paused
at 29:19 with about six minutes of buffer, reaped (`GET 200 → DELETE 204 →
GET 404`), resumed at 19:52:52. Playback ran on out of the buffer for roughly
five minutes before the player asked for a fragment that was not there; the
failure and the new source are **7.2 s apart**, and the buffer covered it. No
failure screen at any point.

**The recovery came back to the local node**, which is the other half of what
§1.0 got wrong about itself. See below.

### What the trail caught that nobody was looking for

The first two lines of the same session, from before the film even started:

    468.3s playback.api http-error-response  {"requestId":1,"method":"POST",
                                              "path":"/api/v1/playback/sessions?…
    468.3s playback.cluster generation-attempt-failed  {"endpointId":"http://10.35.1.50:7438",…}

**The local node refused the session create, and the film started cross-site
because of it** — not because anything failed over, and not because the
bootstrap list was wrong (it now reads `http://10.35.1.50:7438`, the set's own
site, so anomaly 3 is closed as configuration). §1.0 recorded the cross-site
placement as a failover decision. It was an admission refusal.

Why, probed directly against `10.35.1.50` with the `tvtest` token, same title:

| request | answer |
| --- | --- |
| `{"mode":"remux"}` | **400** `fragmented MP4 cannot carry a copied dts audio stream; ask for preferences.audio=transcode` |
| `{"mode":"remux","video":"copy","audio":"transcode"}` | **400** `remux repackages and copies every stream: to re-encode one, ask for mode=transcode with video=copy or audio=copy` |
| `{"mode":"transcode","video":"copy","audio":"transcode"}` | **201**, `output.video.transform: copy` |

So this node will copy this video happily — **it refuses the *remux*, not the
copy** — which also answers core's question about whether the replacement would
have accepted `video: 'copy'`: on this title, on this node, yes.

**Which shape the client actually sent is not yet proven**, because the trail
truncated the line one field short of the status. The leading hypothesis is that
the chooser asked for a remux on a title whose DTS audio cannot be copied into
fMP4 — the exact 400 above — and that the second endpoint got a corrected
instruction. `LIVE_DETAIL_CHARS` (240, against the overlay's 110) exists to read
that line on the next start, and it was added because of this.

### Three smaller things, all measured the same sitting

- **`describePlaybackSession` never said "remux".** The first line is
  `CONTAINER : endpoint`, so the screen read `FMP4 : …`. The "negotiated to a
  remux" in §1.0 was our own inference, and core's fork — node substitution
  versus a label disagreeing with the echo — dissolves: the generation was
  `mode: transcode, video: copy` the whole time, confirmed from the node.
- **The unused-session reaper is real and fast.** A probe session created and
  never streamed from was gone inside two minutes, `unused_sessions_reclaimed`
  going `0 → 1`, which is §1.4a's mechanism seen from the other side.
- **Back from a top-level screen exits the app** — confirmed on *Settings*,
  not just Home, and it is what §1.1 said. Tom's rule for the player was given
  the same evening and is implemented: panel, then chrome, then leave.

### And four traps this sitting walked into, for whoever is next

1. **The screensaver takes the foreground** during any pause long enough to
   matter. Disabled for the sitting with `settings put secure
   screensaver_enabled 0`; **restore it**.
2. **A relaunch restores the last route.** Coming back to Settings put focus in
   the endpoint field with the IME open — one stray keystroke from editing the
   cluster address. `am force-stop` first.
3. **Focus after a launch is wherever it was left**, not the nav bar, so a
   counted run of D-pad presses lands somewhere else entirely. Screencap first,
   press second.
4. **Wall-clock is not film time.** Probing two nodes between captures put
   twenty-eight minutes into the film; the timings above are from the trail's
   own elapsed clock, not from how long the work felt.

What has actually landed, and — following the phone client's convention —
**the experiments that failed and the theories that were withdrawn**, since
those are the entries that stop the next person repeating them.

**As of 2026-09-13 that is no longer uniformly true.** Entries dated
2026-09-13 and later marked *verified on the set* were observed working on the
TCL. Everything else still means built, typechecked, tested and statically
verified — not observed.

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

## Access, and the difference between two kinds of "no" (2026-09-13)

The cluster now grants `anonymous` no roles, so the client puts a login in front
of everything. `AccessState` has four outcomes and the gate is latched at first
admission.

**The distinction the whole thing turns on: "the server told us we may not" is
not "we could not ask".** A refusal is a policy a cluster stated and a sign-in
may resolve it. Nothing answering means the viewer is away from home, and
offering them a login is both a lie about what was said and useless, because
signing in needs a reachable node as much as watching does.

A first version got that wrong and was **written and removed the same day**. It
derived access from an empty token, which is the same value for both cases, and
it re-checked on every session notification — and the failed-refresh path
notifies. A network blip mid-film would have torn down the player and presented
a login to someone who was watching something. That is the inverse of invisible
failover.

What replaced it consumes facts rather than inferring them:
`lastMintFailure.reason` separates refused from unreachable, and core's
`sessionLockedOut(roles)` takes `undefined` for unknown so the permissive answer
is structural rather than something a caller must remember. Our own
`sessionLockedOut` was deleted; core took it because this client and the web
client had independently written the same rule.

The latch is deliberate: once a viewer is in, a later failure is a connectivity
problem and belongs on screen as a notice, never as a wall replacing what they
have. The cost is that a genuine demotion mid-session does not lock anyone out
until restart, which is degraded rather than an access hole and the better
trade.

`TvTextInput` came out of this and is the piece Search will reuse: typing goes
through the television's own keyboard, and `tvFocus.suspend()` exists so the
focus scorer stops moving selection around behind it.

## Three claims that were inherited rather than measured (2026-09-13)

Worth recording together, because they are the same mistake three times and the
repo's own standing rule already warned against it — *claims about other
codebases get read, not remembered*. Reading a peer's code is not the same as
verifying its premise.

- **`403 anonymous_disabled`** was read as a cluster configuration and a whole
  lock condition was built on it. It was one moment of a rolling deployment.
- **`503 {"status":"starting"}`** was read as a role gate on the new liveness
  route and reported to core as a contradiction of their design. The node was
  starting.
- **`MODE_TRANSFORMS`** was carried over from the web client along with its
  comment claiming the server refuses a bare mode as contradictory, written up
  here as established, and offered to core as the clearest of six candidates for
  promotion. **This client never sent that request and never saw that refusal.**
  Core had investigated it at server 0.34.0 and the server session confirmed
  against 0.39.1 that naming `mode` clears the per-stream fields first, so the
  contradiction cannot be assembled. Deleted rather than moved.

The deletion had a better reason than redundancy, and it came from looking at
the map rather than the argument around it: it **asserted what a mode implies
per stream**, which is the server's judgement, and a panel built to expose the
5.1 decision must not quietly pre-state it.

The example first given for that — "a remux can carry transcoded audio" — was
itself wrong, and core corrected it. `remux` means the container changed and
every stream was copied; the server refuses a remux with any quality conversion
by contract. **A 5.1 downmix therefore arrives as `mode: 'transcode', video:
'copy', audio: 'transcode'`**, and reading the mode alone would call it a video
re-encode. `ACTIVE.md` §1.2 carries that into the measurement.

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

## The first failover on hardware, and 0.4.0 (2026-09-20)

**0.4.0 is tagged, pushed and on the television** — the release commit carries
the version bump, the tag is annotated bare semver on `main`, and the install
script asserted `versionCode 400` against the APK rather than trusting it.

### The reaped session, run

The test this client had been unable to run: a session deleted out from under a
paused viewer, which is the reaper's state without the thirty-minute wait. Full
reading in `TODO/ACTIVE.md` §1.0. The short of it:

- **The viewer saw nothing.** Playback ran out of the buffer and kept going, no
  failure screen. Law 2 held at the surface, which is the part that matters most
  and the part nobody had ever observed here.
- **The recovery took the expensive path.** It left the healthy local node for a
  cross-site one and rebuilt a video **copy** as a **transcode**, burning that
  node's only video transcode slot to re-encode a stream the panel decodes
  natively.
- **The cause of the transcode is core's and is now known**: a recovery POST
  names `mode` without `video`/`audio`, and the server clears per-stream
  transforms when `mode` is named. Core found it by reading, the same evening,
  and is deliberately not patching it until a prior question is settled.
- **Why it was a failover rather than a same-node regeneration is still open**,
  and the endpoint change is the tell: `not-found` regenerates on the same node,
  a stall goes to the standby path, which is by construction elsewhere. If
  `expo-video` cannot raise a terminal error for a `404` on a fragment, the
  `not-found` contract cannot reach this platform at all — nor Media3, AVPlayer
  or a native HLS element anywhere else.

### What made it possible

- **A session-id diagnostic** on the player, behind the Diagnostics toggle. The
  node exposes no way to learn a session id — no list route, and `status`
  reports a count — so a client-side tester could not run the web session's
  recipe at all. Tom asked for it; it took ten minutes and it is what turned an
  impossible test into a routine one.
- **The bootstrap list is this site only** (`10.35.1.50`), Tom's call. Until
  then the set was served cross-site by `10.34.1.50` while its own node sat
  discovered and unused, and every latency reading was of the wrong path.

### Measurements

- **`session_unused_idle_ms` means "has never served a stream object"**, not
  "has been idle" — the server session's answer, after a paused direct-play
  session survived four and a half minutes against a 120 s clock. A session sets
  `stream_served` the first time it serves anything and then holds the full
  thirty minutes. The short clock exists to stop an abandoned session holding a
  transcode entitlement, not to reap paused viewers.
- **Decoder instance limits are ambiguous from `dumpsys`** and the shell check
  cannot settle §1.3: the main hardware decoder reports both `6` and `1` for
  every video type, with no structure saying which belongs to which profile
  group. The answer is an allocation attempt in the app, which is Tier 3's own
  experiment.
- **Closing the player releases the transcode slot** — `running_video_transcode_pipelines`
  went 1 → 0 on the node, so `terminateForPageExit` does what it claims.

### Navigation faults found by using it

None of these is fixed; all were found by driving the set rather than by reading.

- **Down from the password field lands on "Server settings", not "Sign in"** —
  the geometry favours it, and it is how this session signed in as nobody the
  first time and then read the 403s as a broken account.
- **Leaving to Server settings and coming back clears both fields.**
- **From the Settings screen the top nav bar cannot be reached at all.**
- **A key press while the chrome is hidden only wakes it**, which is correct and
  is the web client's behaviour — but it means the transport buttons need two
  presses within the four-second window, and every press this session made was
  slower than that, so pause never fired until the media key was used.

### Four things this session got wrong

- **Committed the `file:` link to `develop` with a `git add -A`.** Caught while
  restoring the registry version, which is the check that found it. `main` was
  never affected. It then turned out Tom wanted the link, so it stays — but it
  was luck rather than judgement, and the next `add -A` should be an `add` of
  named paths.
- **Proposed the wrong cause for the transcode.** The theory was that the
  recovery re-ran the chooser without facts. It does not re-run the chooser at
  all: it passes the previous session's preference echo and the *node* chooses,
  with less than core knew.
- **Read "hevc allows one decoder instance" off an `awk` that paired decoder
  names to numbers wrongly** — the `1`s belonged to the vp8, secure and Dolby
  Vision decoders. Reported, then withdrawn an hour later.
- **Said there was no RN test account in memory as though that settled it.**
  There was no *RN* account, but the web client's `webclient` was recorded in
  its own project memory with its credentials in `.env.local`, and the right
  first move was to look there rather than to report an absence.

### Cross-session

The server session **checked its own half and cleared it** — the documented
remux→transcode substitution did not fire for this session, proven from the
node's journal — which is what narrowed the transcode to the client half in one
step rather than three. It also asked for a priority ranking and took this
client's: the metadata read-only windows first, because they cost a viewer
nothing and an ingest everything, and that reasoning is now the stated reason
for the ordering in their backlog.

**Owed to this client when work resumes:** a saturated-node probe, which needs a
real torrent completed first — their four synthetic attempts are marked void in
their own backlog because a generator that reads from memory cannot reproduce a
load that reads one disk and writes another. And they have asked for wall-clock
stall timings rather than HTTP statuses, since this client cannot see statuses
from its own player: their journal has the status, this client has the clock,
and the join is a better instrument than either.

## Core `0.14.0`, and two failures a viewer would have blamed on the node (2026-09-19)

Taken from `0.12.0` in one session, and it was a port rather than a version
bump: `0.13.0` and `0.14.0` are one bug seen from four sides. A viewer pauses
for half an hour, the node reaps the play session exactly as `session_idle`
says it should, and the viewer comes back to a failure screen naming a node
their session was never on. Three of the parts touch the player seam.

**Nothing below has been observed on hardware.** All of it is asserted from two
implementations and a contract, and the pause case is now first in the queue for
the set (§1.7 and §0).

### What the port took

- **`not-found`.** A `404` on a playback route is a statement about one
  session's existence, not about the node. Read as `stream` it is endpoint
  evidence, so the node that answered honestly is charged a failure and dropped
  while the viewer is sent to one that never held the session.
  `ExpoVideoAdapter` maps the readiness walk's status through
  `playbackFailureKindForStatus` instead of reporting a blanket `stream`, and
  honours the obligation that arrives with the kind: an adapter reporting it
  must not tear the presentation down, because the element's buffer is the
  cover core builds the replacement behind.
- **Node-stated budgets.** `firstFragmentTimeoutMs()` takes
  `PlaybackSource.budgets.deadlineMs` **whole, including when it is shorter**
  than this client's own constant. Core owns when to stop and the host owns
  what happens until then; of two deadlines the shorter silently wins while the
  other layer looks broken.
- **`MediaStallWatchdog.useSourceBudgets()`** at every attach, promotions
  included. The watchdog outlives a generation while the hold belongs to a node.
- **`PlaybackTransition`.** A warm standby is cut to **only on `continue`**. A
  viewer's seek and a reap recovery arrive byte-identical — measured by the web
  client — so it is the one bit no host can derive.

### Parking, which is the half a viewer would actually have noticed

Tom, 2026-09-19: **the experience must be as close as possible to the web
client.** So the web client was read and then asked, rather than reasoned about.

A terminal error raised while nobody is waiting is now parked rather than
reported, and met again on resume with the viewer present. Every judgement this
adapter makes is "is this node failing the person watching", and while playback
is paused there is nobody to fail. Keyed on **viewer intent** rather than on the
player, because between a play request and the element running nothing is
playing while the viewer is very much waiting; `startPaused` counts as
not-waiting, as it does there.

**Where this platform cannot match theirs**, recorded so nobody reads it as a
defect: their park keeps the buffer and the frame (`stopLoad`/`startLoad`);
`expo-video` owns its loader and a player in its error state will not resume, so
the source is re-attached and the viewer sees the held frame blank and come
back. The two clients diverge precisely at the moment the viewer is looking at
the screen. Tier 3 is what would close it.

### Classifying an error the player could not

`expo-video`'s `PlayerError` is `{ message: string }`. So a terminal error from
its own loader now asks the node what it says, rather than reporting `unknown`
and letting the coordinator read that as endpoint evidence.

- **The walk, not the session.** Asking whether the *session* is alive is the
  obvious move and is wrong: a fragment past the end of a live plan and a reaped
  session both answer `404 not_found`, one word of English apart in a body no
  loader surfaces. The web session caught that before it was built.
- **Latched per attached source**, which is host-local memory by nature — only
  the host knows that this element's later statusless error is the same event.
- **Bounded against the runway**, which the core session asked for and is the
  part that had real teeth. Lateness spends the deferral, and a verdict arriving
  after another recovery owns the source is not late but **void**.
- **No message parsing.** Nothing in either client classifies from text.

### Four things this session got wrong

The first three are the same error in three costumes: **a claim about another
component, made without opening it.** The reasoning about this tree held
throughout, because reading is the default here.

- **A blanket `stream` for every readiness refusal**, which predates 0.13.0 and
  is what the port fixed. Reasoned from "the node did not serve it" without
  asking what the node had actually said.
- **"`unknown` costs a spinner; a wrong `stream` costs a healthy node."**
  Repeated from the web session and written into code comments and two
  documents before anybody read the function.
  `isEndpointRetryablePlaybackFailure` returns true for **both**. The floor is
  still `unknown`, for a different reason: it is core's documented answer for an
  unmapped status, and the standby behind it is the recovery that works without
  knowing the cause. **The asymmetry that does hold is against `not-found`** — a
  false one buys silence, a false `unknown` buys a standby.
- **The floor justified with 9 s and 4 s**, two real measurements of entirely
  other things — a join point built past a node's look-ahead frontier, and the
  transport allowance elapsing on a dead node. The core session read them. The
  true comparison is stronger: four seconds spent to avoid a
  `generationAttemptBudgetMs()` of about nineteen on a node holding nothing.
- **A charitable reading of core's own exposure.** Told that core reads its
  runway off a stale snapshot too, this session assumed core's case was milder
  because events are still arriving at its deferral check. Core's *terminal*
  path awaits `sessionAlive()` and only then reads the runway, so its figure is
  stale by the probe as well. Being generous about a peer's code is the same
  failure as being harsh about it.

### What came back from the other two sessions, which is most of the value

- **The runway decays and a last known value does not.** Found by the core
  session while reading this client's budget for a different question. A sample
  standing for ninety seconds was granting the walk ninety seconds of cover
  already spent. Fixed by subtracting the event's age, through the monotonic
  clock because it is a duration.
- **Do not emit a last event before reporting**, which was this session's next
  idea. Core's guard for a dying witness is forward-only on the *position* and
  gated on a failover in flight; `forwardBufferMs` goes through untouched. A
  player that zeroes its buffer on the way down would write `no-cover` into the
  decision — spending exactly what was being protected. It is also the wrong
  layer: one term of three, safe only after core changes anyway.
- **A hidden element still buffers, and promoting one the moment it is ready
  starves the viewer seconds later.** Both from the web session's own Tier 3
  work, carried into §2.1 as warnings from their platform rather than results
  on this one. Their own margin is unsettled, so the shape is what to copy.
- **`subscribeDegradation` already is the "supply a status you hold" entry
  point**, and the branch was built for the web client's read-ahead worker. That
  shrank a proposed core seam to one additive helper.

### The convention that came out of it

This repo already insists every claim says whether it is **measured or
asserted**, and had only ever applied it to hardware. It now applies to
**cross-repo claims too**: a statement about another tree names the file it was
read from, or says that nobody has read it. A compressed claim from a peer
arrives wearing the same clothes as a fact about your own code, and nothing in
the sentence marks which it is. All three of the errors above were filed next to
verified things because of that.

### Also landed

- **CodeGraph removed.** `CLAUDE.md` pointed every code question at a
  `.codegraph/` index that is not in this repository, so the instruction could
  not be followed. `AGENTS.md` carries the working rules.

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

---

## The remote works, and the premise holds (2026-09-13) — verified on the set

The day the television stopped being the blocker. Sign-in, D-pad navigation and
playback all confirmed on the TCL, and §1.2 — the measurement this repository
exists to make — has an answer.

### The P0: 0.3.0 shipped a set whose remote died the first time anyone typed

`TvTextInput` took a `tvFocus.suspend()` on `TextInput.onFocus` and released it
on `onBlur`. **On Android TV `onBlur` never fires.** The leanback IME closes as
its own window while the `ReactEditText` underneath keeps native focus —
measured on the set as `mInputShown=false` with `mServedView` still pointing at
the field. So the suspension was held for the life of the process,
`useTvNavigation` returned early on every key, and after typing once the D-pad
did nothing at all, on a screen whose only other control is a second text
field. Nothing on screen said why; only restarting cleared it.

Fixed three ways in 0.3.1, because the consequence is out of all proportion to
the cause: release on `keyboardDidHide` (blurring the field, since `onBlur`
will not come), release on unmount, and a **backstop in the key path** — a
suspension held while `Keyboard.isVisible()` is false is stale, so `resumeAll()`
clears it and the key is handled. Reference counting cannot recover from a lost
token by construction.

**The decisive diagnostic was a restart.** From a clean process the D-pad
worked, which isolated it to leaked state rather than the registry, the scorer,
the geometry or the native key bridge.

### The second focus defect, found while verifying the first

`tvFocus.handle()` asked `current()` for a fallback when `selectedId` named
nothing reachable, then computed the move *from* that fallback without ever
selecting it. A direction with a candidate silently skipped the first element;
a direction with **no** candidate returned false, leaving the screen with no
selection and no focus ring at all. Reproduced on the library after Back from a
detail page: no ring anywhere, Up doing nothing however many times pressed.
Fixed in 0.3.2 — the first press reveals focus, the second moves it.

### §1.2 — answered

*28 Years Later*, direct-played:

```
matroska / direct / video copy / audio copy
Id 75  Active=yes  Client=2108  Chn mask=0000003F  FrmRdy=21560  Underruns=0
Channel mask: 0x0000003f (front-left, front-right, front-center, low freq, back-left, back-right)
```

Six channels on a **positional** mask, not the `0x8000003F` index mask, on an
active track belonging to this app. The node transcoded nothing.

**Two limits, stated because the measurement is owed to other sessions.**
Criterion 1 (a platform E-AC-3 decoder in use, not AAC) is *inferred* — the
instantiated decoder's name was never captured. And the reading is at the
AudioTrack and mixer layer, not the HAL output, so the panel rendering six
*discrete* channels downstream is not proven; the same dump showed a
`Multichannel Downmix To Stereo` effect present. See §1.2 in `ACTIVE.md`.

### Capability output from the panel

```
VIDEO       av1, h263, h264, hevc, mpeg2, mpeg4, vp8, vp9
AUDIO       aac, ac3, ac4, amrnb, amrwb, eac3, flac, mp3, opus, pcm, vorbis
HLS VIDEO   h264, hevc
HLS AUDIO   aac
```

`HLS AUDIO: aac` is the line with consequences — this panel decodes `eac3` and
`ac4` natively, but we advertise AAC alone for HLS delivery.

### A prediction that did not come true

From `HLS AUDIO: aac` this session predicted §1.2 would return an AAC
transcode. It did not: the chooser picked `direct` with a Matroska container
and never went near HLS. The reasoning was sound *conditional on HLS being
chosen* and was stated more strongly than that. The HLS concern stands; it did
not apply to this title.

### Two readings this session got wrong

- **"No control has a focus ring"** in the transport overlay. The pause
  button's dark red tint (`#160004e8`) *is* `chromeButtonFocused`. Focus was
  working; the screenshot was misread.
- **"The server re-signs artwork URLs on every fetch, churning the cache key."**
  Measured false by the web client — 836 refs, one `exp`, unmoved across 2.6
  hours. The real cause was core stamping the preferred node's host onto every
  artwork URL, so an endpoint swap renamed every poster. Fixed in core with a
  sticky artwork host and `noteArtworkLoaded`.

### Also landed

- **Hold-aware first-fragment wait** (`readiness.ts`) — restores what
  `PlayerEngine.kt:450` did before the move to `expo-video`: a `500
  segment_not_ready` is waited out on the *same* node. The walk itself is
  core's `probeHlsReadiness`; only the retry budget is local. `preflight.ts`
  deleted in favour of core's `hlsWalk`.
- **On-screen failure trail** (`failureTrail.ts`, `playbackLog.ts`) — built and
  shipped, and **not yet switchable on**; its Settings toggle is unreachable.
- **`VolumeStore` copied out of core** with its storage key unchanged, after
  Tom ruled volume is player logic. An empty stored value reads as absent
  rather than as a deliberate mute, because `Number('')` is `0` and `0` is
  finite — the one corrupt input that produces the come-up-silent failure.
- **Adopted core `0.10.0`/`0.11.0`** — builds and passes, not ported.

### Swapping onto a seam finds more than reading it

Three of four defects found in core's new `hlsWalk` came from porting this
client onto it and running the existing suite, not from reading the code. The
`blob()` one surfaced only because these test doubles were shaped around
`arrayBuffer()`. Core has made that a standing practice: land the seam, name it
to a client, let the client swap, fix what the swap finds, *then* tag.
