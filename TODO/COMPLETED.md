# Completed

## 2026-10-04 to 2026-10-05 — the return from standby, two ported sentences

- **Waking from standby into the player** (`7a35e7d`): the set's standby
  sends the app to the background, which closes the session to free the
  node's transcode slot; nothing restarted it, so the set woke into an empty
  player with no "..." (it needs a session). The return now restarts the
  title from its resume point, paused, chrome up on Play (Tom's ruling).
  **Measured by Tom on the set, 2026-10-05**, on APK md5 `7ef6221c…`, core
  `cb55882`. The paused start is a local stand-in (`pauseOnFirstSnapshot`)
  until core's `play` takes one; asked of core.
- **Ported from the web client** (`e431885`): "Converting streams…" for the
  decode fallback (web `bc03abd`), and "This item cannot be played here." for
  `NOT_PLAYABLE_CODE`. Unseen on the set.
- **Pushed** to `97c90a4` on Tom's word; Tom's answers to the open decisions
  recorded (`97c90a4`).

## 2026-10-01 to 2026-10-04 — wording ports, comments and docs rationalised, 0.9.1 on the experiment branch, and availability

**Asserted from source and tests unless it says measured.** Nothing in this
section has been driven on the set (Tom's "Don't test" stands); one install
was made, on Tom's word.

### In one line each

- **Branch:** from 2026-10-01 all work is on `experiment/object-ledger`
  (`9e092ce` records why). Pushed for the first time with the 0.9.1 tag.
- **Error sentences ported from the web client, word for word:** a routed call
  that tried every node and found none answering says "No Macha server
  answered. Try again in a moment; if it keeps happening, check that the
  servers are running." (`e7b0145`, web `043fd81`); a refused walk gives the
  server's own sentence, ours only when it gave none, and a plain connection
  failure says the web's `SERVER_UNREACHABLE_TEXT` (`59b2235`). None of the
  display sites limits lines, so the longer sentence wraps (read from the
  components, not seen).
- **Dead code** (`a114fd3`): unused imports, three screens' unread grid column
  counts, `SearchIcon`, `getServerUrl`, `PlaybackFactsLookup`,
  `setVolumeLevel`; the two repeated error sentences became constants.
- **Comment pass** (`dd0f30c`, Tom's ask): every comment earns its place, and
  no comment or test name carries history (dates, hashes, attributions,
  incident stories, TODO section numbers, "used to"). 102 files, 1,060 lines
  in and 1,728 out; four comments that were wrong about the code corrected.
  Verified by comparing every file's comment-free syntax tree (TypeScript's
  printer with `removeComments`, a stripping lexer for Kotlin and Gradle)
  against the previous commit: the only differences were the renamed test
  names. The checker was itself proven on a deliberate type change and on
  `a114fd3` first.
- **0.9.1** (`60d4a3a`, annotated tag, pushed), on Tom's word, on this branch
  and **not on `main`**: Tom chose that over a release to `main` when asked.
  `android/` was regenerated with `expo prebuild` so `version:check` passed.
- **Availability** (`ad1d60f`, `5c2d2cb`, `8e044b8`; core `495353a`,
  `1251cb2`; Tom's ruling relayed by core): markers on every title, outlines,
  yellow triangle / red crossed circle / yellow question mark; an unavailable
  title greyed, out of focus and refused by `play()`, the detail page's Play,
  the player's previous/next and the end-of-episode advance; first focus and
  the alphabet strip skip it. Continue Watching takes its markers from core's
  `currentAvailability`, because core's stores no longer keep availability
  (this client's ask). The play rule is core's `availableToPlay`, which
  replaced a local `isPlayable` that shadowed core's queue-kind `isPlayable`.
  Then, on Tom's word, an unavailable Continue Watching card takes focus so its
  × can be reached, OK still doing nothing (`cardInteraction`). Each rule's
  test was seen red under a deliberate mutation.
- **Installed on `.133`** 2026-10-04 00:03: `5c2d2cb`, md5
  `ecc962a139ff34102e7451a1e1b7d72c`, read back off the set (`7e6187a`).
  Macha was playing, about 17 minutes in; Tom said install now.
- **Server and core notices checked, nothing broke:** core `f794364`
  (endpoint ranking, `lapsed`, `MachaRequestTimeoutError`), server
  `subsystems[].state` `starting`, 0.82.0 files resource, 0.83.0 item
  availability, 0.84.0 availability from the last survey. Core takes only
  named fields from each response, so extra fields pass unread.

- **§1.9 closed by core** (`83c53e9`): a walk now charges a node only for a
  failure that is the node's (`request()`, `find()` and `mutation()` ask
  `failureBlamesEndpoint`, as `pinned()` did). `catalogue_unavailable` carries
  no scope, so core walks on past it and charges no node. Checked here against
  that core's built `dist`: typecheck, 391 tests and the export pass. Home
  saying every endpoint failed now means every node refused, not cooldowns.
- **Documentation and comments rationalised for brevity** (Tom's ask,
  `63534b4`, `08c863e`, `cd8008d`): README an install and build guide that
  matches the code (it had said search and status did not exist, named the
  wrong player, and said core never comes from a sibling checkout); AGENTS,
  ROADMAP and HISTORY cut to current rules, open items and decisions; ACTIVE
  from 2,642 lines to about 450, the rest moved here verbatim; code comments
  from 5,664 lines to about 2,400, checked comment-only by the syntax-tree
  comparison. Three reviewers then read the comment diff and nine lost
  hazards were restored, the worst a `PlayerEngine.kt` comment left on the
  wrong function claiming a mapping core already has.
- **Ported "This stream is no longer available. Start it again."** for core's
  `session_provenance_unknown` and `regeneration_endpoint_gone`, which fell to
  "Something went wrong." (`512f27d`, red first).
- **Read from the peers, settled:** the server's entitlement release is
  deployed (in 0.48.1); core's standby window reads the node's
  `pipeline_idle_ms`; the GitHub repository is public; the modal backdrop
  takes the web's `#000b`.

### Mistakes

- **My own test-name rename broke `viewerText.test.ts`**: apostrophes inside
  single-quoted names. Typecheck caught it (the test count fell from 383 to
  339, which is what gave it away); fixed before the commit.
- **One comment-pass agent trimmed a reason away** ("The web client's case."
  lost why the case exists). Restored; others like it may remain. Read
  `dd0f30c`'s diff with that in mind.
- **A wrong commit hash sent to core, twice** (`7b51a3c` for `8e044b8`, then
  `0f61e27` for `d6522f2`), each corrected the same minute. The second came
  from sending a message in the same batch as the commit it named. Commit,
  read the SHA with `git log -1 --format=%h`, then send.
- **A misread of core sent to core:** ACTIVE said `route()` asked
  `failureBlamesEndpoint`; the call at that line was in `pinned()`. Core
  caught it. Name the function, not only the line, when reading another tree.
- **The brevity pass wasn't purely comments:** `08c863e` also deleted three
  unused player styles. Its message calls that change separate; it is in the
  same commit.
- **zsh again:** an unquoted `$F` holding several file names is one word in
  zsh, and `--include=*.tsx` is a glob that aborts the command. Both produced
  silent wrong answers in the dead-code scan before being noticed. Quote the
  pattern (`--include='*.tsx'`) and do not rely on word-splitting.

## Moved from ACTIVE at the 2026-10-04 rationalisation — the records behind the open items

#### Traps this session paid for — driving the set over adb

- **The player chrome hides after 4 s and the next key only reveals it**,
  and a reveal puts focus back on Pause. Reading a screenshot takes longer
  than 4 s, so every player sequence goes in **one** `adb shell` call:
  `DPAD_LEFT` x5 (lands on the leftmost button whatever the state), then
  `DPAD_RIGHT` x4 for "...", x5 for Stop, then `DPAD_CENTER`. Measured
  2026-09-28: four separate attempts each pressed fast-forward or Pause.
- **From a Continue Watching card, Up goes to the card's remove (X) button
  first** and only a second Up reaches the top bar. So Up, Right, OK from a
  card on Home plays a Movies-row title: it started *The Sixth Sense* on
  2026-09-28. Screenshot after every Up on Home.
- **`dumpsys media_session` `state=` can be stale**; compare `updated` with
  `/proc/uptime`.
- **`adb shell input text` drops characters** on this set's keyboard; type one
  character per call.
- **Hermes keeps property names, not local variable names**: to prove a bundle
  carries a change, grep for a new property or string, never a local.
- **Hermes stores a string with any non-ASCII character as UTF-16**, so a
  plain grep misses it: "Waiting for the node to start the stream — Ns"
  (an em dash) read as absent on 2026-09-25 and was there. Search for
  `text.encode('utf-16-le')` in the extracted bundle instead.
- **This shell's `grep` skips files it thinks are binary** (logcat captures
  included) — use `grep -a`. **zsh reads `===` and `$VAR:s…`** as syntax;
  avoid both in commands.
- **Back from Home leaves the app** (every other screen now goes Home,
  2026-09-28). A driver that loses count still drops out to the launcher.
- **Home's first focus after a cold start is not fixed.** On 2026-09-29, after
  `am force-stop` and a relaunch, the usual three Ups and a Right did not reach
  Movies and the OK opened a Continue Watching item's season. Screenshot
  before the OK.
- **Capture a burst on the set, not across adb calls:** `screencap -p
  /sdcard/mb/fNN.png` inside one `adb shell` loop, then `adb pull
  /sdcard/mb/.`. **Never `adb pull /sdcard/`**: it copies the whole card.
- **In this shell:** `export ANDROID_SERIAL=10.35.1.133:5555` rather than a
  `S="adb -s …"` variable (zsh does not word-split it); waits go in `adb shell
  sleep N`, since a foreground `sleep` is refused here.

#### Getting a build onto the set

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

#### Reaching the devices

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

#### Two standing rules

- **Take every piece of logic from `@machafoundation/core` — and no words.**
  Anything that is not presentation belongs in core and is consumed rather
  than rewritten; **viewer text is presentation** (Tom, 2026-09-24) and lives
  in `src/text/viewerText.ts`. `develop` links `../macha-ts`; `main` installs
  from the registry (AGENTS.md has the check).
- **Claims about other codebases get read, not remembered.** Every cross-repo
  assertion here has been wrong at least once — including two of this
  session's, listed in `COMPLETED.md`. Open the peer before writing "only",
  "never" or "nowhere else".

### P-1. The regenerate path froze the viewer once — bound landed, freeze not reproduced, **not closed**

**Status, 2026-09-24:** four reaps since 2026-09-23, none froze. A transcode
reap now recovers **on the same node** (core's liveness-before-charge,
`2bcce57`); direct-play reaps either failed over remotely (before that fix) or
never reached the player (a deleted session's open body keeps streaming — the
server session confirmed that from `playback.cpp`). All four are written up in
`COMPLETED.md`'s top section. **Open:** detection waits for the buffer to drain
(66 s) because `expo-video` reports no per-segment failure — see §0's item 4.
The history below predates all of that.

#### Why it is P-1 and not P0

Before the walk fix the same reap was misclassified as `unknown`, took the
**failover** path, and recovered in 7.2 s — cross-site and expensive, but
invisible. The fix routes the same event down the **regenerate** path, which
had never been exercised on any platform, and that path hung. So the correct
change made the viewer's outcome strictly worse, and every reap on every
client with the fix does this until it is closed. It is the one thing in this
file that can put a frozen frame in front of a viewer *tonight*.

#### The mechanism, as far as it is read

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

#### What has landed, and what has not

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

#### The build waiting for the set, 2026-09-21

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

#### The sitting, 2026-09-21 — the build landed, twelve titles played, all three modes

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

#### The evening, 2026-09-21 — a remux P0 answered, and a second cause of the same 503

**Two findings, and the second was an accident of the first.** Both measured on
`10.35.1.133` against `http://10.35.1.50:7438`, client `0.5.0` / `versionCode
500`, Diagnostics on so the trail rendered while the film ran.

##### The A/B: remux is not broken, copying AC-3 into fMP4 stalls

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

##### A stale session makes the *next* play of the same title fail on that node

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

##### Core `61e4d74` — the reclaim finally has something to call

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

##### What the orphan record has and has not been shown to do

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

#### The re-run, 2026-09-20 23:54 — recovered, and the bound was not exercised

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

#### Sequencing, ruled by Tom 2026-09-21

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

#### The plan, revised

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

### 1. On the television

**The set is no longer the blocker.** It runs, navigates, signs in and plays.
What is left here is measurement, and the failover exercise that §0 now puts
first.
The records of what was settled on 2026-09-13 — the sign-in P0, the D-pad
verification and the 5.1 measurement — are in
[`COMPLETED.md`](COMPLETED.md).

#### 1.12 Found while switching `.133` between accounts, 2026-09-23 — **three remain, one fixed here and unmeasured**

All measured on the set, all by D-pad over `adb`. The three fixed on
2026-09-25 (Settings' 401, the sign-out dialog, the sign-in wall) are in
`COMPLETED.md`'s top section and wait on the set to be seen.

- **Continue Watching is not per-account.** Signed in as `tvtest`, the rail
  showed `tom`'s three entries unchanged. Core's `signOut` clears only
  `SESSION_CACHE_KEY` (`macha-ts/src/api/SessionManager.ts`, read at
  `a3b40ca`), so the progress store outlives the account. On a shared
  television one viewer sees another's viewing. Bears on
  the storage-keys standardisation, and the fix may be core's.
- **And resuming one of those entries starts from zero.** Selecting `tom`'s
  Half-Blood Prince under `tvtest` logged `requestedPositionMs: 0`,
  `seekMs: 0` — the rail offers a resume it then does not perform. **Not an
  account question, most likely: Tom reported it 2026-09-25 as "sometimes"
  on his own account, and the cause is reproduced (not measured on the set).**
  `expo-video`'s time clock ticks position 0 every 250 ms from an idle
  player, and core's coordinator lets a player event overwrite
  `intent.positionMs` until `present()` arms its latch. A tick during the
  facts fetch and resolve zeroes the resume point: direct play then starts
  at 0, and a transcode is PATCHed back to seek 0. Reproduced against core
  `3a5dc56` and `edfce82` dist with a fake player
  (`scratchpad/resume-repro.mjs` in the 2026-09-25 session). The TV half is
  fixed (`ExpoVideoAdapter.emit` reports nothing without a source, `a1e01c0`);
  the coordinator half is fixed in core `d93c9d8` (it ignores the player
  until a source is presented), and the repro keeps 30:00 in all four cases
  against that dist. **To confirm on the set:** resume a
  Continue Watching entry several times, both a direct-play and a
  transcoded title, and read `initial-generation-ready` and
  `source-presented` in the trail.
- **The on-screen trail did not repaint in captures while the chrome was
  hidden, during reap 2.** Forty-one captures across the recovery all showed
  reap 1's lines; revealing the chrome showed reap 2's, timestamped at the
  recovery. Reap 1's lines *did* appear with the chrome hidden. Observed
  twice-inconsistent and not explained — so do not trust a capture of the
  trail without the chrome up.

#### 1.1 Navigation faults found on hardware

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
- ~~**Back from a top-level screen exits the app**~~ — **decided and built
  2026-09-28**: only Home exits; see `COMPLETED.md`. The record as it was:
  Back from a top-level screen exited the app rather than returning to the
  previous route. Conventional on Android TV, so possibly correct — but it
  means a stray Back drops out to the launcher, and `com.tcl.tv` is
  `FLAG_SECURE`, so screenshots silently return empty when it does. Worth a
  decision rather than a fix. **2026-09-21 it cost a sitting**: a driver that
  sent one Back too many left the app, kept pressing into the TV launcher, and
  opened a Google Play Services sign-in screen, typing into its email field
  before anyone noticed. Nothing was submitted. Anything driving this set over
  `adb` should assert the foreground package before every key.

#### 1.2 Close out the 5.1 measurement

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

#### 1.3 Decoder instance limits — **measured 2026-09-20, and the shell check cannot settle it**

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

#### 1.3a The original question, for reference

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

#### 1.4 Wire-verify "no custom headers"

`verify-on-device.sh headers`. Source-verified only so far: one
`setDefaultRequestProperties` call forwarding `PlaybackSource.headers` verbatim,
no `X-`/`Macha-` literals, nothing branching on a response header. Media3 sets
its own `User-Agent` and range headers, which are real traffic and neither
custom nor ours. Capture a real fragment request and tell the NPM session, who
tracks this across all four clients.

#### 1.0 THE REAPED SESSION, RUN — and the recovery takes the expensive path

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

#### 1.0c The trail is readable without a failure — **built 2026-09-20, unrun**

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

#### 1.0d Two things core wants from this hardware

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

#### 1.0e The web client's handover fault does not have a shape here — checked, not measured

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

#### 1.0f The reap, run twice — what is settled and what replaced it

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

#### 1.0g What media3 does with a status, read from the shipped artifact

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

#### 1.0h What `expo-video` throws away, and it is a wrapper gap

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

#### 1.4a The node's "unused session" reaper does not fire for direct play

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

#### 1.4b No way to find a playback session id from outside the client — **until the route change (§2.10) ships**

`GET /api/v1/playback/sessions` answers `404 not_found` — there is no list
route — and `GET /api/v1/playback/status` gives a session *count* and no ids.
The id is in the stream URL, which this client logs to the failure trail
(`source-budgets`) and therefore shows only when playback has already failed.

So reproducing the reaped-session case on this client currently needs either a
way to list sessions server-side, or a diagnostic that shows the current
session id on screen. The second is a small change here and would make the test
repeatable; it is not worth doing until the first is ruled out.

#### 1.5 Confirm audio focus on hardware

We are on `expo-video`, so the thing to measure is its known-worse behaviour:
`AudioFocusManager.kt:205` halves `player.volume` on a transient duck and
restores from its own `userVolume`. The question is whether repeated ducks
compound on this set, and whether a restore is ever missed — which would leave
a viewer at half volume with no way to tell why.

Now cheap to test: a film plays, and volume and mute are in the transport
overlay.

#### 1.6 Read the platform-surface findings

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

#### 1.7 What a dead `expo-video` player still reports

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

#### 1.9 A catalogue `503` is reported to the viewer as every endpoint failing — 2026-09-22, cause traced 2026-09-23, **not fixed**

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

#### 1.8 Quiet, and slightly out of sync — measured 2026-09-22, and the cause is that we hand the set six channels

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

##### The fix, and why it is ours

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

### 2. Player work

#### 2.0 The player is `expo-video` for now

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

#### 2.1 Seamless failover — Tier 3 remains

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

#### 2.2 Does a promoted standby actually play?

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

#### 2.2b Two core hazards that land hardest on a D-pad — **fixed in core, unproven here**

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

#### 2.3 Player options — done, and now exercised

Mode, quality, audio track, subtitle track and source switching, as a block
inside the chrome above the scrubber — the web client's shape since
2026-09-19, not a side pane — with its own focus scope. Back closes it, and so
does Down from the last row.

The panel was not opened during the 2026-09-13 playback session, so its
contents are still unseen on hardware — but the transport overlay's stream
lines were, and they are what answered §1.2. Forcing a mode by hand is still
how a downmix would be isolated if the direct path ever stops being chosen.

#### 2.4 Optional `Player` methods

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

#### 2.5 Stores constructed but unused

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

#### 2.6 Core `0.14.0` — the player contract is ported; the session work is not

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

#### 2.7 Finishing the `0.14.0` port

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

#### 2.8 The `404` never reaches the mapping — **diagnosed 2026-09-20, and the fix is core's**

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

#### 2.9 What the peers measured for this client, 2026-09-20

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

#### 2.10 The playback route is moving, and it does not reach this client's code — 2026-09-21

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

#### 2.11 "Macha is working on it" — **Tom, 2026-09-23. Not started**

**The trigger, in Tom's words: any recoverable *error* — anything which might
unavoidably make the viewer wait.** The visual is the splash screen's Macha
logo, small and subtle, **top right, over the video**. What it says to the
person on the sofa is *Macha is working on it*.

**This is not a stream-switch indicator**, which is how it was first written up
here and was too narrow. It is a **recoverable-wait** indicator. The distinction
that matters is not what the client is doing — failing over, regenerating,
holding for a fragment — but what the viewer is experiencing: the picture is not
moving, and that is not a fault.

##### The gap it fills, which is worse than it looks

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

##### What can drive it, without inventing anything

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

##### It is not the spinner, and the discriminator is kind rather than duration

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
the principle *Work is bounded and event-driven*
(`docs/principles-and-laws.md`), that a degraded state must be visible rather
than becoming indefinite waiting. The logo is what makes a recovery *marked*.

##### ~~**This client has no spinner at all**~~ — **the spinner landed 2026-09-25/27**

`BufferingOverlay` and `bufferingIndicator.ts`, the web client's rules, with the
start-progress stage under it since 2026-09-28. The precondition below is met;
the logo itself is still not started. The record as it was:

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

##### A switch to turn it off — **Tom, 2026-09-23**

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

##### Practicalities#### Practicalities

The asset is `assets/icon.png`, already loaded for `App.tsx`'s watermark, so
this is a second and smaller transient use of it, at `theme.ts` sizes.

**It can be verified from a screenshot and its timing cannot.** The player
screencaps black — video is a hardware layer and only the chrome composites
(§0's device notes) — so a capture will show the logo, but whether it is subtle
enough and whether it appears at the right moment wants somebody in front of the
set.

##### This one originates here, and the other clients port it

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

### 3. Decisions for Tom

#### 3.1 `addDirectSourceAlternative` — local proxy, or wait for the engine?

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

#### 3.2 Is the GitHub repository public?

Pushed to `git@github.com:tomdionysus/macha-client-rn-android-tv.git`, and
`main`, `develop` and tags `0.1.0`–`0.3.3` are all on the remote as of
2026-09-13. **Visibility still unconfirmed** — `gh` is not available here.

It matters because the site session has published that this repo is not
fetchable, with `macha-ts` and `macha-client` as precedent. If it is public
that sentence is now wrong, and it is Macha UI Work's to correct rather than
ours. Loading the URL while signed out answers it in a second.

#### 3.6 The client ships with no endpoints — **decided by Tom, 2026-09-20**

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

### 4. Parity with `macha-client` — the complete list

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

#### 4.1 Screens — 11 of 28 routes, plus 2 partial

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

#### 4.2 Player chrome — 7 of 12 controls, and the spinner

**The buffering indicator is built, 2026-09-25, and seen on `.133`** (mid-screen
while a switched generation buffered). The web client's rules unchanged (`screens/player/bufferingIndicator.ts`):
shown at once on `starting`, after `REBUFFER_SPINNER_DELAY_MS` (3 s, guarded
below core's 7 s stall) on `event.buffering`, never over a failure, with the
web's "Waiting for the node to start the stream — Ns" note after
`START_WAIT_NOTICE_MS` (5 s, guarded below the first-fragment budget). Drawn
outside the chrome's gate, so it outlives the chrome's four seconds. §2.11's
logo can now be defined against it. **To see on the set:** a cold start (the
note should appear on a slow one), a seek outside the buffer, and that the
spinner does not linger once the picture moves.

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

#### 4.3 Components — 11 of 21 ported

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
- ~~**`CardCloseButton`**~~ — **built 2026-09-25, seen working on `.133` the same day.**
  The × on each Continue Watching card calls core's `clear`. Up from the card
  reaches it and Down returns (the scorer cannot: its centre is inside the
  card). **To see on the set:** Up from a card lands on its ×, OK removes the
  entry, focus then lands on the first remaining card, and Down onto the row
  from above still lands on a poster. Building it found that a control whose
  `disabled` changed lost its geometry (`9845ffa`); the player's previous and
  next buttons were exposed to the same thing.
- **`MediaPageTitle`** refresh affordance, **`EpisodeRail`**, **`SectionNav`**,
  **`MusicNav`**, **`StatusNav`**, **`ConnectionForm`**, **`DeviceCapabilities`**,
  **`AsyncIconButton`**, **`AppLogo`**. `EditButton`, `ManageNav` and
  `ManageIcons` are closed with §3.3.

**What `LazyArtwork` does not cover:** an `ArtworkRef` with no `url` at all,
which the web client fetches as a `Blob` via `useArtworkUrl`. Those render as
the letter placeholder here. The fix needs a different shape anyway —
`URL.createObjectURL` does not exist on this platform, so it is a fetch to a
data URI or a cached file.

#### 4.4 Hooks — 4 of 9 ported

Ported: `useAsync`, `useRefreshableAsync`, `useTvNavigation`, `useAlphabetIndex`.

Missing: **`useArtworkUrl`** / **`useViewportArtworkUrl`** / **`artworkViewport`**
/ **`artworkRetry`** (20 uses in the web client — but most of what they are
*for* is now covered differently; see §4.3), and **`usePollingTask`** (7 — the
web client's status pages poll; this client's Status is a one-shot reading
with a refresh, which is honest but stale the moment a node changes).

#### 4.5 Stores — one wired, one dead, one now ours

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

#### 4.6 Music — seven routes, none of them started

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

## 2026-09-28 to 2026-09-30 — 0.8.0 and 0.9.0, start progress, the first failover seen, and the wording ports

**Measured on `.133` where it says so; everything else is asserted from source
and tests.** Moved here from `ACTIVE.md` at the 2026-10-01 clear, as written at
the time.

### The three days in one line each

- **Two releases:** 0.8.0 on core 0.20.0 (`2ceb827`), then 0.9.0 on core
  0.21.0 (`263e308`), each on Tom's version number and push. Records below.
- **Start progress** (server 0.69.0, core `00ff3eb`): the stage under the
  spinner and on the status line, the web client's words; a failover's start
  names no node (`32d4a7f`); `start_no_progress` worded, then imported from
  core's `START_NO_PROGRESS_CODE` (`160474c`). Measured: a 720p to 4K change
  on *The Martian* showed 0/20/48/75% and swapped in 15 s with no 503.
- **First failover seen on the set**, fi-1 to gbni-1, same position, after
  the 4K stream ran at ~0.6x (fi-1 three pipelines deep). Tom separately
  watched one carry *Interview with the Vampire* across fi-1 restarting.
  `AGENTS.md` and the README now say so (`fdb57e3`).
- **Node names:** host, then the cluster's `endpointName`, then the operator's
  name from server 0.70.0 (`1c872c5`, `ee4f8fe`); Status cards use
  `node_name` (`de3ae1c`). Measured: "Corvus GBNI-1", "Corvus FI-1".
- **Why Play chooses a file**, one sentence from every fact (core
  `passedOver` `03b0bdb`, web `qualityChoiceText` `f512cdc`, TV `b5f83e2`).
  Measured on *The Martian*: "Play chooses 1080p, which plays without
  converting. 4K needs its audio converted. Pick a quality to play another."
- **Too slow to play** (core `d1069d2`): the sentence with Try again and
  Choose another quality in their own focus scope, the stepped-down notice,
  and the slow-conversion clause (`9de8f63`, `de3ae1c`). Unit-tested, unseen.
- **Back:** only Home exits, after `flushStorage` (`backAction.ts`,
  `appExit.ts`, `EXIT_FLUSH_BUDGET_MS`). Measured: Movies, Back, Home; Home,
  Back, launcher.
- **Focus:** stays on the top-bar button that chose a screen (`routeFocus.ts`,
  measured); the alphabet strip is a side rail reachable from any row, and a
  letter brings its titles to the top (`54c64ce`, **unseen**: Tom stopped
  testing).
- **Repository links** in the README, the server and site first, then the
  site dropped on Tom's word.
- **Mistakes:** three Up/Right/OK presses on Home started *The Sixth Sense*
  (Up from a card goes to its × first); four player sequences pressed
  fast-forward or Pause because the chrome had hidden between calls; a claim
  that `DetailScreen.versions.test.tsx` was this repo's, when the grep had run
  in the web client's tree; a plain `expo prebuild` before the 0.8.0 tests
  (it must be `EXPO_TV=1 ... --clean`); `adb pull /sdcard/` pulled the whole
  card instead of the captures.

### Released: TV 0.9.0 on core 0.21.0 — 2026-09-29

`main` `263e308`, annotated tag `0.9.0`, both pushed on Tom's word, with
`^0.21.0` from the registry (lockfile `resolved` is the npm tarball, and
`node_modules` held a real directory). Typecheck, 376 tests and the export
passed against that copy, after `EXPO_TV=1 npx expo prebuild --clean`.
Release APK md5 `5e5980bd04453be26ff8cb16056e3346`; aapt2 says versionCode
900, `armeabi-v7a`, leanback required. **Not yet installed:** `.133` was
off the network when it was built. `develop` fast-forwarded to it and
relinked `../macha-ts`.

### Released: TV 0.8.0 on core 0.20.0 — 2026-09-28

`main` `2ceb827`, annotated tag `0.8.0`, both pushed on Tom's say-so, with
`^0.20.0` from the registry (lockfile `resolved` is the npm tarball, and
`node_modules` held a real directory). typecheck, 344 tests and the export
passed against that copy. `develop` merged `main` back and relinked
`../macha-ts` (`00ce233`).

**Measured on `.133`, 2026-09-28 17:30:** release APK md5
`ef17b38478e2219885f8f4853f8da4fe`, read back identical off the set; aapt2
says `versionCode 800`, `armeabi-v7a`, leanback required. Smoke test
passed: Home, *The Martian*'s detail page (three file lines, synopsis below
the poster, now seen), 720p direct play, the Quality row, Stop, Continue
Watching (*The Martian* first). Core's `ae82922` is **confirmed on
hardware**: an uncapped Transcode of the 720p file marks **720p**. Core is
told, with the md5.

**What the next release should not repeat:** the prebuild before `npm test`
must be `EXPO_TV=1 ... --clean`. A plain prebuild was run first; the
manifest it made still required leanback, but what else `EXPO_TV` changes
was not checked, and the APK that shipped came from the correct one. And the smoke
test put *The Sixth Sense* into `tvtest`'s Continue Watching by accident
(see the traps below).

### The Quality row marked nothing after some starts — fixed in core, measured

Fixed in core `ae82922`, **measured on the set 2026-09-28** (720p marked on an uncapped
transcode of the 720p file).
The finding: On a resumed
transcode of *The Martian*'s 720p file with no cap, none of 4K / 2K /
1080p / 720p / 480p / 360p was highlighted (measured 2026-09-27 20:50):
`instruction.quality` matches no step for an uncapped transcode of a
file. Sent to core 2026-09-27 21:00; follow its answer.

### The 4K change, start progress, and the first failover seen — 2026-09-28

**A mid-film switch into the 4K file times out at the server**:
`503 playback_pipeline_start_failed` "timed out waiting for first
fragmented-MP4 segment", on fi-1 and gbni-1 alike, only with a seek into
the 4K HEVC 10-bit source (controls measured and sent). The server's:
Tom has agreed a fixed start budget is wrong. **Built as server 0.69.0
on 2026-09-28 (committed, not deployed), in the shape announced that day:** opt-in `?start=async` (202
`playback_starting`), a `start` object with a stage and counters, a
long-poll, `DELETE .../pending`, and failure only when progress stops.
Measured on fi-1 that day: the start takes 8.6-11.9 s (4K HEVC 10-bit
decoded at ~0.33x). It is all core's to call; the TV answered "fits, via
core", with five notes: core's elapsed budget, the player's timers, Stop
during a pending PATCH, words staying ours, and the https long-poll's
idle timeout. The server's answers, the same day: deleting the session
also drops a pending replacement, so Stop or Back is one DELETE; notes 1
and 5 went to core, with `start_wait_max_ms` proposed at 25 s; stage and
counters are data only. **Core wrapped it at `00ff3eb` (develop, 2026-09-28):**
on a node that supports it, the elapsed first-fragment budget gives way
to no-progress; `snapshot.startProgress?` = `{ kind: 'start'|'change',
stage, progressSeq, elapsedMs, sourceBytesRead?, prerollDecodedMs?,
prerollTotalMs?, outputMediaMs?, firstFragmentMs? }`, set while a start
or a change is being prepared and cleared at ready or failed. Typecheck and
344 tests pass against it through the link. **What the TV would do with it**
is word the stage in place of `startWaitText`'s bare seconds
(`src/text/viewerText.ts`, under the spinner; a slow start is the
spinner's, not §2.11's logo), and say a `change` is under way while the
picture keeps playing. **Built 2026-09-28** as the web client's
wording, read from its working tree (uncommitted there): `startProgressText`,
`preparingStreamText` and the `start_no_progress` sentence in
`src/text/viewerText.ts`, the stage in `startWaitNotice`. Unit-tested only;
**not seen on the set** until 0.69.0 is deployed to a node, and the web
client's copy is itself unseen live.

**Measured on `.133`, 2026-09-28 ~19:10 local** (develop `a85a1a9`+`160474c`
on core `ec608c3`, APK md5 `de3689947278734e0c3090250bd169da`, versionCode
800 like the release; server 0.69.0 on both nodes, Diagnostics on).
*The Martian* resumed as a 720p transcode on fi-1, then Quality 4K in the
player: a change with a seek, **the case that used to 503**.
- **The change line showed, once a second:** "Starting the new stream on
  http://10.35.1.50:7438: 0%" (1-2 s), 20% (3 s), 48% (6 s), 75% (7-8 s),
  then the old stream's lines at 9 s, then the new one at 10 s. No planning
  or preroll stage was ever on screen. The node is named as the full
  endpoint URL, as the web client's line does.
- **The switch succeeded:** trail `session-update` 297.5 s,
  `session-updated` 312.5 s (15.0 s), first fragment 312.8 s. The new
  stream is VIDEO COPY HEVC 3840×2160 47.4 Mb/s with TrueHD 7.1 transcoded
  to AAC 7.1 512 kb/s, fMP4.
- **But it did not keep up:** the buffer grew about 0.6x real time
  (10.7 s to 21.9 s of media in 18 s), with repeated rebuffers.
- **Then the client's first observed failover:** at 340.5 s
  `cluster failed-session-closed` on fi-1 (`attempts: 1`), a new session
  on gbni-1 (`10.44.1.50`) at 346.0 s, `source-failover-ready`, first
  fragment 348.6 s, presented at the same position (143629 ms). At 377.6 s
  `cluster.health preemptive-endpoint-swap` moved routing back to fi-1
  (550 ms against 22 ms). Playback on gbni-1 then stuttered, the media
  session flipping between playing and buffering every ~100 ms, and was
  stopped by hand.
- **Not known:** what closed the fi-1 session. The trail's earlier lines
  scrolled off the eight-line overlay and logcat had rolled, so whether it
  was the stall watchdog, a fragment timeout or the node is unread. The
  next 4K run should capture the trail continuously (logcat is too noisy on
  this set to hold it).
- **The 0.6x was fi-1's production, not the set's link** (the server
  session, read from fi-1's journal the same evening; asserted here, not
  measured). The session swapped to generation 2 at 16:08:42Z, then
  fragment 3 was refused `hold_timed_out` four times running (16:08:49,
  :55, 16:09:02, :10), because fi-1 did not produce it within its 6 s
  hold. fi-1 was also running another viewer's 1080p Martian transcode
  (`641a613b`) and a second 4K start on the same file (`99154b1c`, 39.5 s
  to ready): three pipelines on a 4-core Pi. Those four refusals are the
  likely lead-in to the failover at 16:09:10-ish, but the client trail
  that would confirm it was not captured.
- **The line that names a failover's cause** (core, 2026-09-28):
  `playback.coordinator source-failover-start`, whose `error` is the
  player failure that began it (a stall, a fragment 404, a decode error).
  `cluster failed-session-closed` is only the old session's close that
  follows, and `cluster.health preemptive-endpoint-swap` is the health
  monitor moving work to the lower-latency node. **Capture
  `source-failover-start` above all**; it scrolled off the overlay here.
  The web client saw the same shape on 0.69.0: a 4K HEVC source neither
  node serves at real speed fails over back and forth indefinitely. Core
  has taken the fix to Tom as a behaviour decision. Core `ce31561` makes a
  failover's replacement start report `startProgress` like any other start.
- **To tell node from link next time**, read `stream.production`
  `{produced_ms, producing_ms, produced_age_ms, producer_parked}` on the
  session payload: `produced_ms / producing_ms` below 1.0 means the node
  is the limit; at or above 1.0 with the buffer still falling behind means
  the link is. The TV keeps the old file playing and says "That change could
not be applied.", which the server and core call correct.

### Why Play passed over a larger file — built and measured 2026-09-28

**Say why Play passed over a larger file** (Tom, 2026-09-28: the web
client's "Play chooses up to …" sentence, on the TV too). On `.133` the
screen is 4K, so no `limitedBy` is ever set for *The Martian*, yet Play
picks its 1080p file because the 4K file's TrueHD needs converting, which
core ranks below direct and deliberately does not call a ceiling
(`playbackVersions.ts`). Asked core for structured data on a ranking
pass-over, and the web client to word it first. **Core's half landed at
`03b0bdb`:** `versions.passedOver?` = `{ quality, mediaId?, converts:
{ video, audio }, reasons }`, set only where automatic play chose a smaller
file than the largest within the ceiling because that one would convert
(*The Martian* here: 2160, audio only, `audio-codec-not-playable`).
**Built 2026-09-28** as the web client's `qualityChoiceText` (f512cdc),
one sentence from every fact, replacing `ceilingText`, on the detail
page and in the player's options (the web shows it on the detail page
only). **Seen on the set** on *The Martian*'s page, 2026-09-28.

### Decisions closed and moved from `ACTIVE.md` §3

#### `/manage` and `/items/:id/edit` — **decided, 2026-09-19**

Not TV work. Tom's ruling on the nav bar: match the web client's *including*
Status, and **not Import or Manage regardless of user role**. The metadata
editor goes with Manage. `/ingest` and `/sponsor` were already ruled out
(2026-09-10). The `ManageNav`/`ManageIcons` rows in §4.3 close with it.

---

#### The `@macha/core` import alias — **done, 2026-09-15**

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

#### Is Back from a top-level screen meant to exit the app?

**Partly answered, 2026-09-20.** Tom ruled on Back *inside the player*: if the
controls are up it puts them away, and the next press leaves the film — and
leaving arrives at **the media detail screen**, which now holds for every path
into the player rather than only the one that went through a detail screen
(`App.tsx`'s `play`).

**Answered, 2026-09-28.** Tom: Settings first ("'Back' on settings should
go to Home, not exit the app"), then all of them: "only back from home exits
the app. No confirmation - but the app should make sure that currently
watching etc is persisted before exit." Built in `src/app/backAction.ts`
(every screen without a level to go back to goes Home; Home exits) and
`src/app/appExit.ts` (the exit waits for `flushStorage`, bounded by
`EXIT_FLUSH_BUDGET_MS`, 2 s, which is unmeasured and guarded against Android's 5 s
key-dispatch timeout). **Seen on `.133`**, build md5
`a64ba9c793cfcaefc5fe76f4fcf3a66c`: Movies, Back, Home; Home, Back, the
launcher. That a pending write survives the exit is unit-tested, not
measured.

---

## 2026-09-25 to 2026-09-27 — per-quality Play, resume as left, media lines, and the week's sittings on `.133`

**Measured on `.133` where it says so; everything else is asserted from source
and tests.** The records below were moved here from `ACTIVE.md` §0 at the
2026-09-27 clear, as they were written at the time.

### The week in one line each

- **Per-quality Play** on core's `playbackVersions`: detail buttons, the
  player's Quality row (versions and caps merged into one, Tom), the
  Settings ceiling and offer-everything switch, `displayMode` reading the
  panel (3840x2160), per-codec decoder limits from hardware decoders
  (h263 720×576, mpeg4 1344×1088, mpeg2 and vp8 1920×1088, overall
  4096×2176), all measured.
- **Continue Watching** had recorded nothing since server 0.58.0 (file id
  compared with item id); fixed `0726d94`, then **resume as left** on core
  `89a9d0c`/`7bdc219`/`7a79d49`: same file, mode, cap, audio and subtitles,
  measured passing in direct and in transcode.
- **Resume at zero** (idle 250 ms ticks overwrote the start position before
  presentation): TV `a1e01c0` plus core `d93c9d8`.
- **Media lines** as the web client (core's `technicalSummary`,
  `fileSummaries`), the file pills built that morning and removed, `S04E08`
  everywhere, the synopsis below the poster, Back to the Home card opened,
  next episode on end, the spinner, the × on Continue Watching cards,
  Settings' lower sections reachable, the keyboard no longer raised on
  return, readable selected chips.
- **Found in core via the set:** the transcode-resume PATCH loop (rounding,
  `7bdc219`), the cross-file version switch naming no audio
  (`choice_required`, fixed `7bdc219`), forced vs full subtitles on a switch
  (`7a79d49`).
- **Mistakes:** a Stop meant for a test went to somebody's episode (check
  the set between key bursts); a local copy of the web formatter written an
  hour before core took it (ask core first); a wrong "Shindig moved to
  24:25" (nothing was being written).

### Server releases announced this week (asserted from the server and core sessions)

- **Server 0.64.0** (protocol 22, cluster torrents) is live on fi-1 and
  gbni-1 since 2026-09-27, per the server session (asserted): status and
  playback unchanged; the one new value outside torrents is `error.scope:
  "cluster"`, on torrent 503s only. Nothing for the TV. (0.63.0 before it
  added a torrent 409 and a `threads` array in status, also nothing here.)
- **Server 0.62.3** (`f3bf8d7`) went live on both nodes at 15:42Z
  2026-09-25, covering 0.62.0–0.62.2, per core (asserted): torrent and
  repair internals only, nothing on the wire, nothing for the TV.
- **Server 0.61.0** (`acd74ef`) went live on both nodes at 13:35Z
  2026-09-25, per core (asserted): torrent jobs only, nothing for the TV.
- **Server 0.60.0** (`7c1d210`) went live on both nodes at 12:42Z
  2026-09-25, per core (asserted): a PATCH out of transcode releases the
  slot, so a switch back can be refused `429 resource_limit`, which the TV
  words (`2b15bb2`). **To test on the set:** direct play, switch to
  Transcode in the options, and with the slot free it should work.
- **Server 0.59.0** (`1f37a41`) was on fi-1 and gbni-1 (gbni-1 is
  macnessa, Tom 2026-09-25: core's name for it) since 11:30Z 2026-09-25,
  per core (asserted, not read off a node here). Scheduling only (replica
  repair keeps a 95:5 share under load); 0.58.3 before it was an ingest
  fix. Nothing changes on the wire, so nothing above changes.

### Measured on `.133`, 2026-09-25 afternoon (build `9a117d14…`, core `42cebd6`, server 0.60.0)

Driven over adb; every line below was read off the set or its trail.

- **Resume from Continue Watching works in direct play.** *Shindig* resumed
  at 23:24: `requestedPositionMs: 1404050`, `source-presented` at the same,
  playing on (23:24 → 24:22). A transcoded resume was not tried.
- **0.60.0's slot release, both ways, on fi-1:** direct → "720p · Transcode"
  (`version-chosen`, PATCH `mode: transcode, maxHeight: 720`, updated and
  presented, 27:41 → 27:44); back to "1080p · Direct" (PATCH
  `maxHeight: null`, core's stale-cap fix holding); into transcode again,
  **reacquired** (updated, presented at 29:32). No `resource_limit`, since nobody
  else held the slot; the refusal sentence is still unseen.
- **The served container is FMP4, and that is correct.** Both a Version
  pick and a plain Mode → Transcode PATCHed `container: "fmp4"`. Core
  confirmed it: `segmentContainer` picks fMP4 whenever `hlsFmp4` is true,
  and MPEG-TS only for a host that states `preferSegmentContainer: 'mpegts'`
  because fMP4 is broken on its device (the 2017 Samsung, the web client's
  host). Its earlier "mpegts on the TV" was a mix-up. **State nothing here
  unless fMP4 is measured failing on this set**, and then as policy with the
  evidence.
- **Settings > Playback reads "Screen (2160p)"**, so `displayMode` reads the
  panel (3840x2160 active mode), not the 1920x1080 UI.
- **The decoder limit, first read from the codec XML** (then measured, below): from the loaded
  codec variant (`ro.media.xml_variant.codecs` `_4k_2`, RTD2875P), ten
  decoders declare 4096x2176, so the app should claim class 2160 and 4K
  keeps direct play. **Asserted from the XML, not from the app's own call.**
  The claim is one maximum across all decoders, so a codec whose own decoder
  stops at 1920x1088 (VP8 here) is still claimed 4K. **Core, 2026-09-25: no
  per-codec limits for now**; such a file fails direct decode and the decode
  fallback transcodes it once. If a real title hits it, send core the file
  and the trail. **Core added per-codec limits after all (`d6fa069`)**, and
  the TV states them (`videoCodecMaxSize`, from the same `MediaCodecList`
  walk, only codecs below the overall maximum). **To read on the set:**
  Settings > Hardware decoding > Codec limits and Software only, build
  `13cdb5cf…`. Limits now come from **hardware decoders, software only where
  a codec has none** (a software decoder's declared size is what it accepts,
  not what the CPU plays in real time). The vendor XML predicts `vp8
  1920×1088`. **Also re-read Decoder limit**: it was `4096×2176` with software
  counted and should be unchanged. Report both, and which decoder kind, to
  core.
- **Seen working:** the Version group (marked from `instruction.quality`),
  the spinner mid-screen while a switched generation buffered, the × on a
  Continue Watching card (Up reaches it, Down returns, OK removed *The
  Train Job* and focus landed on the remaining card), Back from the player
  onto the season with the episode focused.
- **Screenshots never show video**: `screencap` omits the hardware video
  plane, so a playing picture captures black. Read position off the chrome.

**Found, fixed, and seen fixed on the set** (build `9be437b0…`, installed
17:04:52, md5 read back):

1. **Settings' lower sections were unreachable.** Hardware decoding and
   Platform surface are now focus stops (`851b38b`): Down from Diagnostics
   lands on each with the ring and scrolls it into view. **Measured through
   it: Decoder limit `4096×2176`**, from the app's own call, so the set is
   class 2160 and 4K keeps direct play.
2. **Returning to the app opened the endpoints keyboard.** With
   `stateAlwaysHidden` (`19d4056`, `0x13` in the APK) it does not:
   `mInputShown=false`, tried with the page at the top and scrolled down. The
   field still takes native focus (a caret shows), but OK on TV Shows then
   opened TV Shows, not the keyboard.
3. **Selected Settings chips were dim red on grey.** Now the web client's
   pressed pill (`851b38b`): "Screen (2160p)" reads in heading colour.

### Continue Watching recorded nothing since server 0.58.0 — fixed, measured 2026-09-27

A session names its file (`mediaId: "macha:…"`) and the item separately
(`itemId`) since 0.58.0, and `attributableProgress` compared the file id with
the item id, so no position was ever written: *The Martian*, played to 1:24
and closed, never reached the rail. `0726d94` matches on `itemId`, then on the
file being one of the item's. **Measured on `.133`** (build `eb7d476c…`,
installed 16:55:06): played to 0:49, Stop, and the detail page gained its
restart button and Home's rail put *The Martian* first. **So any resume point
written by 0.7.x develop builds since 0.58.0 went unwritten**, including the
*Shindig* entry thought to have moved to 24:25 on 2026-09-27 (it did not).

**Tom, 2026-09-27: Continue Watching should store the item id and the media
id, the mode, the resolution, the subtitle settings, and everything needed to
resume as if you had never left.** Core's store and resume path; sent to core.

### Core's checklist on `.133`, 2026-09-27 evening (build `4c6e3674`, core `e964514`, fi-1, server 0.64.1)

Measured, sent to core verbatim. **Resume as left: pass** (720p file, direct,
subtitles on, 10:59). **Automatic resume: pass** (same file, 3:59). **Transcode
resume: fail, a PATCH loop**: every ~1.5 s `session-update {seekMs:
1560055.99, preferences: {subtitleStream: 2}}` → `session-updated` →
`generation-update-ready` (reason `seek`), "Preparing new stream…", no
picture; core's. **Version switch across files refused**: 2K from the 720p
file PATCHed the 4K file with no audio stream, and fi-1 answered `400
choice_required` ("this media has 8 audio streams: name one with
preferences.audio_stream"), reproduced by curl; the TV said "That change
could not be applied."; core's. **Codec limits**: h263 720×576, mpeg4
1344×1088, mpeg2 1920×1088, vp8 1920×1088, all hardware; overall 4096×2176.

**Driving stopped when someone else started watching:** a capture showed
*Follow the Anger* S04E08 at 46:38 in a new app instance, and a Stop meant
for the loop went to that player. **Check `media_session` for a live
position between every key**, not only before a sitting: the set can be
picked up mid-sitting.

### Resume as you left it — built 2026-09-27 on core `89a9d0c`, measured the same evening (above)

Continue Watching now saves the item, the file and the resume state (mode
and whether the viewer chose it, version cap, audio, subtitles) through
`progressFor(..., snapshot)`, and every resume goes through
`src/app/startPreferences.ts`: a picked version as picked, a resume as left,
a play from the start fresh. Build `a80c02e4…` (TV `6ab11c3`). **To see on
the set:** play *The Martian*, pick 720p in the player's Version group and
English subtitles, play past 30 s, Stop; resume from Home's rail. It should
come back on the same file at 720p with subtitles on. Then Restart on the
detail page: a fresh automatic start (1080p direct, subtitles off).

### Synopsis below the poster — built 2026-09-27, not yet seen on the set

Tom: on the TV, the description below the poster. Set across the page under
the poster row (`synopsisBelow`), not in a poster-width column. Unseen: the
set went offline before the build could be installed.

### Media info, as the web client shows it — measured 2026-09-27

Tom's rulings the same day, relayed by the phone and by core: copy the web
style, formatted for the device, music included; the technical details are
core's (`technicalSummary`, `fileSummaries`, `qualityLabel`, core `5622020`),
the layout is the client's. So under the title, one line per file, identical
files combined (`src/app/useFileLines.ts`, with the duplicate-report TODO), a
track's line in the audio player, quality buttons named 4K/2K/1080p/720p with
no Direct/Transcode, and the web client's `qualityLimitText` as the cap
sentence. **The file pills built that morning are gone**, with the partial
sentence (the detail page still reads `factsReport`).

**Measured on `.133`** (build `ed6af6c8…`, TV `a9abe72`): *The Martian*
shows four lines, `2h 31m · 3840×2160 · HEVC · TRUEHD · 47.4 Mbps`, `1m ·
1280×534 · H.264 · AAC · 1.5 Mbps`, `2h 31m · 1280×534 · H.264 · AAC · 1.3
Mbps`, `2h 31m · 1920×1080 · HEVC · E-AC-3 · 3.1 Mbps`, and buttons 4K, 2K,
1080p, 720p. The catalogue now lists four files for it (two that morning);
the `1m` one looks like a trailer filed with the film. **A track's line in
the player is not yet seen.**

### Back to the card opened, on Home — measured 2026-09-27

Tom: Back should return to the card opened. Home's rails now give their
cards rail-scoped ids (`mediaFocusId(id, rail)`); measured on `.133`: open
*Arrival* from Home's Movies row, Back, focus is on *Arrival*.

### Next episode on end — built 2026-09-25, not yet seen on the set

Tom: when an episode ends, play the next if one exists, across seasons.
`src/app/autoAdvance.ts` (core's `episodeNeighbours`, which crosses seasons;
the same as the next button). **To see on the set:** seek to the last
minute of a season's last episode (*Firefly* has one season, so a show with
two), let it end, and the next season's first episode should start from its
own resume point, with the ended one gone from Continue Watching. Then the
last episode of a show: the player should stay where it ends. **Not decided:**
what a film, or a show's last episode, should do at its end (the web client
returns to where play began and stops). Ask Tom.

### Per-quality Play: the design (agreed with core 2026-09-25, built, unmeasured)

Tom's rulings, relayed by core, the web client and the phone client:

- **The generic Play stays and means "decide for me".** Beside it goes one
  play button per available quality, each playing a specific file or a
  capped transcode. The same set appears in the player's options during play.
- **Cap down, never up.** Offer each class at or below the best file's, down
  to 720p. A class with its own file plays that file; one without is a capped
  transcode from a better file. Nothing above the best file is offered.
  Where the best file is below 720p, its own class is shown (core's classes:
  2160, 1440, 1080, 720, 576, 480, 360). Classify by width as well as height
  (a 1080p scope film is about 1920x800).
- **A quality ceiling in Settings** (720p, 1080p, 1440p "2K", 4K), **per
  device**. Label by height; "2K" is ambiguous. With no setting, automatic
  play caps at the display's class. **On this TV that is the panel's
  physical mode, 3840x2160 on `.133`** (`Display.getMode()`), not React
  Native's 1920x1080. An explicit pick is never capped. Core gives a reason
  code when the cap limits the choice, and we word it.
- **Not from measured bandwidth.** No default is derived from it: a ceiling
  that moves by itself would change what a viewer chose.
- **Capability does not hide a version.** A version this set can't decode
  directly can still be transcoded, so show how it would play. A capability
  claim is a prediction, not proof (the MPEG-4 AVI).
- **On the TV:** the detail page gets one row, Play first (default focus)
  and then the quality buttons, moved with D-pad Left/Right, shown only when
  there is more than one option. The player's options panel gets a group in
  place of Source.
- **Core's side** (proposed, awaiting the commit): `playbackVersions(files,
  capabilities, preference)` for the detail page, including transcode rows;
  `snapshot.versions` during play; `play({ media, mediaId |
  transcodeCeiling })` and `update(...)` as a viewer choice that no fallback
  overrides; and a per-device preference store with a `maxHeight`. **Every
  word is ours.**

### The Martian in 4K left the player with no explanation — open, not reproduced

Tom, 2026-09-27 ~13:10: pressing 4K on *The Martian*, the player said it was
waiting for the stream to start for a while, then returned to the detail
page with nothing said. **Not reproduced**: the same press at ~13:20, with
Diagnostics on, started (fi-1, `mode: transcode` with video copied, TrueHD
7.1 to AAC 7.1, FMP4; `first-fragment`, `source-presented` 836.9 s) and
played, buffering heavily (0:51 after a minute: 47 Mbps). **What is known:**
the app did not die (one process from 13:08, per `ActivityManager`); only
Back (twice: the first hides the chrome), Stop and the close button leave the
player, and nothing in `App` or `PlayerScreen` pops it on a lifecycle change;
the set's logcat holds no app or codec lines at all, so it cannot say more.
**Next time:** keep Diagnostics on and read the failure screen or the trail
before anything else; if it exits, note whether a key was pressed. **Diagnostics
was left on and switched off again at the 16:55 sitting.


## 2026-09-24 to 2026-09-25 — 0.7.0, the restart fallback, the decode fallback, focus, and the server that stopped choosing

**Measured on `.133` where it says so; everything else is asserted from source
and tests.** In one line each:

- **Released 0.7.0** (`73cf87d`, tag `0.7.0`, pushed on Tom's one-off say-so)
  against core `^0.19.0` from npm. Verified from a fresh clone of the tag with
  no sibling core: `npm ci`, typecheck, 297 tests, export; the APK
  (`versionCode 700`, `armeabi-v7a`, leanback) direct-played on `.133`.
  **Then broken by server 0.58.0** (see ACTIVE §0): core 0.19.0 sends
  `item_id`, which 0.58.0 refuses.
- **Restart fallback** (measured): the remembered-endpoint list was wiped by
  the first health cycle after every restart, because it was seeded as
  `bootstrap` and core persists only `discovered`. With only a dead address
  configured, the set reached Macha through remembered nodes over two
  restarts. Now core's `seedEndpoints`.
- **Decode fallback** (measured): the set's hardware decoder fails MPEG-4
  Part 2 (`OMX.realtek.video.decoder`, `0x80001009`, `format_supported=YES`).
  The adapter now reports a renderer error as `media` (`decoderFailureKind`),
  and core `e840d72` transcodes on the same node at the viewer's position.
  *Classroom 216* played that way in Auto.
- **Remote next/previous keys** (measured on `.133`). The same test found
  that **switching episodes lost the place**: a progress write in the gap
  before React re-rendered stored the new episode's position under the old
  one. Fixed (`attributableProgress`), not yet seen on the set.
- **Focus** (Tom): the top bar's ring restored; the fallback returns to the
  nav item last used; one `Button` for Settings, sign-in, offline and the
  sign-out dialog. **§1.12:** Settings says signed out instead of calling a
  401 an outage; Sign in sits under the password and the typed draft
  survives a trip to Settings.
- **Viewer text:** Settings > Server and Catalogue word the server's codes
  (0.56.0) and never its sentences; the decode-fallback notice, the refused
  track choice, and the track view (artwork, artist, album and year, track)
  are all worded locally.
- **Every file's facts go to core**, so the client chooses the file; nothing
  outside core lets the server choose (audited for 0.58.0).
- **Principles and laws** adopted from core (`docs/principles-and-laws.md`),
  and law citations checked against what each law says.
- **Settled, not built:** the native-adapter trial is shelved ("the player is
  good enough"); per-quality Play is designed with core and waits for its API.

**What went wrong, so it is not repeated:**

1. **Pressed next on the set while Tom was watching it**, which moved him off
   his episode and lost his place. It exposed a real bug, but check for a
   viewer first: if `dumpsys media_session` says playing and nobody asked
   for a test, ask.
2. **Named a cause without evidence:** said `monkey … 1` had injected the
   keypress that started playback. Tom had played it himself. Say "unknown"
   until something shows the cause.
3. **Turned "never talk to old servers" into a core redesign request** before
   asking Tom what he meant; he withdrew it as a false alarm. Clarify a sharp
   ruling before propagating it to other sessions.
4. **A restart test that tested nothing:** the IME's Enter did not save the
   endpoints, and two restarts ran against the old configuration. Read the
   saved state back before a test that depends on it.
5. **`npm install` kept the lockfile's `file:` link** after `package.json`
   said `^0.19.0`; the version read right only because the checkout was also
   0.19.0. `npm install @machafoundation/core@^0.19.0` forced the registry
   copy. Always check `ls -ld` and the lockfile's `resolved`, never the
   version string.
6. **A commit that held half its change:** `git add` aborted on a path
   `git rm` had already staged, and the commit went ahead without the rest.
   Read `git show --stat` after every commit.
7. **Pushed develop a second time** under "push develop and continue", for a
   follow-on fix. It was probably within the instruction, but a push is Tom's
   by default; say so before, not after.
8. **Missed the screen timeout:** it was set to 30 min for a sitting and left
   there, because the set dropped off before the sitting ended. ACTIVE §0
   records it for the next session to restore.

## 2026-09-23 to 2026-09-24 — episode navigation, search and focus, reaps that stay on their node, and every word moved out of core

**Measured on `.133` throughout, against builds whose md5 was read off the set.**
In one line each:

- **The resume point survives a kill** (§1.11): force-stopped at 3:24, came back
  at 0:53 — the one write the model predicted, including the attempt core
  declined below its 30 s floor.
- **Episode navigation, Tom's business P0** (§1.13): previous/next on every
  episode, greyed when absent; Back walks season → series → TV Shows from any
  entry point. Core supplied `episodeNeighbours` the same evening.
- **Reaps** (the P-1 sections below): two direct-play reaps recovered in ~4 s but
  failed over to remote nodes; the cause was this client reporting a
  direct-play fatal as `unknown`. Core's liveness-before-charge change then
  made a **transcode reap recover on the same node**. A direct-play reap never
  reaches the player at all, because a deleted session's open body keeps
  streaming.
- **Search, sort and focus** (§1.14, §1.15): the web client's Search design
  language; Sort By on every library; the focus scorer rebuilt on edges, same
  row for Left/Right (stopping at the row's end), nearest row for Up/Down, and
  an undo for the opposite press (TV only, by Tom's decision). The web client
  ported everything but the undo.
- **Viewer text left core** (§1.16): Tom ruled core composes no viewer text;
  every string moved to `src/text/viewerText.ts` with the wording unchanged.

**What went wrong, so it is not repeated:**

1. **Claimed "seamless failover needs the native adapter"** — the exact wrong
   claim `COMPLETED.md` already records as the fourth about that feature.
   Read the file's own record of mistakes before comparing designs.
2. **Proposed a one-byte `Range` probe** to classify direct-play failures; Tom
   rejected it as a brittle hack and core reverted it the same hour.
3. **Reported the set signed out when the sign-out had not happened** — the
   confirm press had landed on Cancel, whose focus looks like Sign out's
   styling. Capture after a destructive press, not before.
4. **A first undo-rule test passed before the change existed** — the layout
   let geometry pick the right answer. Rebuilt so geometry disagreed; then it
   went red.
5. **A focus rule shipped that skipped whole rows** ("row first" read as "same
   column first" for Up/Down), found only on the set. Tests with real screen
   geometry catch these; tests with tidy grids do not.
6. **`describePlaybackSession`'s fields kept their names and became objects** in
   core's text cut. It typechecked, and would have thrown inside a `<Text>`
   the first time the player drew its stream line. Grep every render of a
   changed field, not just the compile errors.
7. **Several readings of `dumpsys media_session` were stale snapshots.** Read
   the `updated` stamp against `/proc/uptime` before trusting a `state=`.

### Reaped on a transcode, 2026-09-23 23:51 — **recovered on the same node**. Core's liveness fix works on the set.

**Measured.** Build `d0298604…` (core `2bcce57` onward through the link).
*Arrival* chosen because the set cannot decode its DTS audio, so Auto built an
HLS session without touching the options menu: `9ea528ac…` on `10.35.1.50`,
`mode: transcode`. The chrome read `FMP4 · http://10.35.1.50:7438`, `VIDEO COPY ·
H264`, `AUDIO TRANSCODE · DTS 5.1 → AAC 5.1`.

| Time | |
| --- | --- |
| 23:51:35 | session deleted, `204` |
| 23:51:36 | buffer stops at 105.5 s. Each HLS segment is its own request, so the reap bites at once, unlike direct play |
| 23:52:42.185 | ExoPlayer `state=7` at 105.3 s, the buffer's end, **66 s** after the reap |
| 23:52:43.46 | new source, buffering |
| 23:52:50.42 | playing |
| 23:52:49 (node) | replacement `fbfbe0b1…` on **`10.35.1.50`**, `transcode`. Nothing on macnessa or ramaroja |

On screen the film resumed where it stopped: 2:54 at 23:53:55, which is 1:45
at 23:52:50 plus the elapsed time. About 8 s without picture (error plus
buffering). The two direct-play reaps earlier the same night left `10.35.1.50`
for remote nodes. **This one stayed**, which is what core `2bcce57` changed:
an unclassified fatal now asks the node whether the session exists before
charging it.

**Still true:** nothing reacted for 66 s after the first failed segment.
Detection waits for the buffer to run dry because `expo-video` reports no
per-request failure (point 3 below). The trail was off for this run, so the
classification lines were not seen. The evidence is the node's session list
and the resumed position.

### Reaped twice on `.133`, 2026-09-23 — no freeze, ~4 s visible, but it failed over instead of regenerating

**Measured.** Build md5 `1b528dea…` — which **does carry everything this
section waits for**, whatever "Not installed" below says: the bundle holds
`failed-session-close-timeout`, `standby-preparation-refused`,
`client_recovery_deadline`, `session-reaped-regenerating` and
`generation-regenerate` (`verify-on-device.sh bundle`, all present in UTF-8;
the local APK is byte-identical to the installed one). Signed in as `tvtest`,
so the reap could use the account's own token. Diagnostics on for the runs,
off again afterwards; screensaver disabled for the runs, restored to
`1` / `600000` afterwards.

| | Reap 1 | Reap 2 |
| --- | --- | --- |
| Session reaped | `0ccefac8…` on `10.35.1.50` (local, node `855716bd…`) | `719d5cdb…` on `macnessa.macha.network` |
| Client state at DELETE | paused at 0:52 | playing at ~7:40 |
| `DELETE` | 18:37:21, `204` | 18:46:10.843, `204` |
| Buffer stops growing | 18:39:07, ~6 s after unpause, at 117.461 s | **18:48:39 — 2 min 28 s after the DELETE**, at 683.989 s |
| Player notices | 18:40:06.230, ExoPlayer `state=7` at 117.363 s | 18:49:37.181, `state=7` at 683.875 s |
| Playing again | 18:40:10.546 | 18:49:41.229 |
| New session | `macnessa.macha.network` (node `377ce5b1…`, `78.149.248.154`) | `ramaroja.macha.network` (`85.87.142.154`, a Spanish ISP) |
| Mode after | `direct`, unchanged | `direct`, unchanged |

**The viewer saw about four seconds, twice.** From the hardware composer's
frame posts to our surface: a 0.90 s gap then a 3.05 s gap, 18:40:06.4 →
18:40:10.35; reap 2's state timeline is the same shape to within 0.1 s. No
freeze, no failure screen, and the resume position is exact both times
(`source-presented positionMs` equals the buffer end). **The P-1 freeze did not
reproduce.**

**What the trail shows** (reap 1; reap 2 is line-for-line the same):

    2433.8s playback.api session-create
    2433.9s playback.api http-error-response   DELETE …/0ccefac8…  404  (13.3 ms)
    2433.9s playback.cluster failed-session-closed  {"attempts":1}
    2434.0s playback.api session-created       macnessa.macha.network::719d5cdb…
    2434.0s playback.coordinator source-failover-ready  old 10.35.1.50 → new macnessa
    2434.0s playback.coordinator source-presented  positionMs 117362

`failed-session-closed` appearing answers this section's kept-honest question
below: **the close settles**, in one attempt, once the node answers.

**Four things this changes or adds, in order of weight:**

1. **It took the failover path, not regenerate, and left a healthy local node
   for a remote one — twice.** `10.35.1.50` answered its own `status` at
   14 ms throughout; the first recovery went over the internet to a different
   node, and the second to a third node in another country. That is §1.0's
   2026-09-20 finding again — *"left a healthy local node for a cross-site
   one"* — except that this time the mode stayed `direct`, so the cost was
   bandwidth and latency rather than a transcode. **Core then noticed on its
   own**: `3055.8s cluster.health preemptive-endpoint-swap` from ramaroja
   (272 ms) to `10.35.1.50` (14.3 ms), 51 s after the second failover — which
   moves preference, not the playing session.
2. **Why it failed over: this client sends every direct-play fatal to core as
   `unknown`.** Read from `src/player/ExpoVideoAdapter.ts`
   (`kindForTerminalError`), not seen on the trail: `if (!source.isManifest)
   { warn('terminal-failure-unclassified', { state: 'not-a-manifest' });
   return 'unknown'; }`. Both reaps were progressive MKV. Core confirmed the
   other half the same evening, from its tree at `d58375a`: an `unknown` fatal
   is endpoint evidence, `ClusterPlaybackResolver.failover` charges the node
   and walks away, while `not-found` would have made it check liveness and
   **regenerate on the same node, uncharged**. So the fix is at the
   classification, and it is ours. **How is open.** A one-byte
   `Range: bytes=0-0` probe of the progressive source was proposed to core,
   and core built it (`probeSourceReadiness`, core `9885730`). **Tom rejected
   it the same evening — "a filthy brittle hack. No." — and it is not used
   here.** Core reverted it in `629e89c`; it was never published, and core's `dist`
   no longer contains it (checked here, dist hash `27c7fdf7742a`). Do not
   re-propose a stream probe.
   The trail line that would have shown this on screen was lost because **one
   recovery emits at least nine lines and the overlay holds eight**. That still
   wants fixing before the next reap, because the next thing to confirm is the
   `not-found` → regenerate path on hardware.
3. **Detection waits for the buffer, not for the failure, and on `expo-video`
   it has to.** The fetch against the dead session failed at 18:39:07 and
   nothing reacted for 59 s, until the player ran dry. Core's answer is the
   degradation channel: report the first failed fetch, and it regenerates
   inside the remaining buffer (the web client measured 3.44 s, same node,
   invisible). But this adapter's `subscribeDegradation` is fed only by the
   stall watchdog, and `expo-video` exposes no per-load error (§2's "failure
   evidence is weaker"). The native `PlayerEngine.kt` does see `onLoadError`
   with `responseCode` (line ~450), and it is not the adapter the set runs.
4. **A deleted session on `macnessa` kept serving for two and a half
   minutes.** The buffer grew for 2 min 28 s after its `DELETE` returned `204`
   — the stream already open was not cut. Reap 1 against `10.35.1.50` stopped
   within ~6 s of the next request. **The server session answered from its
   code** (server 0.53.2, `src/playback.cpp`, asserted, not measured):
   `erase_session` removes the record, stops any transcode and returns `204`,
   but has no handle on open response bodies. The `/direct` route checks the
   session only when a request *arrives*, and the body it then streams captures
   the file, not the session. So an in-flight ranged body runs to the end of
   its range, and only the *next* request gets `404 stream not found`. The
   server code is the same on every node; its guess at the 2.5 min vs 6 s gap
   is one long open-ended range versus several short ones (unverified). Whether
   a delete should also cut in-flight bodies is with Tom, and nothing on the
   server has changed. **For P-1 this means a reap on direct play surfaces
   only at the player's next request**, which can be minutes away.
   **And a third reap, the same night, says even that may not hold.**
   Measured on build `d0298604…`, which carries core's liveness-before-charge
   change (`2bcce57`): session `b9d5aed0…` on `10.35.1.50` deleted at 23:03:21
   (`204`), after which no node listed any session for the account. Playback
   carried on for eight minutes with its buffer growing. Then a seek of more
   than two minutes past the buffered edge (529 s → 661 s) at 23:11:31, and
   playback **still** carried on, the buffer reaching 808 s over two open
   connections to `10.35.1.50`. Whether that seek opened a new request, which
   the server says would `404`, or reused an open one could not be seen from
   here. **Consequence: core's liveness fix could not be exercised on direct
   play, because the reap never reached the player.** It stays unverified on
   the set.
   **Neither side logs enough to settle it.** The server session (same
   night): its journal has no line per direct range request at any level, and
   the delete logs nothing either, so the window is silent. From the code,
   every request to `/direct` looks the session up first and would `404`, so
   *their inference* is that no new request was made and the seek was served
   from an already-open body. The set's logcat is equally silent: 5 286 lines
   in the 11 s around the seek, none from OkHttp, ExoPlayer or media3.
   `expo-video` logs no requests. To test a reap, use HLS or a transcode,
   where each segment is its own request.

**Not verified, kept honest:** that "failover" here is a misclassification
rather than correct behaviour for a stream-fetch error; and whether a
`not-found` from the session `GET`, the 2026-09-20 entry, still regenerates and
still hangs. Nothing today touched that path.

**Measured 2026-09-20, 22:58, on the TCL, with core's walk fix (`10a1d93`) in
the build.** A session deleted under a paused client was, for the first time,
classified correctly:

    755.3s playback terminal-failure-classified  {"status":404,"kind":"not-found"}
    755.3s playback failure                      {… "kind":"not-found"}
    755.4s playback.api http-error-response      GET  /playback/sessions/df33040e…  404
    755.4s playback.coordinator source-reaped    endpoint 10.35.1.50:7438
    755.4s playback.coordinator session-reaped-regenerating
    755.4s playback.api http-error-response      DELETE /playback/sessions/df33040e…  404

**And then nothing, for minutes.** Position frozen at 5:00, chrome reading
"Preparing new stream on http://10.35.1.50:7438…", no failure screen, no
further line. Tom watched it freeze; this session had reported it as
recovering from 25-second screenshots, and was wrong.

### 1.16 Viewer text leaves core — Tom, 2026-09-24, **done on develop `9b3d56f`**, against core dist `4dd849e9c8a3`; not yet seen on the set (the set's only node was down)

Core will stop composing any viewer text (see AGENTS.md). This client
currently takes from it: `episodeLabel` and `trackNumberLabel` (`cardLines.ts`);
`media.subtitle` wherever a card or the player shows one; `choiceLabel`
(`SortControl`) and `SearchCategory.label` (`CategoryToggles`); `error.message`
(`Status.tsx`, `failureCopy`); and the coordinator's notice sentences
(`PlayerScreen`). All reported to core (message `6b8ba178`) with a request for
codes on every error and notice, and the album's artist as data. Move each to
local text as core's replacement lands, so the set never shows a gap.

### 1.15 Search, sort and focus — **built and measured on `.133`, 2026-09-24**

Measured on builds up to md5 `e04303d9…` (develop `58e9c65`), signed in as
`tvtest`. Everything in §1.14 is done, and so is the focus work that followed:

| Checked on the set | Result |
| --- | --- |
| Search control row (field, Sort By, Movies/TV Shows/Music, refresh) | as the web's design language; one height and shape |
| Episode and track lines | "Deadlock / Star Trek: Voyager / Season 2 Episode 21"; "Tool - Ænima (1996) / Track 6" |
| Continue Watching | "Firefly / Season 1 Episode 3" |
| Square music art | full width, centred in a poster's height, title on the posters' line |
| Right from the search field | Sort → Movies → TV Shows → Music → Refresh; never into the results |
| Down then Up | returns to the control left (the undo rule, TV only by Tom's decision) |
| Up from a Movies card under a short Continue Watching row | the row above, not the top bar |
| Left past Home | stops; no longer drops to a card |
| Sort By on Movies / TV Shows | steps Title → Year → Recently added; A–Z hidden outside Title; each list starts at Title |
| Episode card focus | the movie card's frame, gap, wash and scale |
| Back to TV Shows | Firefly focused and fully in view |
| Options panel | thick focus border, fill only for selected; focus stays in the panel past the chrome's timer |

The focus rule changes (edges not centres; same row for Left/Right and stop
at its end; nearest row for Up/Down) are in the web client too; the undo rule
is not, by Tom's decision.

**Still faint, found while checking:**
- **The top bar:** focus and "current page" are the same fill, a shade apart.
- **The sign-in buttons:** after moving between them, neither showed focus.

### 1.14 Search and focus — Tom's list, 2026-09-23 — **done, see §1.15**

From Tom, verbatim in substance:

1. **Episode results name their series.** A search hit that is an episode
   shows only `S01E01` under its title today; it needs the series name too.
2. **The search field spans the full width**, and a **sort by** control sits
   in the same row.
3. **Search results use the movie card's focus look**: the thicker red border
   with a gap between image and border. Same settings as the movie selector.
4. **Episode cards the same** (Tom, same evening, before the Search list):
   the season rail's episode cards get the movie card's focus look. They
   currently show a thin outline.

Found on the set while trying to switch a stream to transcode, measured on
`.133`:

- **The options panel's focus is nearly invisible.** A focused chip differs
  from a selected one only by a one-pixel red border. Three attempts to reach
  Transcode by D-pad landed on Direct or left the row without any visible
  sign. On a 10-foot UI that is unusable.
- **Opening the panel does not reliably move focus into it.** Once focus
  stayed on the transport row, so the next Right moved to ✕.
- **Up from the season page's episode rail does not reach the top bar**; it
  moves along the rail.
- **`dumpsys media_session` `state=` readings can be stale** — check the
  `updated` stamp against `/proc/uptime` before trusting one.

### 1.13 Episode navigation, Tom's business P0 — built and **measured working on `.133`**, 2026-09-23

**Measured** on build md5 `d0298604…` (develop `9b4b638`, core `3f77ef4`
through the link, bundle checked for `episodeNav`, `chromeButtonDisabled` and
`provisional`, each absent from the older bundle), signed in as `tvtest`.

| Step | What the set did |
| --- | --- |
| Resume Bushwhacked S01E02 from Continue Watching | control bar: restart · **previous** · rewind · pause · forward · **next** · options · close, both enabled |
| Next | switched to Our Mrs. Reynolds S01E03 at 0:07, direct from `10.35.1.50` |
| Back | **Season 1**, focus on 1×03, rail scrolled to it, TV Shows lit in the top bar |
| Back | **Firefly**, synopsis shown, Season 1 focused |
| Back | **TV Shows**, Firefly focused |
| TV Shows → Firefly → Season 1 → episode 1 | The Train Job S01E01: **previous greyed**, next enabled |
| Left twice from pause | pause → rewind → **restart**; the greyed button is stepped over |

The rule is core's (`episodeNeighbours`, core `8dd1fcf`): it crosses season
boundaries, keeps specials as their own chain, and answers empty instead of
failing. This client owns the lifecycle (`src/app/useEpisodeNeighbours.ts`),
the stack (`src/app/libraryTrail.ts`, six tests) and the buttons.

**One defect found and fixed on the way** (`9b4b638`): opening a series from TV
Shows left focus on the top bar's Home, so the next OK went Home. The screen's
default card registers only after its fetch, and `focusDefault` had fallen back
to the first thing on screen. That fallback is now provisional: a late
`defaultFocus` element takes over unless the viewer has moved. Four tests; the
first was seen red with `'nav-home'` where `'season-1'` belonged. **Asserted,
not measured:** that this predates tonight's change. A plain `push` ran the
same effect.

**Seen and not fixed:** after Back to TV Shows, focus returns to the right card
but the page does not scroll to it, so Firefly sat half below the fold. Not
checked on the old build, so whether it is new is open.

**The remote's own previous/next media keys are not wired.** Not attempted:
nothing here confirmed which `eventType` the TCL's remote sends for them.

### 1.11 The resume-point kill test — run 2026-09-23, **passed**, and the stored position matched the model to the second

**Measured on `10.35.1.133`** (TCL, Android 12), md5 `1b528dea9c6a24db…`,
`versionCode 600`, signed in as `tom`, serving node `10.35.1.50`. Everything
below is read off the device or the node; nothing is inferred from the source
except where it says so.

*Harry Potter and the Half-Blood Prince* (2009) was chosen **because it was not
in Continue Watching** — the rail held Joy of Cooking S04E05, The Day After
Tomorrow and 28 Days Later — so a new entry could not be confused with an old
one. Its detail page offered **Play only**, no resume affordance.

| | |
| --- | --- |
| Play pressed | 17:55:39 |
| Playing, confirmed | `state=3`, position 14 927 ms, `speed=1.0` |
| Trail on screen | `MATROSKA : http://10.35.1.50:7438`, `DIRECT · HEVC · 1920×800 · 2.4 Mb/s`, `DIRECT · ENG · AAC · 5.1 · 48 kHz` |
| `am force-stop` | 17:59:11, at position **204 209 ms (3:24)** |
| Process after | gone |
| Relaunch | 17:59:31 |
| Continue Watching | **Half-Blood Prince first**, ahead of Joy of Cooking and Day After Tomorrow |
| Resumed position | back-extrapolated to **53 456 ms** at the moment Resume was pressed |

**The stored point was ~53 s, and that is exactly what the design predicts.**
`useContinueWatchingWriter` ticks every `CONTINUE_WATCHING_TICK_MS` (30 s) from
mount; core declines anything below `MINIMUM_PROGRESS_MS`, which is **30 000**
(read from `macha-ts/src/state/continueWatching.ts` at `a3b40ca`). So the tick
at position ≈23 s was attempted and declined, the tick at ≈53 s landed, and
`CONTINUE_WATCHING_WRITE_INTERVAL_MS` (5 min) then held off the next one —
which never came, because the kill was at 3:24. **One write, exactly where the
model says it should be**, including the declined attempt that
`nextWatermark` exists to retry.

**Loss on the kill: 150.7 s**, against a bound of one write interval. The
feature does what `progressPersistence.ts` claims, on the kill shape it was
written for.

How the position was established, since `dumpsys media_session` misleads here:
its `position` is a **snapshot, not a live counter** — two reads 20 s apart
returned the same figure. Each snapshot carries an `updated` stamp on the
device's uptime clock, and two of those give the line (54 601 ms of clock to
54 607 ms of position, so 1:1), which extrapolates back to the Resume press.
That is a **lower bound**: playback cannot have begun before the press, so the
true stored value is 53 456 ms plus however long session setup took.

**Also confirmed, incidentally:**

- **The detail page gained a Restart button.** Before the kill it showed one
  control; after, it shows **Play and Restart**. The stored point is read back
  on that screen too, not only in the rail.
- **28 Days Later fell off the rail, and that is correct.**
  `CONTINUE_WATCHING_LIMIT = 3` in core (same file, same commit). A fourth
  entry evicts the oldest. Nobody should chase this as a fault.
- **§1.8 reproduces on a second title.** `AudioOut_FD`, **type 1 (DIRECT)**,
  channel count **6**, mask **`0x0000003f`** — positional, PCM 16-bit, 48 kHz.
  The Hunger Games measurement was not a one-off.

**What could not be done, and it is a hole in the procedure rather than in the
client.** §0 said to *query the node for sessions before relaunching*.
`GET /api/v1/playback/sessions` is **account-scoped** — it answers
`{"account":{"max_sessions":32,"sessions":0},"items":[]}` for `tvtest` while
the set plays as `tom`. So the step is unperformable from here unless the set
is signed in as the account whose token we hold, or `tom`'s token is to hand.
**Whoever rewrites that line should say so**, rather than leaving the next
session to discover it mid-test.

**Two things for anyone driving this set over `adb`:**

- **The player chrome auto-hides, and the first keypress after it hides is
  spent revealing it.** Several D-pad presses vanished before that was
  understood. Budget one extra press, or keep the gaps under the hide timeout.
- **`screencap` of the player is black** — the video sits on a surface the
  capture does not see. The chrome overlay *does* capture, so the transport
  row and the trail are readable; the picture is not.

#### The stereo A/B could not be run, and the reason is not a fault

Player options on Half-Blood Prince offered **MODE** Auto/Direct/Remux/Transcode
(Auto selected, "Chosen automatically: this device plays the file as it is"),
**QUALITY** Original/720p/480p/360p, **SUBTITLES** Off/ENG/CHI — and under
**AUDIO**, exactly one entry: **`ENG · AAC · 6ch`**, annotated "Server
processing: copy".

There is no 2.0 track to select, so §0's item 2 cannot be run on this title.
Two things are needed before it can be:

1. **A title that carries a stereo track.** Not yet surveyed; the catalogue can
   be asked without a set.
2. **Somebody in front of the television.** The test asks whether level and
   sync *snap back*, which is a listening judgement. The channel mask and the
   output-thread type can be read over `adb` and were; loudness cannot.

`MODE → Transcode` is the obvious way to force a different audio path without
finding another title, and it was **deliberately not tried**: it starts a
transcode on a cluster that had just come back from an outage, and it changes
what is on screen for whoever is watching. That is Tom's call, not this
session's.

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
