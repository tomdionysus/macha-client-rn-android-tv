# Active

Open work on the Macha Android TV client. What has landed is in
[`COMPLETED.md`](COMPLETED.md), **including the mistakes** — read those before
re-deriving anything. Reasoning lives in [`../docs/HISTORY.md`](../docs/HISTORY.md);
conventions and traps live in [`../AGENTS.md`](../AGENTS.md).

---

## 0. Where this stands — handover, 2026-09-24

**Two days of work are in `COMPLETED.md`'s top section**, with the seven
things they got wrong. Read that first; this section is only what is open.

### The tree

- **`main` is `0.6.0`** (tagged), against core `^0.18.0` from the registry.
- **`develop` is 42 commits ahead of origin, not pushed — the push is Tom's.**
  It links `file:../macha-ts`, last checked at core `b5c0128` (dist hash
  `71e9158332ca`); 288 tests pass against it.
- **`develop` can no longer run against published core.** Core's viewer-text
  cut (§1.16 in `COMPLETED.md`) removed APIs `0.18.0` has and added ones it
  lacks. **Nothing on `develop` can reach `main` until core publishes** a
  version carrying the cut, `progressWriteDue`, `episodeNeighbours`,
  `SEARCH_SORTS` and the liveness check. Core has said it will announce it.
- `.gitignore` (`*.local.md`) and `basemind.toml` are still uncommitted, as
  they were before this session: tooling, nobody's decision yet.

### The set

- **`10.35.1.133`** runs develop `e537528`, APK md5
  `0a74b0a5d4ac1895bbe8111d2c35b890`, built against core `a5b08f0` (before
  core's `seedEndpoints`). **Signed in as `tvtest`** (re-signed 2026-09-24;
  the earlier session did not survive the dead node). Left paused in the
  *Classroom 216* player; `screen_off_timeout` put back to `600000`.
- **Configured endpoints: `http://10.35.1.50:7438`, `http://10.44.1.50:7438`**,
  by Tom's instruction 2026-09-24. `10.35.1.50` came back during the
  sitting. Remembered: `https://macnessa.macha.network`. **`ramaroja` is
  offline for the foreseeable** (Tom) and no longer in the cluster list.
- **Seen on screen 2026-09-24 (measured):** Continue Watching card lines,
  Settings > Server (no note while serving), the player's clock and stream
  lines, direct and transcode. Still unseen: Music albums, Sort By, notices,
  an error screen.
- **Direct play of MPEG-4 Part 2 fails on this set.** *Classroom 216* (AVI,
  `video/mp4v-es` 624x352): `OMX.realtek.video.decoder` raises `0x80001009`
  with `format_supported=YES`, so Auto picks Direct and it sits at 0:00. The
  source then moved between addresses of the same node, which cannot help a
  decode error. Transcode plays it. Two open questions: whether `mpeg4` should
  count as direct-playable here (a platform probe question, this repo's), and
  whether a decoder error should move node at all (the coordinator's
  classifier). Also: with Transcode chosen, the hint under Mode still says
  "Chosen automatically: this device plays the file as it is."
- `10.34.1.115` has not been touched since 2026-09-21.

### Open, in order

1. **Eyeball the rest of the viewer-text build** (Music, Sort By, notices, an
   error screen; above).
2. **Restart fallback — fixed and confirmed on the set 2026-09-24.** The
   remembered list was wiped by the first health cycle after a restart (seeded
   as `bootstrap`; core persists only `discovered`). Measured: with only a dead
   address (`http://10.35.1.99:7438`) configured, the set reached Macha
   through its remembered nodes over two consecutive restarts. Now seeded by
   core's `seedEndpoints` (`b47773d`), which also stops the list being wiped
   while nothing has answered yet; that half is **not yet on the set**.
3. **Faint focus in two places**, found while checking tonight's build: the top
   bar (focus and "current page" are one fill a shade apart) and the sign-in
   buttons (after moving, neither showed focus). Offered to Tom, not answered.
4. **P-1, what remains** (section P-1 below): the transcode reap recovers on the
   same node, but only after the buffer drains (66 s) because `expo-video`
   reports no per-segment failure; and a direct-play reap never reaches the
   player. Both point at the **native-adapter trial** Tom asked about ("is it a
   two-way door, can we trial it") — proposed as a throwaway branch with the
   current APK kept for reinstall; **not answered, not started.**
5. **§1.8, the stereo A/B**, is now possible: *Firefly* season 1 episodes carry
   `ENG · AAC · 2ch` beside the 5.1 track. It needs somebody listening.
6. **§1.9** — whether a catalogue `5xx` should charge a node at all is with core
   (message `167950ec`); the client's wording half is now `errorText`.
7. **§1.12** — the list of smaller faults found switching accounts.
8. The remote's own previous/next media keys are not wired to episodes.
9. Parity, §4.

### Waiting on others

- **Core: Tom's cluster-membership rule (2026-09-24).** "The TV must
  ABSOLUTELY NOT pick up old servers and talk to them if they're not in the
  cluster." Core's `candidates()` treats a remembered endpoint as a full
  candidate from startup until the first cluster-status answer, token and all,
  and keeps it all run if no member answers (read in core `f7dc0f6`, not
  measured). Sent to core with the design it implies: remembered endpoints ask
  only who the cluster is, carry no token, and are dropped the moment an
  advertisement omits them. **The restart fallback confirmed today runs
  through this window**, so it is not done until core lands this.
- **Core:** a published version for `main` (above).
- **Server 0.56.0** (develop `60ce47a`, announced 2026-09-24, not yet
  deployed): a top-level `status` code on every JSON response. This client
  parses no server JSON itself, so nothing here breaks. Core `a5b08f0` swapped
  `ServerStatus.message` for `code` and `detail`; Settings > Server now words
  the code locally (`serverStatusText`) and shows no server sentence. Seen on
  the set against 0.55.1 (serving, so no note); the worded failure cases are
  unseen. Server will say when es-1/fi-1 are live.
- **Tom:** a second endpoint on the set; the faint-focus fix; the native-adapter
  trial; whether series/season "links" on a TV card mean anything beyond Back
  (core has put it to him).

### Traps this session paid for — driving the set over adb

- **The player chrome hides after 4 s and the next key only reveals it.** Send
  a sequence in one `adb shell` call, or budget a reveal press.
- **`dumpsys media_session` `state=` can be stale**; compare `updated` with
  `/proc/uptime`.
- **`adb shell input text` drops characters** on this set's keyboard; type one
  character per call.
- **Hermes keeps property names, not local variable names**: to prove a bundle
  carries a change, grep for a new property or string, never a local.
- **This shell's `grep` skips files it thinks are binary** (logcat captures
  included) — use `grep -a`. **zsh reads `===` and `$VAR:s…`** as syntax;
  avoid both in commands.
- **Back on a top-level screen leaves the app.** On Search that is one Back
  after a keyboard that did not open.

### After the sitting, in order

1. **Tier 3** (§2.1), if §1.3 allows a second decoder — it is the rest of the
   reason this repo exists, and it closes the one visible difference from the
   web client's park.
2. **Decisions** §3.1, §3.2, §3.5 — none blocks work, all shape it.
3. **Music** (§4.6): `OverflowMenu`, `Modal`, then a queue that outlives the
   screen. The largest parity block, and the three components it needs are
   shared with the mini player and previous/next (§4.2).
4. The rest of §4, in its own order.

### Getting a build onto the set

```sh
cd android && rm -f app/build/generated/assets/react/release/index.android.bundle
EXPO_TV=1 ./gradlew :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a
TV=10.35.1.133:5555 ./scripts/verify-on-device.sh install
```

**Delete the bundle; do not `--rerun-tasks`.** Both force Metro to run again,
which is the whole point when core is a symlink Gradle cannot see into, but they
do not cost the same. Measured on this machine 2026-09-21, same tree, same APK:

| | |
| --- | --- |
| `createBundle… --rerun-tasks` **then** `assembleRelease` | **3m 01s** (2m 20 + 41s) |
| delete the bundle, one `assembleRelease` | **1m 34s** (Metro 31–38s of it) |
| no-op `assembleRelease`, nothing changed | **14s** |

`--rerun-tasks` re-runs 29 tasks and needs a second Gradle invocation to get the
guarantee that removing one file already gives. Roughly half the build time this
project has been paying was that. The residue is Metro bundling 851 modules plus
about a minute of dex, package, `lintVitalRelease` and sign for a 29.8 MB APK.

Asserted, not measured here: `ACTIVE.md` records the phone client's incremental
JS-only rebuild at ~90 s, which is what the second row now costs. Nobody in this
session has run that command in the phone's tree.

`npm test` runs `version:check` first, which compares `package.json`,
`app.json` **and the generated `android/` tree** — bump a version and you must
`EXPO_TV=1 npx expo prebuild --platform android --clean` or it fails. The
install stage then asserts the device is running the APK just built. If it
refuses, do not debug against that install.

### Reaching the devices

**There are two, they are not the same hardware, and only one of them can be
switched on to order.** Tom, 2026-09-20: both TCLs are targets; `10.35.1.133`
(or whatever `10.35.x.x` address it moves to) is the one he controls and the
one all work is driven against. **`10.34.1.115` is updated opportunistically
when it happens to be up, and the app is not run on it** — install, leave it,
and take no measurement from it unless somebody is in front of it.
`verify-on-device.sh` now defaults to the controllable set, so a bare
invocation means `10.35.1.133`.

| | `10.35.1.133` — where 2026-09-19's work was done | `10.34.1.115` — 2026-09-12/13 |
| --- | --- | --- |
| Model | TCL `G10_4K_GB_NF_32BIT` | TCL 55B6B |
| Android | **12** (SDK 31) | 11 |
| ABI | `armeabi-v7a,armeabi` | `armeabi-v7a,armeabi` |
| Surface | 3840×2160 panel, **1920×1080 override at density 320 → 960×540 dp** | unmeasured |
| Site | `10.35.1.x` — node `10.35.1.50`, the set's **only** configured endpoint | `10.34.1.x` — node `10.34.1.50` |

Both are `leanback_only`, `type.television`, no touchscreen. The APK's
`armeabi-v7a` pin is right for both.

- Addresses are DHCP and have moved before (`.115` → `.116`).
- **The set drops off the network ten minutes after the last key.**
  `screen_off_timeout` is `600000`; a screen-off set stops advertising adb
  and stops answering ping, and a subnet sweep finds nothing — which looks
  exactly like a set that is powered off. Measured 2026-09-20, twice. For a
  sitting: `settings put system screen_off_timeout 1800000`, and **put it
  back**. The screensaver (`screensaver_enabled`) is the other clock, and a
  film keeps the screen on but a paused film does not.
- **`adb mdns services` finds it when a connect times out** — it advertised
  `_adb._tcp 10.35.1.133:5555` while `adb connect` was failing, and connected
  on the next try. A Wake-on-LAN packet to `b0:6b:11:ca:17:2d` was sent the
  same minute Tom woke it with the remote, so **WoL is unproven**, not a
  trick.
- `getprop ro.product.manufacturer` must say **TCL**. A Blackview phone also
  appears on adb — that is the phone client's device, not this one.
- **Network adb has to be switched on at the set.** `10.35.1.133` answered
  ping and refused `5555` until it was enabled from Developer options, then
  showed an authorisation prompt for this host's key
  (`d9:52:24:c1:ae:93:41:08:1b:18:98:85:ce:e9:36:c9`) that had to be accepted
  on screen. A port scan finds nothing before that step.
- The older set reaches its node in **0.65 ms**; the laptop's link to either
  site is the unreliable half. A slow or failed adb call says nothing about the
  set's own health.
- **`com.tcl.esticker`** — TCL's in-store demo overlay — took the foreground
  after ~52 minutes idle on the older set. Disabled with
  `pm disable-user --user 0 com.tcl.esticker`; reverse with `pm enable`. If it
  steals the foreground mid-film, `AppState` goes background and
  `usePlaybackRuntime` fires `terminateForPageExit()`, killing the session.
  Not yet seen on the newer set.
- **Driving a set over adb has three traps.** Back sent when no IME is open
  exits the app; `com.tcl.tv` is `FLAG_SECURE` so `screencap` then returns an
  empty file; and pressing faster than ~2 s during a row scroll scores focus
  against stale `measureInWindow` rects. Our own app screencaps fine.
- The screensaver (`dreamx`) takes the foreground while idling. Wake, foreground
  the app and act in one pass.
- **`uiautomator dump` prunes what is off screen.** It showed two rows on a
  Home that had four, and the missing two were read as absent data. Focus in
  `tvFocus` is a JS registry, so the dump never shows it either.
- **The player screencaps black.** Video draws into a hardware layer, so a
  capture of a playing title is pure black. The transport chrome is an RN view
  and *does* capture, so reveal it first (any key) and read position, mode,
  codecs and node from the small print. That overlay is the only way to read
  the player from off-device.
- **`input text` and `KEYCODE_DEL` do not agree about what "focused" means**,
  and this cost most of an evening twice. `input text` writes to whatever holds
  focus. `KEYCODE_DEL` only acts on a field in **edit mode** — pressed with a
  field merely focused it does nothing and reports nothing. So a field that
  looks cleared may not be, and text aimed at one box can land in another.
  Activate a field with `DPAD_CENTER` before deleting, and **capture after every
  field rather than at the end**.
- **On the login screen, `DPAD_DOWN` from the password lands on "Server
  settings", not "Sign in".** The focus scorer goes by geometry and the
  secondary button sits nearer the form's centreline. So the natural remote
  gesture — Down, then OK — opens Settings. `DPAD_LEFT` then reaches Sign in.
  **This produced a false finding on 2026-09-21** (below); anything driving
  this screen must confirm which control it is about to press.
- **Never conclude from a screen that is also the default.** The 403 /
  "requires the 'media_viewer' role" state is what an app shows *before* anyone
  signs in, so reaching it proves nothing about a sign-in that may never have
  happened. A symptom identical to the null hypothesis costs nothing to produce
  and evidences nothing.

### Two standing rules

- **Take every piece of logic from `@machafoundation/core` — and no words.**
  Anything that is not presentation belongs in core and is consumed rather
  than rewritten; **viewer text is presentation** (Tom, 2026-09-24) and lives
  in `src/text/viewerText.ts`. `develop` links `../macha-ts`; `main` installs
  from the registry (AGENTS.md has the check).
- **Claims about other codebases get read, not remembered.** Every cross-repo
  assertion here has been wrong at least once — including two of this
  session's, listed in `COMPLETED.md`. Open the peer before writing "only",
  "never" or "nowhere else".

## P-1. The regenerate path froze the viewer once — bound landed, freeze not reproduced, **not closed**

**Status, 2026-09-24:** four reaps since 2026-09-23, none froze. A transcode
reap now recovers **on the same node** (core's liveness-before-charge,
`2bcce57`); direct-play reaps either failed over remotely (before that fix) or
never reached the player (a deleted session's open body keeps streaming — the
server session confirmed that from `playback.cpp`). All four are written up in
`COMPLETED.md`'s top section. **Open:** detection waits for the buffer to drain
(66 s) because `expo-video` reports no per-segment failure — see §0's item 4.
The history below predates all of that.

### Why it is P-1 and not P0

Before the walk fix the same reap was misclassified as `unknown`, took the
**failover** path, and recovered in 7.2 s — cross-site and expensive, but
invisible. The fix routes the same event down the **regenerate** path, which
had never been exercised on any platform, and that path hung. So the correct
change made the viewer's outcome strictly worse, and every reap on every
client with the fix does this until it is closed. It is the one thing in this
file that can put a frozen frame in front of a viewer *tonight*.

### The mechanism, as far as it is read

`preparingSource` is true only between two lines of core's
`buildReplacement`, so "Preparing new stream" still on screen means the
`await recoverWithPreferences(...)` never returned. Inside it, `regenerate`
did `await this.releaseFailedSession(dead)` — **the one unbounded await on the
whole recovery path.** `releaseFailedSession` resolves when the *first*
`DELETE` settles; nothing bounds that `DELETE`; the attempt deadline wraps only
the `POST` in `createOn`, which was never reached. Its own docblock says it
must never be awaited — failover fire-and-forgets it — but regeneration has
to, because the node's transcode slot is held by the very session being
replaced. Core wrote both halves down and never bounded the place they meet.
(Core session, 2026-09-20, from their tree; agreed here.)

**One thing the mechanism does not yet explain, kept honestly.** The trail
shows the `DELETE` *received* its `404` — `http-error-response` is logged on
the response — so whatever failed to settle did so *after* the node had
answered. That is somewhere in `request()`/`stop()` after the status is read,
and it is not identified. Core's bound makes it moot for the viewer; the
`info` trail (below) will show whether `failed-session-closed` ever appears.

**The node is not the problem.** The same create issued from a laptop —
`POST /playback/sessions`, `seek_ms: 300000`, `{transcode, video: copy,
audio: transcode}` — answered **201 in 1.21 s** with the copy intact, and
server 0.47.0 adds only `stream.production` to the session: no hold, no
two-phase admission, no readiness signal on creation (server session,
checked).

### What has landed, and what has not

- **Core `0e787f8`**: `regenerate` now awaits `releaseWithin(dead, budget)` —
  the close raced against the same budget as the create (19 s on fi-1), and
  proceeds either way; a `failed-session-close-timeout` warn says when it
  expired. `generation-regenerate` and `session-regenerated` are **warn now**,
  not info — they were the two blind spots that made the first run
  unreadable. Two tests reproduce the hang as a timeout with the bound
  removed. **In `src`, and `dist` is being rebuilt as this is written.**
- **This client**: with Diagnostics on, the buffer and the live trail run at
  **`info`** (`applyDiagnosticsLevel`, `syncDiagnosticsLevel`), eight lines,
  so every step between "regenerating" and "attached" is on screen. **Built,
  unrun.**

### The build waiting for the set, 2026-09-21

**Core's tree moves under a fixed version by design** ("`0.17.0` is the name
of the thing being built until it is published" — Tom, via core), so a
measurement names **core's SHA and a hash of `dist`**, never the version.
Hash from *inside* `dist`, because `shasum` includes the path it is given.

    core 9a37ce3 (the two uncommitted files were TODO and package.json — no src)   dist 364733574ba860cb
    behaviourally identical to core HEAD 86552c9: `git diff 9a37ce3 HEAD -- src` is empty (core, checked)
    APK  f849f44527eedf69b7e8564dd110219a               bundle forced, literals verified:
         client_recovery_deadline, failed-session-close-timeout, account_session_limit,
         HlsManifestUnavailableError, fatal-error-code

Carries: the walk fix, the bounded close, the 48 s recovery supervision, the
`410`/`429` tolerance, the cap accessors (`playbackFailureStatus` included —
it went in with `9a37ce3`), the two log levels, the deferred session
release; and this client's `info` trail and cap sentence. **Not installed** —
the set was asleep when it was built. **Superseded: rebuild at the sitting,
against core HEAD then, and record the new identity** — core `28d6b70` added
`standby-preparation-refused` at warn carrying `accountAtSessionLimit`, and
that line is the discriminator between a cap-caused freeze and the one still
being hunted: **a standby is the first request an account at its limit gets
refused**, so seamless failover would stop with nothing on any trail, on this
set, indistinguishable from P-1 — and with the line, a freeze *without* it is
not the cap. Running the old APK would give up exactly that.

**The cap sentence is reachable on the failover path, not only on create** —
read in core and pinned by a test: the originating `PlaybackSourceError`
carries `kind` and no `code`, `terminalRecoveryError` appends the refused
failover as the chain's tail, and `playbackFailureCode` walks outermost-first
to the refusal's code. `promoteStandby` never creates a session, so the only
refusal it can meet is core's standby preparation, which is now the warn line
above rather than silence.

**Core's `dist` moved again 2026-09-21 (HEAD `5aa3f6f`)** — the identity is
taken at build time, so nothing to redo, but the reason bears on this
client's own figures: `ALTERNATE_RECOVERY_WINDOW_MS` is now `10_000`, was
`30_000` — core holds a **remux** standby only as long as the server
*guarantees* a pipeline stays warm (a node refuses to start with
`pipeline_idle` under ten seconds), because neither `pipeline_idle_ms` nor
`session_idle_ms` is on the wire. **This client's transcode window at `8_000`
sits below that floor and is safe by construction**, unchanged. A bundle
built before `5aa3f6f` would hold standbys three times longer than core now
believes is safe — a second reason the bundle sha must move at the sitting.

### The sitting, 2026-09-21 — the build landed, twelve titles played, all three modes

**What ran.** `0.5.0` / `versionCode 500`, built against core `648474d` with
`dist` built 14:31:25, on `10.35.1.133`. Three APKs went on the set across the
afternoon and **every one was `versionCode 500`**, which is also the released
`0.5.0`'s code: `md5` against the local build was the only thing that could tell
them apart, and it matched each time (`e1381e01…`, then `d014aaf8…`, then
`df18355a…`). Assume the package manager cannot distinguish what is on that
television from the release.

**Twelve titles, play → seek +10 s → rewind −10 s → pause → resume → stop.**
Mode is selectable from the player's "…" panel, which reads the session's own
`options.modes`, so direct/remux/transcode are a choice rather than a wait for
the right media.

| Mode | Titles | What the chrome states |
| --- | --- | --- |
| Direct | Last Exit to Brooklyn, 2001: A Space Odyssey, 2010, Akira, Airplane!, Terminator Genisys (forced) | container unchanged; `2010` carried `AC3 · 5.1`, `Akira` `EAC3 · 7.1` |
| Remux | Aliens, Taken, Apocalypse Now | container becomes `FMP4`, streams copied |
| Transcode | Titanic, 28 Days Later | `FMP4`, and both ends stated: `HEVC → H264`, `EAC3 5.1 → AAC 5.1 384 kb/s` |

Transport was read off the chrome rather than inferred — the clock moved 0:24 →
0:18 on a rewind, the button flipped to play on a pause. **The player surface is
a hardware video layer, so `screencap` of a playing title is pure black**; the
transport chrome draws in the RN layer and does capture, which is the only way
to read the player from off-device.

**Ten sessions were leaked, and that is the finding.** The harness reset the app
with `am force-stop` between titles, so `terminateForPageExit` never ran and
every title left its session open (`sessions=10/32` on one node). A crash, an
OOM kill or `com.tcl.esticker` taking the foreground does the same thing. One of
the ten was a **transcode**, holding the node's single video-transcode slot, and
it refused two later transcode requests with `video transcode limit reached`.
Deleting the ten and re-running the refused title, which then transcoded
normally, is what turns that from a theory into a cause. **The refusal itself
behaved correctly**: a readable sentence in the chrome, playback not torn down.

**Reclaiming an orphan is decided, and it is both sides.** Tom, put the
do-nothing option by core 2026-09-21: *"We can't lock people out for 30m."* So
`session_idle_ms` is **not** the answer.

- **This client's half is built** (`state/liveSessions.ts`): the session ids core
  already mints and hands over — `${endpoint.id}::${nodeSessionId}`,
  `ClusterPlaybackResolver.ts:767` — are written to durable storage as the
  runtime reports them and cleared on a clean stop, so what survives a kill is
  exactly what was live when the process died. Durable storage is the one thing
  only the host has; core dies with the process too.
- **Core owes the reconcile**: take that list at start, check it against each
  node's `GET /api/v1/playback/sessions`, close what is still there. It cannot
  kill another device's film because these are ids *this install* was handed,
  not ids it found. `orphanedSessions()` is what it takes and `forgetSessions()`
  clears what it closed. **Until that call exists this record is inert** — it
  logs `sessions-orphaned-by-previous-run` to the trail and nothing more, which
  is still worth having: it says a session was abandoned rather than leaving the
  next viewer's 429 looking like a server fault.
- **The server's half is built but not deployed** — `ec5a65b`, relayed by core:
  a reclaimed pipeline releases its transcode entitlement, per logical viewer,
  skipped while a sibling session shares the viewer, reacquired lazily. 484/484
  on es-1. **All three live nodes still run 0.48.0 where the entitlement is
  sticky**, so the thirty-minute exposure measured here still describes the
  field.
- **Open, with the operator:** whether release happens at pipeline reclamation
  or at a separate threshold between `pipeline_idle` and `session_idle`. The
  former means a 61-second pause can lose the slot on a contended node, and with
  `max_video_transcodes` at 1 "contended" means any second viewer.

**Triaged by core — a stale handle, not a lost record:** `Playback generation
http://10.35.1.50:7438::72baee939be831ded9347a7b7fd00f68 has no endpoint
provenance.` reached the viewer as that raw sentence, from
`ClusterPlaybackResolver.ts:780`, seconds after a forced mode change re-resolved
the title onto a **different node** (`10.35.1.50:7438` → `macnessa.macha.network`)
and a transport action called `update`.

Core's mechanism, 2026-09-21: `update` is pinned to the owning node and cannot
move a generation, so the mode switch did not go through it. It went through a
re-resolution — the old generation released, its provenance deleted at `:557`,
a new one created under a **new id** at `:768` — and the host's transport action
then called `update` with the id it was still holding. Nothing is lost; the
handle is stale. Three faults are core's regardless and are queued with the
standby window: it throws a bare `Error` so `playbackFailureCode` and
`playbackFailureStatus` yield nothing and a host cannot classify it; it
therefore reaches a television as raw prose; and `stop()` treats the identical
condition as benign while `update` and `sessionAlive` throw — one condition,
three behaviours.

**The cluster, measured from `GET /api/v1/status` with a tvtest bearer.** All
three nodes report `0.48.0`, and TEL3 is on the wire:
`max_sessions_per_account 32`, `pipeline_idle_ms 60000`, `session_idle_ms
1800000`. Two consequences, both sent on:

- **Core's standby window is six times shorter than it needs to be.** It took
  the 10 s guaranteed floor this morning because `status_api.cpp` did not
  serialise the idle figures. It does now, and the configured value is 60 s.
  **Accepted by core 2026-09-21 and queued as phase 2** behind the
  node-selection work: the constant will read the node's figure where one
  arrives and keep the 10,000 floor where none does, because a node older than
  0.48.0 sends no such field. Core will say when it moves.
- **The node-wide `max_sessions` story does not match the cluster.** Ten
  concurrent sessions were held for one account on `10.35.1.50` and none was
  refused, so that node's limit is above ten rather than the 8 relayed as still
  live everywhere. The listing is node-local — while a title played on
  `macnessa`, `10.35.1.50` reported `sessions=0` — so all ten were on one node.
  `max_sessions` is **not** in the telemetry block, only the per-account cap, so
  a client cannot state the limit that actually refused it.

**What could not be exercised, and why:** a TV show (the detail screen is an
episode list, not a play button, so the two-press flow never reaches a player),
and two titles lost to `adb input text` dropping a character on the search
field. Neither is a client fault; both are harness limits worth knowing before
the next sitting.

### The evening, 2026-09-21 — a remux P0 answered, and a second cause of the same 503

**Two findings, and the second was an accident of the first.** Both measured on
`10.35.1.133` against `http://10.35.1.50:7438`, client `0.5.0` / `versionCode
500`, Diagnostics on so the trail rendered while the film ran.

#### The A/B: remux is not broken, copying AC-3 into fMP4 stalls

Tom's P0, reaching here through both the phone client and core: could this
client complete a remux at all? The phone had four failures on two nodes and
could not separate *"remux is broken"* from *"copying AC-3 into fMP4 stalls"*,
because every title it tried was AC-3 or E-AC-3.

Same node, same minutes, same mechanism — a PATCH to `mode: remux` on a live
session, from the player's options panel:

| Title | Audio | Result |
| --- | --- | --- |
| Aliens | AAC 5.1 | **succeeds.** `session-updated mode:"remux"` → `generation-update-ready` → `first-fragment ready:true` ~100 ms later. Chrome: `FMP4 · REMUX · HEVC 1920×1036`, `REMUX · ENG · AAC · 5.1`. Audio **copied**. |
| 2010 | AC-3 5.1 | **fails.** `PATCH …/sessions/a2adb…`, `elapsedMs 15051.5`, `503`, `generation-update-failed reason:"representation"`. On screen: *"timed out waiting for first fragmented-MP4 segment"*. |

`elapsedMs 15051.5` against that node's own advertised `startup_timeout_ms:
15000` is what places the failure at `wait_for_initial_fragment` rather than
anywhere slower — core reports that number is now doing the work of tying three
clients' sightings to one wait.

**Measurement, not mechanism, and deliberately so.** Core relayed `delay_moov`
as the cause and then retracted it; the server has since disproved it by
experiment on es-1 — AC-3 copy into fMP4 works with the flag and fails without,
and under macha's real configuration AAC and AC-3 behave identically. Both
experiments read from local disk rather than macha's source IO and used a
substitute title, so 5.1 layout and the DHT-backed read path are untested. The
server's next step is reproduction with the real media, explicitly not a fix.
**Nothing in the table above depends on which mechanism wins.**

**This client behaved correctly throughout**: the failed remux did **not** tear
the session down. Direct play carried on at 0:37 and the viewer got a sentence
instead of a black screen, with the old generation still presenting.

#### A stale session makes the *next* play of the same title fail on that node

Found by accident while testing the orphan record, and filed by core with the
server as a **defect separate from the AC-3 P0**.

    kill the app mid-playback (am force-stop)     session survives on the node
    replay the same title, same node              503, elapsedMs 15026.8
                                                  plan: video copy + audio transcode
                                                  no AC-3, no audio copy anywhere in it
    DELETE the orphaned session                   sessions 1 -> 0
    replay the same title, same node              first-fragment ready:true, no 503

n=1 each way and **no mechanism claimed**. What it establishes is narrower and
still useful: *"timed out waiting for first fragmented-MP4 segment"* has **at
least two distinct causes**, and one of them is a stale session for the same
media already on that node.

It also reframed the phone client's P0. On being told, that session disclosed it
had reinstalled four times the same day, twice while a session was playing — a
force-stop by another name on a client whose sessions also survive process
death — and has since recorded its four failures as one controlled comparison
rather than four independent points.

**And it enlarges what `state/liveSessions.ts` is for.** An orphan is not only a
transcode slot held for `session_idle_ms`; it can make the next play of that
title fail on that node. The record was written for the first cost and now
addresses the second.

#### Core `61e4d74` — the reclaim finally has something to call

`ClusterPlaybackResolver.stop()` looked the session id up in an in-process map
and **returned silently when it was missing** — no request, no log, a resolved
promise. Core reports zero DELETEs on fi-1 all day against 57 creates.

That is exactly the case `orphanedSessions()` produces: ids from a **previous
process**, for which no map entry can exist. Wiring the seam before this build
would have called `stop()` on all ten orphans, done nothing, and looked like the
seam being wrong rather than core being unable to act. `stop()` now falls
through to `stopByIdAlone()` and recovers the endpoint from the id itself
(`dist/playback/ClusterPlaybackResolver.js:885`, split on `lastIndexOf('::')` so
`http://[::1]:7438` is not cut mid-address) — **verified here in the artefact,
not taken on report.** Suite green against it: typecheck clean, 240/240, core
HEAD `61e4d74`, `dist` built 19:08:26 with nothing in `src` newer.

**Two properties to design the wiring against**, both core's:

- an untracked close **never throws**, so a failed cleanup reaches a host only
  through the trail, never as an error;
- it never charges the node, because core cannot tell a session abandoned an
  hour ago from one left by a dead process.

So `forgetSessions(closed)` means **"core tried"**, not "the node confirmed". If
certainty is needed, list the node afterwards.

**Still not wired** — core asked for the suite first and has not asked for the
wiring. **Not in this build:** the standby window still reads 10 s rather than
the node's 60 s, and the provenance throw is still a raw sentence. Both phase 2.

#### What the orphan record has and has not been shown to do

**Shown, measured:** the leak reproduces — the app killed mid-playback leaves the
session live on the node, confirmed by listing it five seconds later. The
client's own session id renders as
`http://10.35.1.50:7438::1bf1382c5c6d7c2c4fae3e92feb6a50f`, exactly the
`${endpoint.id}::${nodeSessionId}` form core's reconcile resolves.

**Not shown:** `sessions-orphaned-by-previous-run` has never been *read* on the
set. It is logged at startup, the trail only renders while a film is playing,
and a dozen newer lines push it out of the visible window before it can be seen.
The record's persistence rests on nine unit tests, proved red against a record
that forgets to persist. Seeing the line on a television needs either a longer
trail view or a failure provoked immediately after launch.

### The re-run, 2026-09-20 23:54 — recovered, and the bound was not exercised

Same reap (`GET 200 → DELETE 204 → GET 404`, resumed at 23:54:08, position
6:01), build carrying core `0e787f8` and this client's `info` trail, APK
verified by literal and by hash. The buffer carried playback to 7:54, then:

    1143.1s cluster failed-session-closed      7e1ce560…  attempts: 1
    1143.1s api session-create
    1144.2s api session-created                861ee13a…  mode: transcode
    1144.2s coordinator session-regenerated    7e1ce560… → 861ee13a…
    1144.2s coordinator source-activate        stream/861ee13a…/1/master.m3u8
    1144.3s first-fragment                     ready: true, waitedMs: 59
    1144.3s source-budgets                     deadlineMs 19000, segmentHoldMs 6000
    1144.3s coordinator source-presented       generationStartMs 474475

**1.2 s from close to picture**, same node, `VIDEO COPY` intact, film playing
at 12:56 when read. **And invisible: Tom watched it from the sofa and saw
the film simply continue** — his word, 2026-09-21 00:05, which is the only
measurement of "did the viewer notice" there is. **`failed-session-close-timeout` did not fire** — the
close settled on its own on the `404`, `stop()` resolving (the `.then`
branch, not `-retry`), so core's bound was insurance this run and not the
fix. Which leaves exactly two readings, and one run cannot separate them:

1. The first freeze *was* the unbounded close-await, with something in
   `request()`/`stop()` failing to settle **after the `404` had been received
   and logged** — intermittent, and the bound now caps it at 19 s.
2. The first freeze was somewhere else and this run did not reproduce it.

**So the status is "not reproduced", not "fixed".** Written to core in those
words. If reading 1 is right, a viewer can still see a 19-second freeze on a
reap, and the defect between "response logged" and "promise settled" is live.

### Sequencing, ruled by Tom 2026-09-21

**The routes and the per-account cap move to the nodes together, the set is
not a gate, and everything is tested after the servers have cut over.** This
session's NO-GO on the cap (silent, failover-only, number unsettled) was put
to core and overruled — recorded so the reaps are read correctly: **every reap
from here runs on the new routes with the cap live**, so a freeze has two
candidate causes rather than one, and each excerpt must say so. The cap
sentence (`failureCopy.ts`) gets its first live exercise in the same sitting;
if the number lands where failover trips it, this set shows the sentence
rather than a silent freeze, which is what makes the two distinguishable from
a sofa.

### The plan, revised

1. **Rebuild at the sitting against core's HEAD then**, and the trap is real:
   Gradle does not track a tree outside the project as a task input, so an
   "up to date" bundle ships stale core while every version string agrees.
   Measured here 2026-09-20 (a 6 s `assembleRelease` shipped the old bundle)
   and on the phone client 2026-09-21. **The check, three levels down:**
   (a) `createBundleReleaseJsAndAssets --rerun-tasks` — or delete the
   generated bundle by hand — and confirm the bundle's sha **moved**;
   (b) check the APK's bundle for a literal only the new code emits —
   `./scripts/verify-on-device.sh bundle <literal>...`, which exits non-zero if
   any is absent. Its absence is the one thing that would make a reap
   meaningless while looking fine. **Use that stage rather than a bare `grep`:**
   the bundle is Hermes bytecode and a grep that decides it is binary skips it
   *silently* — this shell's `grep` wrapper carries `-I` and exits 1 with no
   output, which reads exactly like "the literal is missing" and would condemn a
   perfectly good bundle as stale. `grep -a` is the fix; `strings` is neither
   the problem nor needed. Measured 2026-09-21; (c) `md5sum` the APK on
   the set against the local one. Then record core SHA + `dist` hash beside
   every excerpt. Incremental rebuild after a JS-only change is ~90 s on the
   phone client's machine; budget that, not the 20-minute cold build. — Gradle does not
   notice a change inside the symlinked core, measured tonight
   (`createBundleReleaseJsAndAssets --rerun-tasks`), and verify
   `failed-session-close-timeout` is in the APK's bundle before trusting it.
   Install, hash-check.
2. ~~Reap once.~~ **Done, 23:54, recovered in 1.2 s — see above.** The next
   reaps are the plan now: **run it five more times across two sittings**,
   reading the `info` trail each time, because an intermittent hang after a
   received `404` will not show in one. Expected on the trail, in order: `source-reaped`,
   `session-reaped-regenerating`, then *either* `failed-session-closed` (info)
   *or* `failed-session-close-timeout` (warn, ~19 s), then
   `generation-regenerate`, `session-regenerated`, `source-budgets`, and a
   moving picture. **A recovery that arrives only after the 19 s bound is a
   19-second freeze**, which is still a P0 — see 4.
3. **If it still hangs**, the `info` trail names the line it stopped at, and
   core wants it within the hour, not tomorrow.
4. **The follow-up to hand core regardless of 2's outcome**: on a *reaped*
   session the `DELETE` will always `404` — the session being gone is why the
   path was taken — so a `404` on the close means the slot is already free
   and there is nothing to wait for. The close should settle on `404`
   immediately (or the create should not wait on the close at all when the
   liveness probe already answered "gone"). A bound of 19 s is a floor on the
   freeze, not a fix, if the settle problem is real.
5. **Then, and only then**, `COMPLETED.md` gets the run and §1.0f is revised —
   it currently records the regenerate path as reached and not that it hung.

## 1. On the television

**The set is no longer the blocker.** It runs, navigates, signs in and plays.
What is left here is measurement, and the failover exercise that §0 now puts
first.
The records of what was settled on 2026-09-13 — the sign-in P0, the D-pad
verification and the 5.1 measurement — are in
[`COMPLETED.md`](COMPLETED.md).

### 1.12 Found while switching `.133` between accounts, 2026-09-23 — **none fixed**

All measured on the set, all by D-pad over `adb`. None is P-1; all are this
client's.

- **Continue Watching is not per-account.** Signed in as `tvtest`, the rail
  showed `tom`'s three entries unchanged. Core's `signOut` clears only
  `SESSION_CACHE_KEY` (`macha-ts/src/api/SessionManager.ts`, read at
  `a3b40ca`), so the progress store outlives the account. On a shared
  television one viewer sees another's viewing. Bears on
  the storage-keys standardisation, and the fix may be core's.
- **And resuming one of those entries starts from zero.** Selecting `tom`'s
  Half-Blood Prince under `tvtest` logged `requestedPositionMs: 0`,
  `seekMs: 0` — the rail offers a resume it then does not perform. Whether the
  position is being dropped or deliberately withheld across accounts is not
  established; either way the rail and the player disagree.
- **Signed out, Settings reports a `401` as "catalogue unavailable".** The
  header read "Server online; catalogue unavailable" with **PLAYBACK:
  Unavailable**, and the small print underneath gave the real reason, "a
  valid session bearer token is required". That is §1.9 turned round: an
  authentication state worded as a service outage.
- **The sign-out dialog opens on Cancel, and the unfocused Sign out looks
  focused.** Cancel is the focused button (a filled background); Sign out
  carries a red outline as its destructive style, and a red outline is what
  focus looks like everywhere else in this client. It cost one confirm press
  that landed on Cancel. At ten feet the two are easy to confuse.
- **The sign-in wall: DOWN from the password lands on Server settings, not
  Sign in,** and going there **discards the typed username and password**. At
  one point neither button showed any visible focus.
- **The on-screen trail did not repaint in captures while the chrome was
  hidden, during reap 2.** Forty-one captures across the recovery all showed
  reap 1's lines; revealing the chrome showed reap 2's, timestamped at the
  recovery. Reap 1's lines *did* appear with the chrome hidden. Observed
  twice-inconsistent and not explained — so do not trust a capture of the
  trail without the chrome up.

### 1.1 Navigation faults found on hardware

- ~~**Settings has no focus-follows-scroll**~~ — **fixed 2026-09-19**, and it
  was never only Settings: no vertical page followed focus at all, and the rows
  scrolled on every press. One rule now serves both axes (`focusScroll.ts`),
  and the failure trail is switchable. `COMPLETED.md` has the measurement that
  found the real cause (`vp=0`).
- **Does the nav bar trap horizontal movement at its ends?** On 2026-09-13,
  Right from the *Settings nav item* escaped into the poster row. That item no
  longer exists — Settings is the cog at the trailing edge and the bar has six
  entries — so this is **unverified since the top bar was rebuilt**, not fixed.
  Re-check from the cog and from Home.
- ~~**Back landed on the navigation bar rather than the poster it opened**~~ —
  **fixed 2026-09-21** (`App.tsx`, `tvFocus.register`). Opening a film from the
  Movies grid and pressing Back re-seeded focus to the screen default, so a
  viewer lost their place in several hundred titles and a remote has no
  scrollbar to get it back with. The restore is **armed rather than applied**:
  the screen re-mounts and re-fetches, so its cards are not registered when the
  route effect runs — a first attempt that restored there fell back to the
  navigation bar, which is the fault it was written to fix, seen on the set.
  Verified on `10.35.1.133`: before and after Back are the same card.
- **Back from a top-level screen exits the app** rather than returning to the
  previous route. Conventional on Android TV, so possibly correct — but it
  means a stray Back drops out to the launcher, and `com.tcl.tv` is
  `FLAG_SECURE`, so screenshots silently return empty when it does. Worth a
  decision rather than a fix. **2026-09-21 it cost a sitting**: a driver that
  sent one Back too many left the app, kept pressing into the TV launcher, and
  opened a Google Play Services sign-in screen, typing into its email field
  before anyone noticed. Nothing was submitted. Anything driving this set over
  `adb` should assert the foreground package before every key.

### 1.2 Close out the 5.1 measurement

§1.2 is answered and the answer is good — direct play, six channels, positional
`0x0000003F`. Two gaps remain, both cheap and both wanting the same session:

- **Criterion 1 is inferred, not observed.** The instantiated decoder's *name*
  was never captured — `dumpsys media.codec` was empty and logcat had rotated.
  Catch `OMX.realtek.audio.dolby.eac3.decoder` actually in use.
- ~~**Whether the panel renders six discrete channels downstream is
  unproven.**~~ **Captured 2026-09-22, and it answers the question in the
  unwelcome direction.** See §1.8 — the HAL output configuration and the effect
  chain on the active track were both read off `.133` during a film, and what
  they show is that the six channels reach the HAL intact and are then folded
  down by a path that has none of the set's own speaker processing on it.

### 1.3 Decoder instance limits — **measured 2026-09-20, and the shell check cannot settle it**

`dumpsys media.player` on the TCL `G10_4K_GB_NF_32BIT` reports, inside the main
hardware decoder `OMX.realtek.video.decoder`, **two different
`max-concurrent-instances` values for every video type it supports — `6` and
`1`** — and the dump's structure does not say which belongs to which profile
group. Other decoders in the same dump (`.vp8`, `.secure`, the Dolby Vision
variants) report their own `1`s and `2`s, which is what made an earlier reading
of "1 for hevc" look conclusive when it was an artefact of pairing names to
numbers with `awk`.

**So the answer is still unknown, exactly as this section predicted**, and the
fallback it named is now the only way: allocate a second decoder in the app and
observe. That is app work — prime a standby with a surface and see whether it
renders — and it is the same experiment Tier 3 (§2.1) needs anyway, so it
belongs there rather than in a shell check.

What the dump does rule out: there is no decoder here reporting a hard `1` for
*every* video type, so "this panel can only ever decode one stream" is not the
answer. Whether it can decode two **4K HEVC** streams at once on a 32-bit set is
a memory question as much as a decoder one, and neither number in the dump
answers it.

### 1.3a The original question, for reference

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

### 1.0 THE REAPED SESSION, RUN — and the recovery takes the expensive path

**Measured 2026-09-20 on the TCL at `10.35.1.133`, client 0.4.0, server 0.46.2.**
The first time any failover path in this client has met a real node.

**Method.** *Life of Brian*, which the chooser negotiated to a remux —
`FMP4`, `VIDEO COPY · HEVC · 1920×1040 · 9.8 Mb/s`, `AUDIO TRANSCODE · DTS 5.1
→ AAC 5.1` — served by `http://10.35.1.50:7438`. Paused through the UI at
0:15 (the media key: see the note on chrome below). Then, with the client
paused and believing in its session, deleted it on the owning node:
`GET 200 → DELETE 204 → GET 404`. Resumed. The session id came from the
on-screen diagnostic added the same afternoon, because the node exposes no way
to learn it (§1.4b).

**What the viewer saw: nothing.** Playback ran on out of the buffer and kept
going. No failure screen, no spinner anybody would notice, no stated error.
Law 2 was satisfied at the surface.

**What actually happened underneath is the finding.** The recovery did *not*
regenerate on the node that had reaped the session. It **failed over to a
different endpoint and rebuilt the generation worse**:

| | before the delete | after the recovery |
| --- | --- | --- |
| endpoint | `http://10.35.1.50:7438` (this site) | `https://ramaroja.macha.network` → **`10.34.1.50`** (the other site) |
| video | **COPY** · HEVC | **TRANSCODE** · HEVC 9.8 Mb/s → H264 |
| audio | transcode DTS 5.1 → AAC 5.1 | unchanged |
| session | `…::bf65f8dfa0a93a4c9f8e9a66dfd66d15` | `…::61bbd1356b699d636501ed9fd6e79e28` |

Confirmed from the nodes: `10.35.1.50` reported `sessions: 0` throughout the
recovery and after it, while `10.34.1.50` reported `sessions: 2` and
**`running_video_transcode_pipelines: 1`** — so the replacement is on the
cross-site node and is burning its single video transcode slot to re-encode a
stream the panel had been decoding natively.

**Why that matters beyond one film.** A reaped session is a statement about a
session, not about the node, and `not-found` exists so the client asks that node
again rather than condemning it. What this client did instead was leave a
healthy local node for a distant one and turn a copy into a transcode. On a
cluster where `max_video_transcodes` is 1, that also takes the slot away from
whoever asks next.

**The transcode has a cause, found by the core session the same evening**
(2026-09-20, by reading rather than measuring). Core's recovery POST carries
`mode` and **not** `video`/`audio`: `completePreferences` sends `mode`,
`maxHeight`, `maxBitrate` and the stream/language selections, while the
per-stream transforms are only merged on the *initial* create, from
`instructionPreferences(instruction)`. And the server rule since 0.34.0 — which
core's own docblock states — is that a request naming `mode` **restates the
whole transform**, clearing `video` and `audio` unless they are named again.
The segment container was restated for exactly that reason; the transforms were
not. So a recovery says "remux", drops the `video: 'copy'` that made it a copy,
and the node re-plans video from nothing. That matches the server's journal
precisely: the plan resolved to transcode from the preferences it was given,
with no substitution fired.

**And my own candidate was wrong, which is worth keeping.** I proposed the
recovery might be re-running the chooser without facts. It does not re-run the
chooser at all — neither `recoverFromSourceFailure` nor `prepareAlternate`
touches `choosePlaybackInstruction`; they pass the previous session's preference
echo, and the *node* chooses, with less than core knew. The `withoutFacts`
marker is a real condition and not this one.

**Core is not patching it blind**, and the reason is a good one: the same
preference list is used by failover, regeneration and standby preparation, and
it is not yet established whether the transforms should be restated from the
instruction core chose or from the session echo the node returned. Those differ
after a server-side substitution, and restating a node's own downgrade would
make one bad plan permanent.

**What is still not known: which path produced the recovery.** The probable explanation is
that `expo-video` never raised a *terminal* error at all — a `404` on a fragment
presents to it as a stall — so `reportTerminalPlayerFailure` was never called,
the classification probe never ran, and core recovered through the
**degradation** channel instead: stall watchdog → standby prepared elsewhere →
promotion. That would explain the endpoint change exactly, and it would mean the
`not-found` work cannot reach this platform's commonest reaped-session case at
all. **It is a hypothesis.** Confirming it needs the failure trail, which only
renders under a failure message, and this recovery never produced one — so the
next step is a diagnostic that can be read without a failure, not another run.

**Timing**, for whoever reads this next: resumed 13:42:01, still on the old
session at 13:42:35 (position 1:10), on the new one by 13:44:58 (position 3:11).
Roughly two minutes of media played across the swap, so the buffer covered it.

### 1.0c The trail is readable without a failure — **built 2026-09-20, unrun**

`PlayerScreen` keeps the last six warnings and errors at the top-left of the
picture whenever Diagnostics is on, for the whole of a film and independent of
the chrome. §1.0's recovery was invisible twice over: nothing on screen for the
viewer, which is Law 2 working, and nothing on screen for the person measuring
it, which is not.

**No new logging was needed.** Both channels already write warnings, and the
trail filters warnings and errors from *every* scope, core's included. What to
read, when the recovery happens:

| lines | the channel it came through |
| --- | --- |
| `playback stalled` → `playback.coordinator source-degradation-evidence` → `alternate-promoted-on-degradation` | **degradation** — the stall watchdog fired, core prepared a standby elsewhere and promoted it. This is the hypothesis §1.0 ends on. |
| `playback terminal-failure-classified` → `playback.coordinator source-reaped` / `session-reaped-regenerating` | **terminal** — `expo-video` raised an error, the classification probe ran and core took the `not-found` path. |
| `playback standby-promoted` | this client had a primed player and the swap was Tier 2 rather than a cold start. |
| `playback source-budgets` | a source was attached — the URL on that line carries the new session id. |

Three decisions in it, so they are not re-litigated:

- **Polled once a second, not rendered.** The player re-renders four times a
  second from `timeUpdate` already, so reading the buffer on render looks free
  — and it stops in exactly the case this is for. A stall stops the time
  updates, the renders stop with them, and the screen would freeze on the last
  reading taken *before* the interesting line. `trailSignature` keeps the poll
  from re-rendering the player when nothing has been logged.
- **Not tied to the chrome**, which hides four seconds after the last press,
  while a failover arrives minutes after anyone last touched the remote.
- **Six lines, not the overlay's twelve.** It sits over a running picture.

**This is a divergence from the web client and a deliberate one.** That client
renders the trail only under a failure because its buffer stays reachable from
a browser console, and its Android build bridges the same lines to logcat. A
release build here writes no console at all — `playbackLog` turns it off
outside `__DEV__`, because the bridge costs real CPU on this panel — and `adb`
runs over the link §0 calls the unreliable half. On screen is the only place
this can be read. The Settings note now says so.

### 1.0d Two things core wants from this hardware

Core built the fix for §1.0's transcode on 2026-09-20 and it is on core's
`develop` as `32da3e0`, unreleased — and because this repo's `develop` is
linked to `file:../macha-ts`, **it is already in this tree**. Verified rather
than assumed, 2026-09-20: `node_modules/@machafoundation/core` is a symlink to
`../macha-ts` (the lockfile says `"link": true`, so there is no cached copy to
go stale), the checkout on disk is at `32da3e0`, and `withRestatedTransforms`
is present in the `dist/` this client actually imports. **The APK on the
television predates all of it.**

Core asked for that check because the rule the link broke was written after a
real incident — a lockfile caching a link at `0.7.0` against a `0.11.1`
checkout, with a green suite hiding it — and `AGENTS.md` still forbade the link
outright while `develop` carried one. `AGENTS.md` is corrected now, with the
three commands that check the resolved copy; the one that matters is the last,
because core's `dist/` is built rather than committed and can lag its own
`src`. Three changes: the per-stream transforms are restated on
every recovery from the instruction core chose (not from `session.transform`,
which would make a server-side downgrade permanent); a single step down when a
replacement node refuses the copy with a `400`, so the fix cannot trade a
silent transcode for a terminal failure; and a standby is no longer treated as
interchangeable on mode and container alone, since `transcode` covers both a
passthrough and a full re-encode.

What only this set can answer:

1. **Would the replacement node have accepted `video: 'copy'`?** That is the
   difference between the fix restoring the passthrough and the fix merely
   making the refusal visible. Core's reading says accept. Re-run §1.0 after
   the rebuild and read the control bar.
2. **A `400` refusal on the copy, if it happens** — core asked for the
   evidence, and it is now a path that shows on the live trail. Capture body,
   status and `code`.
3. **What the create actually requested, beside what the node echoed.** Core's
   question, and it is the sharper one: *Life of Brian* showed as a `remux`
   whose audio was `TRANSCODE · DTS 5.1 → AAC 5.1`, and a remux copies every
   stream by definition. So either the node substituted, or that generation was
   a `transcode` carrying `video: copy` and the mode label and the echo
   disagree. Which of the two it is **changes what core's fix should send**, and
   only the set can say.

Core has confirmed, from its own call sites, that the restatement reaches only
`failover`, `regenerate` and `prepareAlternate` — the viewer's `update()` path
still lets `video`/`audio` clear, so the options panel's bare `{ mode }` press
stands and the `MODE_TRANSFORMS` deletion was not quietly undone. There is a
second guard inside the recovery path: the restatement applies only when the
instruction report describes the same mode being sent, so a viewer's pending
mode change is never carried by a recovery. **Answered, not to be re-derived.**

**Still open with the server session, core's question not mine:** the PATCH
half is confirmed — `parse_preferences` clears `video`, `audio`, `max_height`
and `max_bitrate` when `mode` is named, against 0.39.1 — but the fix rests on
the *creation* half, that naming `video: 'copy'` beside `mode` on a **new**
session is honoured rather than normalised away. Nobody here has read that.

And one thing this client owes core, asked the same day: **`instruction` is
rendered here only as the options panel's notes** — "Chosen by you", the
reasons, "Decided without: …", and the `withoutFacts` warning. The per-stream
lines in the control bar come from `describePlaybackSession(session)`, the
node's own echo. So the staleness core fixed was never visible here, and the
fix changes only those notes.

**Raised back to core, unanswered:** a viewer mode press from the options panel
deliberately sends `{ mode }` **alone** and lets the server re-derive
(`playbackOptions.ts`, where `MODE_TRANSFORMS` was deleted for reasons worth
re-reading). If the restatement is applied to viewer-initiated updates and not
only to recovery, this client would start pre-stating what a mode implies per
stream — which is the server's judgement and is exactly what that deletion
refused to do.

### 1.0e The web client's handover fault does not have a shape here — checked, not measured

The web session measured, on 2026-09-20: a replacement generation on
**transcode** never becomes attachable, because it starts where the viewer was
while the join is where the viewer *will be*, and a software encoder does not
outrun realtime — so the join recedes as fast as the encoder approaches it, the
wait expires at thirty seconds, and the fallback attaches a generation created
thirty seconds ago, rewinding the viewer about twenty. Remux and direct are
fine: a copy outruns realtime.

**This client cannot fail that way, because it does not wait for a join.**
`promoteStandby` swaps the surface to the primed player and sets `currentTime`
directly; there is no two-element handover and nothing waits on a buffered
target before cutting. Read from source on 2026-09-20 and **not measured**.

What is worth measuring here instead, and is the same fault standing on its
head: the standby buffers the replacement **from that generation's start**, and
a promotion then seeks it to the live position. On a transcode, that position
may be ahead of anything the node has encoded — so where the web client rewinds,
this one would sit on a seek that cannot complete. Unobserved. It wants a
sitting on a transcode title.

**Their 6 s is a principle, not a constant** (web session, 2026-09-20): it is
`HANDOVER_CONVERGENCE_WINDOW_MS`, and it is one segment plus margin, because a
rate read from inside a single segment measures the segment boundary rather
than production. Their segments are 4 s on this cluster. **If a window is ever
built here it has to clear this panel's segment duration**, not copy the six.
And if this client ever abandons a replacement, the abandon is different: not
attach-at-live-position, but decline the promotion and leave the viewer on the
generation they already have.

### 1.0f The reap, run twice — what is settled and what replaced it

**Settled 2026-09-20 (evening), on hardware, and not to be re-derived.** Full
method and figures in `COMPLETED.md`.

- **A reaped session arrives as a terminal error**, carrying its status in the
  message: `A playback exception has occurred: Source error Response code:
  404`. No `stalled`, no `alternate-promoted-on-degradation`. §1.0's hypothesis
  — that `expo-video` presents a fragment `404` as a stall, so the failure
  channel is unreachable here — **is wrong and is withdrawn**, including from
  what was told to core.
- **Core's recovery fix (`32da3e0`) holds.** The replacement kept `video: copy`
  — screen, session payload and `running_video_transcode_pipelines: 0` on both
  nodes all agree — and it came back to **the local node**, not across the
  site.
- **7.2 s** from failure to new source, covered by the buffer. Nothing visible.
- **The generation was never a remux.** `mode: transcode, video: copy`,
  straight from the node. The word "remux" in §1.0 was ours.

### 1.0g What media3 does with a status, read from the shipped artifact

**Read on 2026-09-20 from `media3-exoplayer-1.9.0.aar`** — the version
`expo-video` pins (`node_modules/expo-video/android/build.gradle:21`) —
by disassembling `DefaultLoadErrorHandlingPolicy`. Asked for by core, which is
deciding whether `segment_not_ready` should stay a `500`.

- **`getRetryDelayMsFor`** gives up (`C.TIME_UNSET`) for exactly five things:
  `ParserException`, `FileNotFoundException`,
  `HttpDataSource$CleartextNotPermittedException`,
  `Loader$UnexpectedLoaderException`, and a position-out-of-range
  `DataSourceException`. **A response code is not among them.** Everything else
  — including `404`, `425` and `500` — retries after
  `min((errorCount - 1) × 1000, 5000)` ms.
- **`isEligibleForFallback`** is true for `403, 404, 410, 416, 500, 503`.
  Fallback means switching track or location and **excluding the one that
  failed for 300 s** (or 60 s at the second level).
- So on this stack a `4xx` does **not** stop the retry, and the current `500`
  is in the *fallback* list — it asks media3 to hold this location against the
  node for five minutes, which is the opposite of "the node is working, ask
  again". A `425` would be retried and would not blacklist anything.

**Untested against a live node**, and that is the honest limit of this: it is
the shipped policy read from bytecode, not a `425` served to this television.

### 1.0h What `expo-video` throws away, and it is a wrapper gap

`PlaybackError` (`node_modules/expo-video/android/src/main/java/expo/modules/
video/records/PlaybackError.kt`) has **one field**, `message`, built as
`"A playback exception has occurred: ${localizedMessage} ${cause?.localizedMessage}"`.
`PlaybackException.errorCode` is not forwarded, and neither is anything else.

**The information exists one layer down.** media3's
`HttpDataSource$InvalidResponseCodeException` carries `responseCode`,
`headerFields` and `responseBody`. So the limit is `expo-video`'s record, not
media3 — which makes it a gap somebody could close (a patch, a fork, or the
native engine this repo already has in `modules/macha-player`) rather than a
property of the platform. Recorded because core asked whether it was permanent.

**And the timeouts are not media3's.** `buildBaseDataSourceFactory` sends every
`http(s)` source through `OkHttpDataSource` built on a bare
`OkHttpClient.Builder().build()` — so the deadline is **OkHttp's default 10 s
connect and 10 s read**, not media3's `DEFAULT_READ_TIMEOUT_MILLIS` of 8000.
Core's `docs/writing-a-player.md` lists 8000 for this stack and is wrong for
it. (`modules/macha-player`'s own engine sets 8 s and 15 s, but that is not
what ships.)

### 1.4a The node's "unused session" reaper does not fire for direct play

**Measured 2026-09-20 on `10.34.1.50`, server `0.46.2`.** The node reports
`session_unused_idle_ms: 120000` — two minutes, not the thirty of
`session_idle` — and `unused_sessions_reclaimed: 2`, so the reaper is live on
that node rather than theoretical.

A **direct-play** session was then paused deliberately and watched for **four
and a half minutes**: `sessions` stayed `1` and `unused_sessions_reclaimed`
stayed `2` throughout.

**Answered by the server session the same day, and the name is the trap.**
`session_unused_idle_ms` means *"has never served a stream object"*, not *"has
been idle"*. A session carries a `stream_served` flag set the first time it
serves anything — playlist, fragment, subtitle, or a Direct Play ranged body —
and never cleared after. Once set, the session gets the full
`session_idle_ms` of thirty minutes. Direct play sets it explicitly, with the
rationale that "a single ranged body can outlive several idle windows without
another request". So the short clock exists to stop a session that was created
and abandoned from holding a transcode entitlement; it was never going to reap
a paused viewer.

**It matters for testing rather than for viewers.** The two-minute clock looked
like a way to reproduce a reaped session without waiting out `session_idle`,
and it is not one, at least not for the mode this panel actually plays in. The
web client's recipe — delete the session out from under the paused client — is
still the only quick reproduction, and it needs a session id the node does not
expose (§1.4b). Asked of the server session on 2026-09-20.

### 1.4b No way to find a playback session id from outside the client — **until the route change (§2.10) ships**

`GET /api/v1/playback/sessions` answers `404 not_found` — there is no list
route — and `GET /api/v1/playback/status` gives a session *count* and no ids.
The id is in the stream URL, which this client logs to the failure trail
(`source-budgets`) and therefore shows only when playback has already failed.

So reproducing the reaped-session case on this client currently needs either a
way to list sessions server-side, or a diagnostic that shows the current
session id on screen. The second is a small change here and would make the test
repeatable; it is not worth doing until the first is ruled out.

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
capability block on the Settings screen and were never reached; the screen
scrolls now, so this is a matter of looking.
The three `titleIndex` probes core added on this client's prompt are in that
block, so §4.3's `AlphabetIndex` still has no runtime evidence behind it.

### 1.7 What a dead `expo-video` player still reports

Cheap, and it decides a real thing. After a terminal error, does the player
still answer `currentTime` and `bufferedPosition` for the buffer it was holding,
or do they collapse to zero?

**Not load-bearing, and deliberately so** — §2.6 records why this client does
not emit a last event before reporting, and core owns the staleness fix either
way. What this answers is narrower and still worth knowing: it is a real fact
about this host, it tells core what shape its guard needs (its existing one
covers the position and not the buffer), and it is the difference between
`unknown` on a platform quirk and `unknown` on a node that genuinely said
nothing. **Do not let it block anything.**

Provoke it the same sitting as the pause case: kill the node mid-film, or point
the player at a URL the node has reaped, and read both values in the
`statusChange` handler on the failure trail.

**Do not read the web client's number as an answer to this.** They measured
their own last-published event against the live element at **7 ms** at a reap,
which sounds like it settles the question and does not: that run had events
still arriving, because a reaped generation goes on emitting while its buffer
drains. The case here is the player that has *stopped*. Their figure is evidence
that the snapshot can be current when the stream is alive, and silent about the
case this asks.

### 1.9 A catalogue `503` is reported to the viewer as every endpoint failing — 2026-09-22, cause traced 2026-09-23, **not fixed**

**Measured against the node with a token that demonstrably holds
`media_viewer`, no client involved:**

    GET /api/v1/catalogue/items   ->  503, three of three
    {"error":"catalogue_unavailable",
     "message":"catalogue metadata durability unavailable:
                a tree-backed namespace requires an exact delta"}

That is a server condition and Tom stood the client work down for it. What it
exposed here is ours.

**The Home screen renders that as "All configured Macha API endpoints
failed."** The server was online at `0.51.0`, answering, with playback
available and the one configured endpoint healthy — the *catalogue* was down.
The Settings screen gets it exactly right in the same moment: **"Server online;
catalogue unavailable"**, with `PLAYBACK: Available` beside it. So the client
holds the correct information and Home throws it away.

**Why this is the same fault class this file keeps recording**, rather than a
wording nit: it is "we could not ask" presented as "everything is broken", one
layer down from the distinction `access.ts` exists to preserve. A viewer told
their endpoints have failed will go and edit endpoint settings that are not
broken — on a television, with a D-pad, to fix something that was never wrong.
The endpoints had not failed; one API family on a healthy node had.

~~Unexamined: whether the endpoint registry is *marking* endpoints failed on a
`503` from the catalogue, or whether Home is only wording an error badly.~~
**Examined 2026-09-23. It is both, and the registry half is core's.**

**Read from core at `a3b40ca` (0.18.0), `src/cluster/endpointRouting.ts` and
the matching `dist/cluster/endpointRouting.js` — asserted from the
implementation, not measured against a node.** The walk is right and the charge
is wrong:

- `retryableEndpointFailure` returns `true` for any `5xx`
  (`endpointFailure.ts`, `status >= 500 && status <= 599`), so the `503` walks
  every candidate. **That part is correct** — a `5xx` can be node-local, and
  the comment above it says so.
- `route()` then records the failure against **every** endpoint it walked, with
  no gate: `advisory ? recordProbeFailure : recordFailure`. `find()` and
  `mutation()` do the same. Only `pinned()` asks `failureBlamesEndpoint`.
- The catalogue condition was identical on every node, so the walk charged the
  whole cluster for one API family and threw `MachaClusterRouteError` with
  `unreachable: false`, whose message is the literal string Home showed.

**So Home is not wording anything badly — it is showing `error.message`
verbatim**, and for an exhausted walk that message is exactly "All configured
Macha API endpoints failed." Core assembled a true sentence about the walk;
what is false is the conclusion a viewer draws from it, and Settings gets it
right in the same moment only because it reads catalogue health directly
instead of inferring it from a routing error.

**The second half is bigger than this client and was reported to core the same
day** (message `167950ec`, 2026-09-23): `failureBlamesEndpoint`'s own docstring
says it is "the charge gate, and the only one. Every site that records a
failure against the registry asks this" — and three of the four sites do not.
The docstring even names the consequence — *"the moment the walk was corrected,
the charge would have followed it onto every healthy node in the cluster"* —
and that is the state the walking paths are in, for `429
account_session_limit` as much as for this `503`. **Read the loop, not the
comment beside it**, which is the rule that comment itself states.

**Still ours, and it does not go away when core fixes the charge**: even with
the registry corrected, every node really is refusing, the walk really does
exhaust, and Home will still print core's sentence. Two things follow, and
neither needs a set:

1. `ErrorMessage` and `RefreshError` in `src/components/Status.tsx` render
   `error.message` raw. That is the exact practice core's
   `playbackFailureDetail` docstring exists to retire — it records three
   clients putting *"Macha endpoint http://10.35.1.50:7438 failed: …"*, two of
   core's envelopes and a node address, in front of a viewer. `failureCopy.ts`
   already does this properly for the player and is the model; the catalogue
   screens never got the same treatment, and `failureCopy` itself still falls
   back to `error.message` for its headline rather than
   `playbackFailureDetail`.
2. Whether a `503` on a catalogue route should cost a node its place in the
   candidate list at all still belongs beside §2.8's status mapping — but it is
   now a question **to put to core**, not one to answer here.

**Unverified, and it is the part a television would have to answer:** what the
escalating cooldown actually did to the candidate list while the catalogue was
down. Nothing was read off a set — both were off by the time this was traced,
and the `503` has since cleared, so reproducing it needs the server condition
back.

### 1.8 Quiet, and slightly out of sync — measured 2026-09-22, and the cause is that we hand the set six channels

**Tom, watching a film on `.133`: the sound is slightly out of sync, and the
overall volume is very quiet.** Both are the same root, and the good news comes
first because it is the part this repo has been chasing for a fortnight.

**Measured during playback, app pid 4412, `The Hunger Games`, direct play,
AAC 5.1 48 kHz:**

| | |
| --- | --- |
| Audio route | `AUDIO_DEVICE_OUT_SPEAKER` — the set's own speakers |
| `STREAM_MUSIC` on speaker | **86 / 100** |
| Our output thread | `AudioOut_8D`, **type 1 (DIRECT)** |
| Channels / mask | **6**, `0x0000003F` — positional (FL, FR, FC, LFE, BL, BR) |
| HAL format | PCM 16-bit, 48 kHz |
| Track gain | `G db 0 · L dB 0 · R dB 0 · VS dB 0` |
| Underruns / flushed | **0 / 0** |
| Effect chains on our thread | **0** |
| Threadloop write latency | ave 196.9, std 1.6, min 163.3, max 205.0 |

**`docs/HISTORY.md`'s downmix criteria 2 and 3 both hold.** Six channels reach
AudioTrack with a *positional* mask — not the `0x8000003F` index mask that
defeats the web client. **This client direct-plays 5.1 correctly**, and that
standing unknown is answered in this client's favour.

**And that is exactly why it is quiet.** The track sits on a **DIRECT** output
thread, which bypasses AudioFlinger's mixer — so the fold-down the positional
mask makes possible never runs, and the set's HAL has to fold 5.1 into two
speakers itself. `0 Effect Chains` on our thread is the sharp end: the same dump
shows effect chains on the mixer threads, so **the set's own speaker
processing — the loudness and EQ that make a thin panel audible — is applied to
everything on the television except us.** Nothing in AudioFlinger is attenuating
us; we are skipping the stage that would make it loud.

The sync half shares the root: ~197 average write latency on that DIRECT path
with **zero** underruns. Not dropouts — a sink latency that leaves picture ahead
of sound.

There is an irony worth keeping. `Capabilities.kt`'s header says this app exists
*because* the WebView client loses dialogue to a six-channel track the mixer
cannot fold down. Here the mask is fold-downable — but we are not on the mixer.

**What is asserted rather than measured:** that the TCL's DIRECT path genuinely
mishandles the fold-down. That is inferred from the architecture and the
symptom; nothing has been measured at the speakers. And whether forcing stereo
fixes both is untested — the cheap check is the player options panel's Audio
group, picking a 2.0 track if the file carries one.

#### The fix, and why it is ours

**Nothing in this client reads the audio route.** No `AudioManager`, no
`AudioDeviceInfo`, no `channelCount` anywhere in `modules/` or `src/` — checked.
`Capabilities.Inventory` reports `audioCodecs` and never how many channels the
sink can take, so core is told "this set decodes AAC, AC-3, E-AC-3" and
reasonably direct-plays 5.1.

That is an asymmetry with video, and the precedent sits beside it: **Dolby
Vision is gated on the *display*, deliberately** — `.115` has DV decoders its
panel cannot present and `Capabilities.kt` withholds it. Audio has no equivalent
gate on the *route*.

So: when the active output is the set's own speakers, do not advertise
multichannel. Core then picks a stereo track or has the node fold down, and we
land on the mixer with the set's processing on it. `Capabilities.read(context)`
already takes a `Context` and already reads `Display`; `AudioManager` is the
same shape, in a module we own. **It needs nothing from `expo-video`**, because
it changes what we ask core *for* rather than how the player renders — which
matters, because the technically nicer fix does not: asking the decoder for
`max-output-channel-count = 2` needs a custom `RenderersFactory`, and
`expo-video` exposes no injection point (§2.0's wrapper gap).

It would need an `AudioDeviceCallback` so plugging in a soundbar mid-film
re-opens 5.1.

**Boosting gain in the app is not an option and should not be attempted:**
ExoPlayer's volume is 0..1, so there is no turning it up past unity, and
`VolumeStore` already defaults to 1.

**Open for Tom:** take the capability gate now, or run the stereo-track A/B on
the set first. Neither is started.

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

Mode, quality, audio track, subtitle track and source switching, as a block
inside the chrome above the scrubber — the web client's shape since
2026-09-19, not a side pane — with its own focus scope. Back closes it, and so
does Down from the last row.

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

**`VolumeStore` is wired** (2026-09-13) and persists across sessions; the
chrome *control* for it was **removed 2026-09-19** at Tom's call (§4.2). The
store stays because core's `setVolume` applies the remembered level and a
promoted standby comes up at it.

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
`ENDPOINT_TRANSPORT_ALLOWANCE_MS`.

**The floor's justification was wrong the first time and is worth stating
correctly**, because the corrected version is the stronger argument. It is not
a comparison with a cold start. A terminal `unknown` with no cover is endpoint
evidence, so it goes to failover, and negotiating a generation on the new node
is bounded by `generationAttemptBudgetMs()` — the node's `startupTimeoutMs`,
15 s by default, plus the transport allowance. **About 19 s on a node holding
nothing for this title**, against a `not-found` at zero cover, which regenerates
on the node that is already warm and already configured. Four seconds spent to
avoid nineteen. The two figures first cited here — 9 s and 4 s — are real
measurements of other things: a join point built past a node's look-ahead
frontier, and this same allowance elapsing on a dead node. The core session went
and read both, which is the only reason it is right now.

**The runway is the last figure the event stream carried, less the time since it
was carried.** Core reads its own `elementRunwayMs()` off its last event for the
same reason — a player in its error state may report nothing about a buffer it
still holds — so this is core's quantity on a host with no read-ahead rather
than an approximation of it. The subtraction is the core session's finding,
made while reading this for a different question: **a last known value does not
decay and the buffer it describes does**, so a stale sample grants a walk more
time than the viewer has. Core has the same exposure at its own deferral
decision and has recorded it there.

**And the staleness does not end at this adapter.** Core's *terminal* path is
exposed worse than its deferral one, which the core session found on being told
this client's version: `recoverFromMissingSession` awaits `sessionAlive()` — a
router walk with its own deadline — and only then reads `runwayMs()`
(`PlaybackCoordinator.js:2016` and `:2050`, verified in the package this tree
compiles against). So the cover figure core builds a replacement against is
stale by the time since the player stopped emitting, **plus this adapter's
probe, plus core's own**. Three terms, and until this exchange nobody was
counting any of them. Core owns the fix; what it costs here is an argument for
keeping the probe budget tight, which it already is.

**Emitting one last event before reporting was the obvious fix for the first
term, and it is the wrong one.** The plumbing works — `onPlayerEvent` is
synchronous, so an event emitted immediately before the failure listener does
reach `snapshot.event` first — and the hazard it would introduce is one core has
already met on another host. Verified here: as an element tears down it can
report a position of zero, and core guards that with a forward-only
`Math.max(reported, lastObserved)` (`PlaybackCoordinator.js:1659`) — but **only
on the position, and only while a failover is in flight.** `forwardBufferMs`
goes through untouched in the spread below it. So a player that zeroes its
buffer on the way down would write `forwardBufferMs: 0` into the snapshot,
`elementRunwayMs()` would return 0, and the deferral test would go straight to
`no-cover` — spending precisely the cover the exercise was meant to protect.

So **this client does not emit, and this is not a host obligation.** Doing it
would remove one term of three and only be safe after core changes anyway,
while core can close all three alone by re-reading the runway at the decision
point rather than trusting a snapshot taken before two round trips. Four hosts
each doing something partial to fix what core can fix once fails Tom's test in
the direction that matters. Core owns it and has taken it.

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
and the trail that shows them is switchable as of 2026-09-19.

### 2.7 Finishing the `0.14.0` port

§2.6 is what the port *took*. This is what it left, highest first. None of it
blocks anything; all of it is the difference between consuming core and being
ported onto it.

**Tom ruled on all eight, 2026-09-19.** What is done is marked done; what is
left carries his answer.

**2.7.1 The acquisition budget is core's — done.** `FIRST_FRAGMENT_TIMEOUT_MS`
was `SERVER_SEGMENT_HOLD_MS * 5`, and the five was this client's. It is now
`generationAttemptBudgetMs()` — 19 s, being the node's `startup_timeout_ms` plus
core's transport allowance — so **both branches of `firstFragmentTimeoutMs()`
are core's**, stated by the node or derived from the server's defaults for one
that cannot say. The `* 3` in `readiness.test.ts` went with it: it asserted
nothing the old definition did not already say, and the requirement worth
pinning is that the budget clears more than one hold, not a multiple this client
no longer chooses.

**2.7.2 The start watchdog takes the node's figure too — done.** Core supplies
it the same way (Tom: *the core also gives you this*), but through a different
door: `MediaStallWatchdog` takes budgets through `useSourceBudgets()`, while
`MediaStartWatchdog`'s is a **constructor argument**, so the equivalent is a
fresh watchdog per attach rather than a setter. Left alone it judged every node
by `MEDIA_START_STARVATION_MS`, 20 s compiled in. A test pins it against a node
stating five.

**2.7.3 The seek triple — best judgement, then measure.** Left as it is: this
client renders position from core's snapshot, where the coordinator has already
applied `streamOffsetMs`, and nothing here re-derives an origin. So it should be
free. **It is still the thing to check first if a readout ever disagrees with
the picture** — the web client measured exactly that, 18.12 s constant on a
remux generation, and believed it was free too. One remux title on the set
settles it: compare readout to picture, and read `seekMs + seekOffsetMs ===
seekRequestedMs` back off the session.

**2.7.4 What the node said is on the trail — done.** Answered by 2.7.1 (Tom:
*you have your answer in 1*): the figures to show are core's, so there is
nothing local to invent or to keep in step. `startWatchdogs()` logs the stated
`deadlineMs` and `segmentHoldMs`, and the budget actually applied, at every
attach. Absent where a node is too old to say, which is itself the useful
reading. Readable now that Settings scrolls.

**2.7.5 Leave the Kotlin engine alone.** Tom: *it works right now, so don't go
breaking it.* `PlayerEngine.kt` keeps its `readTimeoutMs = 15000` and
`responseCode == 500` literals, and `timingBudgets.test.ts` goes on reading them
back out of the source so they cannot drift from core in silence. Not a debt to
pay down — a working component not to disturb for tidiness.

**2.7.6 Buffer ahead as the web client does — done, and it was not a
no-op.** The question in this row was whether `readAheadBytes` meant buffering;
it does not — it is a *host-side byte cache*, which the web client has only
because a browser element cannot read ahead on Direct Play by itself, and which
nothing here needs. **But the underlying requirement was real and this client
was failing it.** `expo-video` defaults Android to 20 s of forward buffer where
the web client configures hls.js to 60 (`WebHlsPolicy.webHlsBufferConfig`, read
there). Three times less cover, in exactly the quantity core defers a
replacement behind and this adapter spends classifying a failure. Now 60 on both
the active player and the standby.

The byte ceiling is deliberately *not* copied: theirs is 128 MB on a desktop
browser, this set is `armeabi-v7a` with no arm64, and an allocation failure
mid-film is worse than a shorter buffer. `maxBufferBytes: 0` leaves the ceiling
to the platform and `prioritizeTimeOverSizeThreshold` stays default, so size
still wins over time on a 4K HEVC bitrate. **What forward buffer is actually
reached on a high-bitrate title is unmeasured** and belongs in the same sitting
as §1.7 — as does whether two players holding a minute each is survivable on
this hardware (§1.3).

**2.7.7 There is a television for it, and it is now §0's single next
action.** The set at `10.35.1.133` has the app; the pause case exercises most of
§2.6 at once and the trail that reads it is switchable.

**2.7.8 Docs get cleaned up afterwards.** Tom's call; not now.

### 2.8 The `404` never reaches the mapping — **diagnosed 2026-09-20, and the fix is core's**

**Not one of the four candidates this section first listed.** Read from core
rather than guessed, and the path is exact:

1. The session is reaped, so the **master playlist** answers `404`.
2. `hlsWalkTargets` fetches it and, on a non-ok manifest, **returns `[]`**
   (`hlsWalk.ts:436`) — the status it just saw is dropped on the floor.
3. `probeHlsReadiness` sees no targets and reports
   `{ state: 'unassessable', reason: 'empty-manifest' }` (`hlsWalk.ts:537`).
   Its `status` field only ever carries a **fragment's** status.
4. `kindForTerminalError` requires `state === 'unavailable'` *and* a status, so
   it answers `unknown` — and, until tonight, said nothing about why.

`playbackFailureKindForStatus(404)` returns **`not-found`**
(`streamProtocol.ts:153`), which is the contract the whole `not-found` design
exists for: ask that node again rather than condemn it. The evidence was
fetched, seen, and discarded one layer above us.

**Why the fix belongs in core.** A manifest answering `404` is exactly as much
evidence as a fragment answering `404`, and the walk is the only thing that
ever sees it. Core can return `{ state: 'unavailable', status }` from the
manifest fetch as it already does from the fragment fetch. Doing it here
instead means re-requesting a URL core has just requested, on the viewer's
critical path, to learn something core already knew — and every host would have
to do it. **Raised with core 2026-09-20 with these line numbers.**

**What this client did about it meanwhile**, since the fix is not ours:
`terminal-failure-unclassified` now goes on the trail whenever the
classification declines to map — carrying the walk's `state`, its `reason` or
`detail`, and for an aborted walk the budget it was given. A silent `unknown`
was the reason this took a fortnight and a hardware run to find; it will say
which verdict it got next time, whatever the cause turns out to be.

**Why it is worth core's attention rather than being cosmetic.** `unknown` is
not neutral: core reads it as evidence against the *endpoint*. So the node that
behaved correctly — a reaped session is a statement about a session, not about
a node — got charged for it, and the client walked a whole generation where
`not-found` would have asked the same node to regenerate. On 2026-09-20 that
cost a cross-site hop; the only reason it cost nothing visible is that the
pause had left six minutes of buffer.

**Still to confirm on hardware:** that the new line reads
`state: unassessable, reason: empty-manifest` on the next reap. One press,
whenever the set is next on.

### 2.9 What the peers measured for this client, 2026-09-20

Three things arrived from the web session and core the same evening. Recorded
here because each one closes or re-points something this file was carrying.

- **The AAC-only HLS narrowing costs two titles out of 1010** (web session,
  their `playback-baseline.mjs` run against fi-1 with a capability set shaped
  like this panel). Widening `hlsAudioCodecs` from `["aac"]` to
  `["aac","eac3","ac3"]` moves exactly two items from
  `video:transcode audio:transcode` to `video:transcode audio:copy`; 989
  direct-play either way. **The sixteen titles whose audio is transcoded are
  DTS**, which widening to eac3/ac3 does not reach. So §1.6's worry is real but
  small on this library, and `MachaPlayerModule.kt`'s claim is **not** worth
  re-testing until the library gains eac3 rips. Per-title breakdown available
  on request.
- **fi-1's budgets, from `GET /api/v1/status`**: `startup_timeout_ms: 15000`,
  `segment_timeout_ms: 6000`, and core derives `deadlineMs = 19000`,
  `segmentHoldMs = 6000`. `stream.look_ahead_ms: 32000`. This client read
  `startBudgetMs: 19000` off its own trail on the set the same evening, which
  agrees. macnessa is still 0.43.0 and reports `{}`.
- **fi-1 transcodes 1080p HEVC 10-bit at 1.49x realtime**, first fragment
  3.8 s, *including* pulling the source across the link from es-1. That is the
  number that killed the assumption a transcode cannot outrun a viewer, and it
  is why the web client's handover fault was a join-placement bug rather than a
  timeout being too short.

**Two warnings that apply here whether or not anything changes:**

- **A playback session is keyed on the bearer token** (server session, from
  `src/playback.cpp:2236`). A second POST on the same token supersedes whatever
  that token was playing, **across all media**, reusing the session id and
  incrementing the generation; the old generation's segments 404 within about a
  second. `Macha-Viewer-Session` is read nowhere in the server. Core is clear
  of it incidentally — standbys always go to a different node, regeneration
  releases first, seeks are a PATCH — and **so is this client, for the same
  reasons**. But it forecloses one optimisation permanently: a same-node
  standby, or anything else that creates a second session to cut to, is a black
  screen and not a second generation.
- **A mid-playback representation change is the join arithmetic again.** The
  web client measured a PATCH mode-switch taking 11.5 s, the client then asking
  for the position the viewer *had been* at, the node having produced 1.96 s of
  it, and a terminal failure 7 s later: sixteen seconds of black, no rewind.
  **If this client's options panel ever seeks to the pre-change position after
  a representation change, it has the same fault**, and it would read as
  "changing quality sometimes hangs". Unchecked here — `PlayerOptions` applies
  through `runtime.update`, and what core does with the position afterwards has
  not been read.

### 2.10 The playback route is moving, and it does not reach this client's code — 2026-09-21

**Core is driving a server change** (planned in the server repo,
`TODO/2026-09-21-playback-sessions-as-a-resource-plan.md`, not yet
implemented): playback sessions become a REST resource. `GET
/api/v1/playback/sessions` **appears** (the account's live sessions, under
`items`), and the stream moves under the session —
`/api/v1/playback/sessions/{id}/stream/{token}/{generation}/{name}` and
`…/stream/{token}/direct`. **`/api/v1/playback/stream/…` is removed outright**,
no dual-serve window: every node is Tom's.

**Grepped 2026-09-21, not recalled: this client composes no stream, segment or
API path anywhere in code.** `source.url` goes straight to `expo-video`
(`videoSourceFor`), and every probe is core's walk over `source`. The only
hits are comments: `ExpoVideoAdapter.ts:199/:202` (which already say the URL
shape is the server's to change) and **`PlayerScreen.tsx:367`, which justifies
the on-screen session id with "`GET /api/v1/playback/sessions` is not a
route" — that sentence goes stale the day the node moves.** The id stays
worth showing (it is how a reap is reproduced from a laptop); the comment
needs rewording then, and §1.4b with it.

**What does reach here: a per-account session cap ships in the same change**,
because removing one-session-per-bearer leaves nothing bounding an account. A
cap refusal is a new outcome on create; core has asked the server for a
distinct `4xx` code, since a `5xx` would have core walk the whole cluster
collecting identical refusals and charge every healthy node. Core routinely
holds **two sessions and transiently three** for one viewer — this set showed
exactly that tonight, a standby on another node beside the generation being
replaced — so a cap of 2 would read as failover ceasing to work when it fires.
Told core from this household's seat: two televisions, a phone and a web
client on one account is four viewers before any standby, so anything under 8
looks tight. **Landed at 32 per node per account** (`streaming.max_sessions_per_account`,
zero disables; server, 2026-09-21) — the server's arithmetic was the same
four-viewers-times-two-to-three-plus-strands. Comfortable. A refusal on this
set therefore means something has genuinely run away, not that a family is
watching.

**Superseded 2026-09-21: core published `0.18.0` and `main` is on it** (see
§0 and `COMPLETED.md`). The paragraph below is kept as the record of why the
publish waited and what it was waiting on; the "bump-and-release is off"
ruling ended when 0.18.0 went to npm, and 0.6.0 shipped against it the same
day. Whether every item listed below is in 0.18.0 was **not** checked item by
item — `dist` was grepped for the symbols this client imports, nothing more.

~~**The release this repo waits for is named: core `0.17.0`**~~ — the name of the
thing being built, which keeps accumulating under that number until it is
proven and published; `0.15.0`/`0.16.0` were waypoints and mean nothing. It carries the `410` tolerance, the `429
account_session_limit` tolerance, `playbackFailureCode` /
`isAccountSessionLimit`, the walk fix, the bounded recovery and close, and
the two log levels. **Not on npm, and not because of anything to clear: Tom has ruled
"nowhere near ready to publish… no publishing to an immutable repo" and
"hotlink for now so we can actually test this works"** (2026-09-21, relayed
by core; this file briefly said the publish was blocked on an `npm login`,
which was core's first framing and wrong). So **bump-and-release is off**
until this is proven on the set: `0.5.0` stays on `^0.14.0`, `develop` links
core's tree, the reaps run against it, and the publish follows the evidence.
`0.17.0` stays named as the eventual target. **The cap sentence is built**
(`failureCopy.ts`): core decides it is the cap, this tree never spells the
code, the viewer reads "Another screen on this account is playing…", and the
raw code goes to the trail and the small print. It cannot fire until the
server ships the cap.

**The two 429s carry opposite `alternative_may_succeed`, and codes are the only
complete signal.** The account cap answers `false`, a `410` answers `true`, and
both sit on the same `scope: request` / `node_healthy: true` — so anything
reading the axes to decide whether to walk would draw opposite conclusions from
identical-looking pairs. The node-scoped refusal (`ResourceLimitError`) carries
**no axes at all**. Relayed and measured by the core session at
`playback.cpp:3302`; nobody here has opened the server tree.

**This client is insulated from that, and the insulation is undocumented, which
is how it gets removed by accident.** Nothing here reads the axes:
`failureCopy.ts` takes core's `isAccountSessionLimit`, which keys on the failure
*code* against a set holding exactly `account_session_limit` — verified in the
artifact this client loads, `dist/cluster/endpointFailure.js:148`, with
`resource_limit` deliberately absent. `429` appears nowhere in this tree's `src`
outside three prose comments. **So a node-scoped 429 cannot read as the account
cap here** — and the mobile session's `classifyCreateRefusal` fault cannot take
that shape on this client. Keep it that way: the refusal is a code, never a
status, and never an axis.

**Sequencing: core's `410` tolerance is in the linked tree and in the waiting
APK; the nodes move on Tom's word, cap included, and testing follows the
cutover** (ruled 2026-09-21 — see P-1). The published `0.14.0` also absolutises
whatever the node returns (`MachaPlaybackResolver.js:348` in the tarball,
checked), so `0.5.0` survives the route move too; what it lacks is the
tolerance, which only matters if a node answers `410` under it. Core today reads a `410` as `unknown`, and
`unknown` is endpoint evidence (§2.8's lesson): a node moving under a client
without the tolerance charges a healthy node and builds a standby that cannot
help. So **the bump `0.5.0` waits for is the tolerance release, not
`0.15.0`** — `0.15.0` is cut (walk fix, bounded close, supervision, the two
log levels; one breaking change in `hlsWalkTargets`, which this client does
not call) but **not on npm**, and nothing goes to npm without Tom's word.
Core will name the version; then: remove `node_modules/@machafoundation`,
`npm uninstall`, `npm install @machafoundation/core@^x.y.z`, read `resolved`,
gate, release.

### 2.11 "Macha is working on it" — **Tom, 2026-09-23. Not started**

**The trigger, in Tom's words: any recoverable *error* — anything which might
unavoidably make the viewer wait.** The visual is the splash screen's Macha
logo, small and subtle, **top right, over the video**. What it says to the
person on the sofa is *Macha is working on it*.

**This is not a stream-switch indicator**, which is how it was first written up
here and was too narrow. It is a **recoverable-wait** indicator. The distinction
that matters is not what the client is doing — failing over, regenerating,
holding for a fragment — but what the viewer is experiencing: the picture is not
moving, and that is not a fault.

#### The gap it fills, which is worse than it looks

The client already computes this information and already renders it —
`PlayerScreen.tsx:551` shows `playback.notice`, falling back to
`preparingSource` with the endpoint currently held, so watching that line
through a failover shows how far round the cluster it has got.

**And the whole block is behind `chromeVisible || playback?.fatalError`
(`PlayerScreen.tsx:535`).** The transport auto-hides. So the one case this
exists for — a viewer who is not touching the remote when a node dies — is
exactly the case where the client says **nothing at all**. A recovery that works
is indistinguishable from a set that has frozen, from ten feet, with no remote
in hand. §0's Diagnostics copy makes the same point about a console; this is the
same hole for somebody who is only watching.

So this must render **outside** that gate. That is the substance of the change;
the logo is the presentation.

#### What can drive it, without inventing anything

On the coordinator snapshot the client already holds:

- `starting` and `preparingSource` — the client is acquiring a source.
- `notice` — **undocumented in core.** `fatalError` above it carries a long
  docblock and `notice?: string` has none (read in
  `macha-ts/src/playback/PlaybackCoordinator.ts`). Ask core what it guarantees
  before resting a viewer-facing signal on it.
- `fatalError` — **explicitly not this.** That is terminal and gets the failure
  screen; "working on it" would be a lie.

Not on the snapshot, and worth checking: the readiness walk's segment hold
(`src/player/readiness.ts`) waits out a `500 segment_not_ready` on the same node
before the source ever reaches `expo-video`. That is a wait, it is recoverable,
and it is invisible — it may need to raise something for this to see.

`src/screens/player/failureTrail.ts` is the precedent for turning coordinator
state into something on screen.

#### It is not the spinner, and the discriminator is kind rather than duration

**Tom, 2026-09-23: the spinner is simply a streaming/seeking indicator. The logo
appears when the system is recovering in a way that a normal media system could
not.** That settles the wallpaper question, and it settles it better than the
delay heuristic drafted above: the test is not *how long is the viewer waiting*
but *is Macha doing something no other player could*.

So, two signals with two meanings:

| | means | examples |
| --- | --- | --- |
| **Spinner** | the stream is catching up | start, seek, rebuffer |
| **Logo** | a recovery is under way that would have ended playback anywhere else | failover to another node, regenerate of a reaped session, standby promotion, the park, waiting out a `500 segment_not_ready` hold |

Two earlier entries here are **withdrawn** by that, and are named rather than
quietly deleted because both are in the git history:

- *Ordinary rebuffering* — not this. That is the spinner's job, and no delay
  heuristic is needed to keep the logo off it.
- *Viewer-initiated changes* — not this either. Changing mode or quality makes
  the viewer wait, but it is not a **recovery**; nothing went wrong. The
  previous entry had it the other way round on a reading of "anything which
  might unavoidably make the viewer wait" that was too literal.

**The web client reached the same conclusion already**, for the spinner rather
than the logo, and the sentence is worth carrying:
*"A rebuffer mid-film has the picture behind it to say what is going on, and a
timer over that would turn every brief hesitation into an announcement"*
(`macha-client/src/screens/PlayerScreen.tsx`). Its wider argument is this one's
foundation — *"an unmarked spinner says only that something is happening"*, and
Law 2, that a degraded state must be visible rather than becoming indefinite
waiting. The logo is what makes a recovery *marked*.

#### **This client has no spinner at all** — the pair is half missing

Checked, and it is the thing most likely to derail this item. `ExpoVideoAdapter`
produces the flag correctly — `buffering: this.video.status === 'loading'`
(line 332), which is from the player's own state as core's contract demands,
not derived from an empty buffer. **Nothing renders it.** There is no spinner,
no buffering indicator, nothing in `PlayerScreen` between a black frame and a
picture.

The web client has one: `showBuffering = !fatalError && (playback.starting ||
Boolean(event.buffering))`, shown immediately on `starting` and after
`playerSeekSpinnerDelayMs` otherwise.

So a distinction defined against the spinner cannot be built here until the
spinner exists, or **the logo will silently become the indicator for everything**
— which is exactly what Tom's instruction rules out. The spinner is an ordinary
port from the web client (the usual direction, §4.2) and should land first or
alongside. Whether the delay figure travels is a `timingBudgets.ts` question,
not a copy.

#### A switch to turn it off — **Tom, 2026-09-23**

In Settings, beside Diagnostics. The precedent is
`src/diagnostics/failureTrailSetting.ts`: a key, absent-means-default, read at
the moment it is consulted rather than subscribed to, and the rule and storage
key shared with the web client *"so a person who has debugged one client already
knows where this lives"* — which matters more than usual here, because the other
two clients are porting this (below).

**One deliberate difference from that precedent: this defaults to *on*.**
Diagnostics is off by default because *"diagnostics that are on by default stop
being diagnostics and start being the product"*. The logo **is** the product —
it is the one moment the client tells a viewer what makes it different from
every other player. So the switch exists for the person who finds it
distracting, not as an opt-in; absent means on.

Still open: what it is called in the settings list, and whether turning it off
also silences the notice text behind it or only the logo. My reading is only the
logo — the text lives in the chrome, which a viewer has to summon deliberately,
and silencing what somebody asked to see is a different decision.

#### Practicalities#### Practicalities

The asset is `assets/icon.png`, already loaded for `App.tsx`'s watermark, so
this is a second and smaller transient use of it, at `theme.ts` sizes.

**It can be verified from a screenshot and its timing cannot.** The player
screencaps black — video is a hardware layer and only the chrome composites
(§0's device notes) — so a capture will show the logo, but whether it is subtle
enough and whether it appears at the right moment wants somebody in front of the
set.

#### This one originates here, and the other clients port it

**Tom, 2026-09-23: the web client and the phone client will both get a port of
this, once it is proved to work here.** So `macha-client` is not the reference
for it — for once, this client is. That is the reverse of the usual direction
(§0: match the web client's viewer experience) and it changes what "done" means
twice over.

**It has to be built to be ported, not ported afterwards.** By Tom's standing
rule the dependency-free part belongs in core and every client refactors onto
it, and almost all of this *is* dependency-free: what counts as a recoverable
wait, when it begins and ends, and how long to wait before showing anything so a
50 ms hiccup does not announce itself. None of that needs a screen. What stays
platform is the drawing — an RN view here, DOM there — and where it sits
relative to whatever that client uses for chrome. Same split as
`progressPersistence.ts` and its hook (`COMPLETED.md`, 2026-09-21..23), and it should be proposed to
core in the same way rather than written three times.

**Prove it here first.** Tom's sequencing, and it is the right way round: this
is the client with the failover, the set that goes through nodes, and the only
one where a viewer sits ten feet away with no console. Proving it means on the
television, through a real recovery — which is the same sitting §P-1 is waiting
for, so the two want scheduling together rather than separately.

A caution for whoever does the ports: the *trigger* travels and the *threshold*
may not. A browser tab recovering in 200 ms and a television waiting out a 19 s
bounded regenerate are not the same experience, and a delay tuned here should be
re-justified there rather than copied — the same argument as the timing budgets
in `timingBudgets.ts` being stated against what they are calibrated for.

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

### 3.3 `/manage` and `/items/:id/edit` — **decided, 2026-09-19**

Not TV work. Tom's ruling on the nav bar: match the web client's *including*
Status, and **not Import or Manage regardless of user role**. The metadata
editor goes with Manage. `/ingest` and `/sponsor` were already ruled out
(2026-09-10). The `ManageNav`/`ManageIcons` rows in §4.3 close with it.

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

**Partly answered, 2026-09-20.** Tom ruled on Back *inside the player*: if the
controls are up it puts them away, and the next press leaves the film — and
leaving arrives at **the media detail screen**, which now holds for every path
into the player rather than only the one that went through a detail screen
(`App.tsx`'s `play`). The top-level question below is still open.


It does today. That is conventional Android TV behaviour, so it may be
correct — but combined with §1.0's requirement that Settings stay reachable
from behind the login wall, it is worth stating deliberately rather than
inheriting.

---

### 3.6 The client ships with no endpoints — **decided by Tom, 2026-09-20**

**His ruling, in his terms:** from a systems point of view the app should not
ship with *any* endpoints. Like the web client, it asks the viewer to supply
them, persists them, and offers a **real interface to change or clear** them,
and it discovers endpoints the way the web client does. **Core is responsible
for some or all of this except the interface** — his warning, and it is the
line to get right. For development, *this* television defaults to
`10.35.1.50`.

**What core already owns**, read from `runtime/configuration.ts` rather than
assumed:

- `bootstrapEndpoints()` reads the stored list, migrates two superseded
  layouts, and **falls back to `environmentEndpoints` when nothing is stored**
  — which is the build's own list, ours from `app.json` via `state/client.ts`.
- `setBootstrapEndpoints([])` *removes* the stored record rather than storing
  an empty one, deliberately, so clearing falls back to the environment again.
- `serverUrl()` answers `''` when there is nothing.
- `discoveredEndpoints()` is a resumable-history hint only, written **solely by
  `EndpointHealthMonitor`**, and core is explicit that a discovered candidate
  must never be persisted as user configuration.

**So the shipped list is the whole hinge.** While `app.json` carries an
endpoint, "clear" cannot mean what Tom means by it: core hands the build's
default straight back, and a viewer who cleared a wrong server gets it
returned. Ship `[]` and clearing genuinely returns the client to cold.

**What this client is missing, and it is one state, not a screen.** `access.ts`
has `checking | allowed | sign-in | offline`, and a client with no endpoints
lands in **`offline`** — "nothing answered". On a first run that is a lie:
nothing was *asked*. The work is an `unconfigured` state and the screen that
belongs to it, with `OfflineScreen` keeping its own meaning.

**The development default is a pre-fill, not a default.** Release builds go on
this television, so `__DEV__` cannot carry it. The shape that keeps Tom's rule
intact: `app.json` ships `machaEndpoints: []`, and a *separate* key holds a
**suggestion** the connection screen types into the field for the viewer to
accept or overwrite. The app then never holds an endpoint nobody chose, and
nobody spells out an address on a D-pad keyboard either.

**Open until the web session answers** (asked 2026-09-20, per Tom's standing
rule that behaviour questions go to them first and escalate to him only where
a browser answer makes no sense on a television): what a cold start actually
shows and what counts as "supplied enough" to leave it; what happens when
stored endpoints *all* fail later, which is the case that matters most here
because there is no address bar behind it; what triggers discovery and what
happens when a discovered endpoint is the only reachable one; and what
clearing means to them. **Nothing should be built here until that lands** —
this is a behaviour port, and the last three behaviour guesses in this file
were all wrong.

## 4. Parity with `macha-client` — the complete list

**One item now runs the other way.** §2.11 ("Macha is working on it") originates
here and the web and phone clients port it once it is proved on the set — Tom,
2026-09-23. Everything below is still this client catching up; that one is not.



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

### 4.1 Screens — 11 of 28 routes, plus 2 partial

| Web route | Here | What core already gives us |
| --- | --- | --- |
| `/` Home + Continue Watching | **yes** | `ContinueWatchingStore`, `recentMedia` |
| `/movies`, `/series` libraries | **yes** | `MediaApi`, `titleIndex` |
| `/movies/:id`, `/episodes/:id`, `/items/:id` detail | **yes** | `MediaApi`, `MediaTechnicalProfile` |
| `/series/:id`, `/series/:id/seasons/:id` | **yes** (season folded in) | `MediaApi` |
| `/play/:id` player | **yes** | `PlaybackCoordinator`, `PlaybackRuntime` |
| `/settings` | **yes** (2026-09-19) — the web layout, edits endpoints; adopted on restart | `ServerApi`, `CatalogueApi` |
| `/login` | **yes** (2026-09-13) | `sessionManager.signIn`, `sessionLockedOut`, `lastMintFailure` |
| *(offline gate)* | **yes** — no web equivalent | `lastMintFailure.reason` |
| `/search` | **yes** (2026-09-19) — platform IME, the web client's query rules | `MediaApi.search()` |
| `/music/*` (7 routes) | **partial** — albums grid only (§4.6) | `MediaApi`, `PlaylistStore` |
| `/status`, `/status/client`, `/status/connectivity`, `/status/nodes/:id` | **partial** — one reading, no actions, no polling | `ClusterStatusApi` |
| `/connection` endpoint gate | **no** | `shouldEnterConnectionGate`, `normalizeConnectionEndpoints` |
| `/manage`, `/manage/files` | **not doing** — Tom, 2026-09-19 (§3.3) | — |
| `/items/:id/edit` metadata editor | **not doing** — Tom, 2026-09-19 (§3.3) | — |
| `/ingest`, `/sponsor` | **not doing** — Tom, 2026-09-10 | — |

**Search is built** on the design Tom settled on 2026-09-10 — the set's own
keyboard through `TvTextInput` — and keeps the web client's query rules exactly
(two characters, 180 ms settle) so the two answer alike.

**Music is seven routes** and one of them exists (§4.6). It remains the
largest single block.

### 4.2 Player chrome — 7 of 12 controls

**Add one that was not on this list: there is no buffering indicator.** The
adapter produces `buffering` correctly and nothing renders it, so between a
black frame and a picture this client shows a viewer nothing at all. The web
client has one, shown immediately on `starting` and after a delay otherwise.
It is an ordinary port in the usual direction, and **§2.11 depends on it** —
a logo defined as "not the spinner" cannot be built against a spinner that does
not exist.

Built: restart, rewind, play/pause, forward, options, close, plus the scrubber
with a buffered range, the accelerating seek, and a cold Left/Right that raises
the bar and seeks in one press. The stream lines come from core's
`describePlaybackSession`, as the web client's do.

Missing:

- ~~Options~~ — **done 2026-09-13**, §2.3.
- **Previous / next** — needs `PlaybackQueueStore` (§2.5).
- ~~Volume and mute~~ — built 2026-09-13 and **removed 2026-09-19** (Tom). A
  television's remote has volume keys that drive the set's own output stage,
  and an app-level level underneath them is a second, invisible multiplier; two
  volumes that disagree is worse than one. `VolumeStore` and
  `usePlayerVolume` stay wired, because core's `setVolume` still applies a
  remembered level and a promoted standby still comes up at it — what went is
  the control, not the state.
- **Mini player** and its minimise/expand pair.
- ~~**Failure trail**~~ — **built 2026-09-13, reachable since 2026-09-19.**
  `screens/player/failureTrail.ts` prints the last dozen warnings and errors
  under the failure message. Off by default; the switch is under Diagnostics on
  Settings. The buffer it reads had to be wired too
  (`diagnostics/playbackLog.ts`, at `warn`), since this client had never
  called core's `createClientLogger` at all. Note `console` is `__DEV__`-only,
  so in a release build the trail is the *only* way to read that buffer:
  `verify-on-device.sh logs` greps `ReactNativeJS` and will show nothing.
- ~~**Seek acceleration**~~ — **ported 2026-09-19**, ladder and thresholds
  unchanged from the web client, pinned by its tests. Duplicated rather than
  shared; the file says why and it is Tom's to settle.

Fullscreen is **not applicable** — a TV app is always fullscreen.

### 4.3 Components — 10 of 21 ported

Ported: `MediaCard`, `MediaRow`, `Status`, `PlayerIcons`, `LazyArtwork`,
`AlphabetIndex`, `ConnectionForm`-adjacent `TvTextInput`, plus TV-only
`Focusable`, `TopBar` and `EpisodeCard`.

**`TvTextInput` is the one to reuse**, and Search and Settings both do. It
raises the platform IME and suspends the focus registry while it is open. Add
`NavIcons` (user, cog, magnifier — the web client's geometry) to the ported
list.

Missing, in the order they matter on a D-pad:

- **`OverflowMenu`** and **`Modal`** — every "add to playlist / play next / play
  later" affordance hangs off these, so **music depends on them**.
- **`CardCloseButton`** — there is no way to dismiss a finished film from
  Continue Watching.
- **`MediaPageTitle`** refresh affordance, **`EpisodeRail`**, **`SectionNav`**,
  **`MusicNav`**, **`StatusNav`**, **`ConnectionForm`**, **`DeviceCapabilities`**,
  **`AsyncIconButton`**, **`AppLogo`**. `EditButton`, `ManageNav` and
  `ManageIcons` are closed with §3.3.

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
web client's status pages poll; this client's Status is a one-shot reading
with a refresh, which is honest but stale the moment a node changes).

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

### 4.6 Music — seven routes, none of them started

**Tom asked why there is no Music on Home** (2026-09-19), and the first answer
written here was wrong. It said the row was empty because `home.albums` came
back empty, inferred from a `uiautomator dump` that showed only two rows — but
that dump **prunes what is off screen**, and the rows were below the fold
because the page could not scroll (§1.1's fault, in its Home form). With the
scroll fixed, Home shows Movies, TV Shows *and* Music, albums and all:
`docs/evidence/2026-09-19-home-scroll-fixed.png`.

Kept because it is the same mistake this repo keeps writing down: a tool's
silence read as evidence of absence. The dump could not have told me either
way, and one press of Down could.

**The Home row works. What is absent is everything else**, and it is the
largest single block left in this file: **seven of the web client's
twenty-eight routes.** A viewer can see that albums exist and cannot open one.

**What core already ships**, so none of this is a data problem (§4's rule 1):
`MediaApi.artists()`, `.albums()`, `.tracks()`, core's `PlaylistStore` — which
supersedes the `MusicPlaylistStore` this client never constructed and which core
says to delete rather than extend (§4.5) — and `state/musicPlaylist`.

**What is missing is presentation, and three pieces of it block the rest:**

- **`OverflowMenu` and `Modal`** (§4.3). Every "add to playlist / play next /
  play later" affordance hangs off them, and on a D-pad a menu is a focus scope
  with its own trap — the same problem `PlayerOptions` solved, and the place to
  copy from.
- **A queue that survives the screen.** `PlaybackQueueStore` is constructed and
  read by nothing (§2.5). Music is the case that makes it unavoidable: an album
  is a queue, and next/previous in the transport (§4.2) needs the same wiring.
- **A player that is not the film player.** A track has no picture, so the
  full-screen `PlayerScreen` is the wrong surface: the web client keeps music
  playing while the viewer browses, which means a mini player (§4.2) and a
  runtime that outlives the route — this client's `PlaybackRuntime` already is
  app-scoped, so the gap is presentation again.

**Route by route**, against `../macha-client` — read, not recalled:
`/music` (landing), `/music/artists`, `/music/artists/:id`, `/music/albums`,
`/music/albums/:id`, `/music/tracks`, `/music/playlists`.

**Not started, and not to be started piecemeal.** The three blockers above are
shared with Search (§4.1) and with the transport work, so doing them first buys
more than one screen. A television is also the place to ask whether the whole
of it is wanted: the web client's music routes assume a pointer and a keyboard
for playlist editing, and §3.3 already rules that a 10-foot UI is a poor place
to retag a film. **Tom's call, and worth making before the first screen rather
than after four.**

