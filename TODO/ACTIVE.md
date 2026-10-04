# Active

Open work on the Macha Android TV client. What has landed is in
[`COMPLETED.md`](COMPLETED.md), **including the mistakes** — read those before
re-deriving anything. Reasoning lives in [`../docs/HISTORY.md`](../docs/HISTORY.md);
conventions and traps live in [`../AGENTS.md`](../AGENTS.md).

---

## 0. Handover, 2026-10-04 — read this first after a clear

**What landed, and what went wrong, is in `COMPLETED.md`'s top section**
(2026-10-01 to 2026-10-04), and the records behind every numbered item below
are in its second. This file is only where things stand and what is open.

### Work only on `experiment/object-ledger`

**Not `main`, not `develop`**, until the server's experiment ends: the
server's operator instruction, relayed by the Macha Server session, and Tom
confirmed it for this repo on 2026-10-02 by tagging 0.9.1 here rather than on
`main`. The branch was cut from `develop` at `3f7bad0` and is pushed
(`origin/experiment/object-ledger`). API changes on the server's line are
announced to core and every client before they ship; check each against
everything this client depends on. Pushing is Tom's word.

### Where things stand

- **The branch is ahead of `origin`** by the availability work, the install
  record and the documentation and comment rationalisation; `git status -sb`
  gives the count. Typecheck, 390 tests and the export pass.
- **Tag `0.9.1`** (annotated, pushed) is on `60d4a3a`, on this branch, **not
  on `main`**; versionCode 901. Its tree uses `file:../macha-ts`, so it builds
  only beside a compatible core checkout. `main` is still `263e308`, tag
  `0.9.0`, core `^0.21.0` from the registry (latest published core is still
  0.21.0). Everything since 0.9.1 also reads 0.9.1 / 901: **only the md5 tells
  builds apart**; record it at every install.
- **Core** is linked: `node_modules/@machafoundation/core` is a symlink to
  `../macha-ts`, on its `experiment/object-ledger` at `22e0620` (pushed). This
  client needs at least `1251cb2` (`availableToPlay`, `currentAvailability`,
  `withoutAvailability`). Check `dist` carries a symbol before trusting a
  build (AGENTS.md).
- **Servers:** 0.82.0 (the files resource, per-file availability) is live on
  both nodes. Announced, not deployed when written: **0.83.0** (availability on
  every catalogue item, a fourth code `unavailable`) and **0.84.0**
  (availability answered from the last survey across restarts and unreachable
  peers, so `unknown` becomes rare and a value can be stale). Everything from
  the server since 0.74.0 was checked against this client: nothing breaks. The
  `subsystems[].state` `starting` change does not reach this client.
- gbni-1 **is** macnessa (`10.44.1.50`).

### The set

- **`10.35.1.133`**, TCL Android 12, a 3840x2160 panel, 960x540 dp.
  **Installed 2026-10-04 00:03:** `5c2d2cb` (0.9.1, versionCode 901) on linked
  core `1251cb2`, md5 `ecc962a139ff34102e7451a1e1b7d72c`, read back off the
  set. Installed over Macha playing, on Tom's word; not launched after. It does
  **not** carry `8e044b8` (the Continue Watching remove-button focus).
  Diagnostics **On**, screen timeout `600000` as last recorded. It drops off
  the network for hours at a time; `adb mdns services` and a ping say whether
  it is back.
- Signed in as `tvtest`. Endpoints `http://10.35.1.50:7438` (fi-1, "Corvus
  FI-1") and `http://10.44.1.50:7438` (gbni-1, "Corvus GBNI-1"); remembered
  `https://macnessa.macha.network`.
- **Tom and others watch this set.** Check `dumpsys media_session` (with
  `updated` against `/proc/uptime`) before any key **and between key bursts**.
  Tom's "install now" over what was playing was for that install only.
  **Tom's "Don't test" (2026-09-29) stands**: install when asked, drive the set
  only when asked.
- **`10.34.1.115`** has not answered since before 2026-09-29. The other device
  on adb, `10.35.1.164` over TLS, is a **Blackview A85 phone**: the phone
  client's, and this APK requires leanback so it will not install there.
- **Launch with `am start -n foundation.macha.client.tv/.MainActivity`.**
  **Back exits only from Home**; every other screen goes Home.

### Open, in order

1. **Push** the commits ahead of `origin`, when Tom says.
2. **See the availability markers on the set**, once server 0.83.0 is
   deployed and Tom says to drive it: a yellow outline triangle (partial), a
   red outline crossed circle on a greyed card that takes no focus
   (unavailable), a yellow question mark (unknown), at the artwork's top left;
   before the title on show and season headings and in the player. Continue
   Watching's markers come from `currentAvailability` and arrive a moment
   after the row. An unavailable Continue Watching card takes focus (for its
   ×) and OK does nothing; that needs a build with `8e044b8` installed first.
   The colours (#ff4d4f, #ffc53d, #08080ac9 disc) are this client's; core has
   passed them to the web client, and says it will report if the web picks
   others.
3. **See on the set, when Tom says to:** the alphabet strip reached by Right
   from the bottom row, and a letter bringing its titles to the top
   (`54c64ce`); the failover status line naming no node (`32d4a7f`); the
   too-slow-to-play screen with Try again and Choose another quality; the
   stepped-down notice; ", which the server can't do fast enough" (needs a
   node's `transcode_rates`, empty until a transcode of a minute or more
   finishes on it); the two error sentences ported from the web client
   (no node answered; the server cannot be reached).
4. **The next failover: capture `playback.coordinator source-failover-start`**,
   whose `error` names what began it. The first failover seen on this client
   (2026-09-28) has no recorded cause: it scrolled off the eight-line
   Diagnostics overlay and logcat had rolled. Core's answer to a source neither
   node serves at real speed is `too_slow_to_play` (built here, unseen).
5. **OK on a Continue Watching card does two different things.** On
   2026-09-28 it opened *The Martian*'s detail page once and started playback
   once, both with focus confirmed on the card. Seen, unexplained.
6. **Not yet seen on the set:** next episode on end across a season (needs a
   show with two seasons), and the `resource_limit` sentence on a switch back
   into transcode (needs a second viewer holding the slot).
7. **Unexplained:** Tom's 4K press on *The Martian* that returned to the
   detail page with nothing said (2026-09-27 ~13:10), never reproduced.
8. **`usePlayerVolume` still applies the stored volume** on every player
   mount, though the player has had no volume control since 2026-09-19. A
   level stored before then is applied with no way to change it. Removing the
   call changes what the set plays at: Tom's call, then confirm on the set.
9. **Five native packages nothing in `src` imports:** `expo-keep-awake`,
   `expo-splash-screen`, `expo-system-ui`, `react-native-safe-area-context`,
   `react-native-screens`. Expo or React Native may need them natively;
   removing any changes the APK, so it needs a build and an install to prove.
10. **§1.12:** Continue Watching is not per-account (core's storage).
11. **§1.8** the stereo A/B (needs a listener), **§1.9** catalogue `5xx`
    charging a node (core's), **§1.1** the top bar's ends.
12. **Tom's calls, asked and unanswered:**
    - whether the Status screen shows each node's inter-node traffic, as the
      web client does;
    - whether the web client should be told about the two TV-only focus rules
      (focus stays on the top bar; the alphabet strip as a side rail);
    - Music (§4.6);
    - whether series/season "links" on a card mean anything beyond Back;
    - whether "This can't be played on this television." should become the
      web client's "This item cannot be played here." (`NOT_PLAYABLE_CODE`);
    - from 0.84.0, an `unavailable` can be the last survey's answer rather
      than the present: whether a card should show how old it is
      (`surveyed_unix_ms`), or OK may try it anyway. Both change the ruling;
      wait until stale greys are seen.
13. The rest of parity, §4.

**Known limits, not open work:** the native-adapter trial is shelved (Tom,
2026-09-24): a transcode reap recovers only after the buffer drains, and a
direct-play reap never reaches the player (P-1 below).

### Tom's standing rulings that shape the UI

- **Every client matches the web client, within the device** ("Copy the web
  style, formatted for the device screen"), and **every client shows the same
  sentence** for the same facts. Media info: one line per file under the
  title, core's `fileSummaries` parts joined with " · ", largest file first.
- **Technical facts and their labels are core's; layout and sentences are
  ours.** Viewer sentences live in `src/text/viewerText.ts`. The web client
  words new sentences first and this client ports them word for word,
  reading the web's tree rather than its summary.
- **Availability, the same in every client and every context** (2026-10-03):
  partial a yellow outline warning triangle, unavailable a red outline
  crossed circle with the title greyed and not selectable (on TV: no focus, OK
  never plays), unknown a yellow question mark, complete nothing; icons only,
  no tooltips on TV. Only unavailable may not be played. **Exception**
  (2026-10-04): an unavailable Continue Watching card takes focus so its ×
  can be reached; OK on it still does nothing. The play rule is core's
  `availableToPlay`; this client's `cardInteraction` decides focus.
- **Comments carry no history** (2026-10-02): every code comment earns its
  place; no dates, hashes, attributions or incident stories in code comments
  or test names. History goes here, in `COMPLETED.md` and in commit messages.
- **Quality names are 4K, 2K, 1080p, 720p** (core's `qualityLabel`), and
  the player has **one Quality row**: the versions, then smaller caps.
- **Why Play chooses a file is one sentence from every fact**
  (`qualityChoiceText`), on the detail page and in the player's options.
- **A chosen quality no node converts fast enough stops** with "Macha can't
  play … because …" and a Try again option.
- **Nodes are named by the server's operator name**, else the host, never the
  full URL.
- **Episodes are marked `S04E08` everywhere**, "Episode 8" with no season.
- **Resume as you left it:** Continue Watching keeps item, file, mode, cap,
  audio and subtitles; Restart is a fresh automatic start.
- **An episode's end plays the next, across seasons**, unless the next is
  unavailable.
- **Back returns to the card that was opened**, Home included; **only Back
  from Home exits**, with no confirmation, after storage is flushed.
- **Focus stays on the top-bar button that chose a screen**; **a letter on
  the strip brings its titles to the top**, and leads only to titles that can
  take focus.
- **The synopsis sits below the poster** on the TV.
- **Releases:** the version number and every push are Tom's word. "Deploy"
  means build this branch and install it on `.133`.

### Waiting on others

- **Tom:** the push (item 1), when to drive the set, items 8 and 12.
- **Core:** nothing outstanding. **The web client:** whether it keeps this
  client's marker colours (core will say). **The server:** deploying 0.83.0
  and 0.84.0.

### Driving the set over adb

- **The player chrome hides after 4 s; the next key only reveals it**, with
  focus on Pause. Send a player sequence in **one** `adb shell` call:
  `DPAD_LEFT` x5, `DPAD_RIGHT` x4 for "...", x5 for Stop, then `DPAD_CENTER`.
- **The player screencaps black** (a hardware video layer). The chrome does
  capture: reveal it, then read position, mode, codecs and node. The trail
  has failed to repaint in captures taken with the chrome hidden.
- **On Home, Up from a Continue Watching card reaches its × first**, and the
  first focus after a cold start is not fixed. Screenshot before every OK.
- **Back from Home leaves the app**, and the launcher (`com.tcl.tv`) is
  `FLAG_SECURE`, so `screencap` returns an empty file. Assert the foreground
  package before every key.
- **`am force-stop` mid-playback leaves the session open on the node.** A
  leaked transcode holds the node's one transcode slot, and a stale session
  has made the next play of its title 503 there (measured, n=1). Stop
  playback first, or delete the session on the node.
- **`dumpsys media_session` `state=` can be stale**; compare `updated` with
  `/proc/uptime`.
- **`input text` drops characters**: one per call. It writes to whatever
  holds focus, while `KEYCODE_DEL` acts only on a field in edit mode:
  `DPAD_CENTER` on the field first, and capture after every field.
- **On the login screen, `DPAD_DOWN` from the password lands on "Server
  settings"**; `DPAD_LEFT` then reaches Sign in.
- **Never conclude from a screen that is also the default**: the 403 /
  `media_viewer` state is what the app shows before anyone signs in.
- **Keys faster than about 2 s during a row scroll** hit stale focus rects.
- **The screensaver (`dreamx`) takes the foreground while idle**: wake,
  foreground the app and act in one pass. On `.115`, `com.tcl.esticker` (a
  demo overlay) did the same and ended the session:
  `pm disable-user --user 0 com.tcl.esticker`.
- **`uiautomator dump` prunes what is off screen** and never shows focus (a
  JS registry). Absence from a dump is not evidence.
- **Capture a burst on the set:** `screencap -p /sdcard/mb/fNN.png` in one
  `adb shell` loop, then `adb pull /sdcard/mb/.`. Never `adb pull /sdcard/`.
- **The bundle is Hermes bytecode**: it keeps property names and strings,
  not local names, and stores a string with any non-ASCII character as
  UTF-16. Prove a change with `./scripts/verify-on-device.sh bundle
  <literal>...`.
- **In this shell:** `grep` silently skips files it thinks are binary (use
  `grep -a`); zsh reads `===` and `$VAR:s…` as syntax and does not word-split
  (`export ANDROID_SERIAL=10.35.1.133:5555`; quote `--include='*.tsx'`); a
  foreground `sleep` is refused (use `adb shell sleep N`).

### Getting a build onto the set

```sh
cd android && rm -f app/build/generated/assets/react/release/index.android.bundle
EXPO_TV=1 ./gradlew :app:assembleRelease -PreactNativeArchitectures=armeabi-v7a
TV=10.35.1.133:5555 ./scripts/verify-on-device.sh install
```

- **Delete the bundle first.** Gradle cannot see into the symlinked core, so
  an "up to date" bundle ships stale core. Deleting costs 1m 34s;
  `--rerun-tasks` gives the same guarantee in 3m 01s (measured).
- **After a version bump**, run `EXPO_TV=1 npx expo prebuild --platform
  android --clean`, or `version:check` (run by `npm test`) fails.
- **The install stage asserts the set runs the APK just built.** If it
  refuses, do not debug against that install.
- **Record with every measurement:** the APK's md5, core's SHA, and a hash
  taken inside core's `dist`.

### Reaching the devices

All work is driven against `10.35.1.133` (`verify-on-device.sh`'s default).
`10.34.1.115` is updated when it happens to be up; the app is not run on it.

| | `10.35.1.133` | `10.34.1.115` |
| --- | --- | --- |
| Model | TCL `G10_4K_GB_NF_32BIT` | TCL 55B6B |
| Android | **12** (SDK 31) | 11 |
| ABI | `armeabi-v7a,armeabi` | `armeabi-v7a,armeabi` |
| Surface | 3840×2160 panel, **1920×1080 override at density 320 → 960×540 dp** | unmeasured |
| Site | `10.35.1.x`, node `10.35.1.50` | `10.34.1.x`, node `10.34.1.50` |

Both are `leanback_only`, `type.television`, no touchscreen. Addresses are
DHCP and have moved; `getprop ro.product.manufacturer` must say **TCL**.

- **Network adb is switched on at the set** (Developer options), which then
  asks on screen to authorise this host's key
  (`d9:52:24:c1:ae:93:41:08:1b:18:98:85:ce:e9:36:c9`). Until then it answers
  ping and refuses `5555`.
- **A screen-off set looks powered off**: no adb, no ping. A paused film
  does not keep the screen on. If you raise `screen_off_timeout` for a
  sitting (`settings put system screen_off_timeout 1800000`), put it back.
- **`adb mdns services` finds the set when a connect times out.**
  Wake-on-LAN to `b0:6b:11:ca:17:2d` is unproven. A failed adb call says
  nothing about the set: the laptop's link is the unreliable half.

### Two standing rules

- **Take every piece of logic from `@machafoundation/core`, and no words.**
  Viewer text is presentation and lives in `src/text/viewerText.ts`.
- **Claims about other codebases get read, not remembered.** Open the peer
  before writing "only", "never" or "nowhere else".

## P-1. The regenerate path froze the viewer once: not reproduced, not closed

- **Unresolved:** one freeze on "Preparing new stream" after a transcode
  reap. What failed to settle after the close received its `404` is
  unidentified.
- **Known:** core bounds the close by the create budget, 19 s on fi-1
  (asserted, core `0e787f8`), so a freeze of up to 19 s is still possible.
  Every reap since recovered on the same node without the bound firing
  (measured). Detection waits for the buffer to drain, 66 s (measured):
  `expo-video` reports no per-segment failure. A direct-play reap never
  reaches the player (asserted, the server session from `playback.cpp`).
- **Next (the set, on Tom's word):** on any reap with Diagnostics On, read
  the trail: `source-reaped`, `session-reaped-regenerating`,
  `failed-session-closed` or `failed-session-close-timeout` (the bound
  fired), `generation-regenerate`, `session-regenerated`, `source-budgets`.
  A hang names its last line; send it to core.
- **Orphaned sessions:** `state/liveSessions.ts` records live session ids
  and `App.tsx` logs `sessions-orphaned-by-previous-run` at start; nothing
  closes them (read from source). Core's `stop()` can close by id alone
  (asserted, core `61e4d74`). Next: wire the reconcile, on core's word.
- **Settled, read 2026-10-04:** the server's transcode-entitlement release
  (`ec5a65b`) is in server tag 0.48.1, so it is deployed; core's standby
  window reads the node's `pipeline_idle_ms` (`macha-ts`
  `src/playback/PlaybackCoordinator.ts`); a session with no endpoint
  provenance is worded, never shown raw ("This stream is no longer
  available. Start it again.", the web client's sentence).
- **Status unclear, others':** whether core settles the close at once on a
  `404`; the server's AC-3-copy remux stall (measured here: AAC 5.1 remuxes,
  AC-3 5.1 fails at 15 s with a 503).

## 1. On the television

Every entry needs the set, and Tom's word to drive it.

- **1.0d** A `400` refusal of `video: copy` on a recovery has not been seen;
  if one appears, capture body, status and `code` for core.
- **1.0e** A promoted standby on a transcode is sought to the live position,
  which may be ahead of what the node has encoded (asserted, unobserved).
  Next: a promotion on a transcode title.
- **1.0g / 1.0h** Asserted from media3 1.9.0 bytecode and `expo-video`'s
  source, untested against a node: no response code stops media3's retry;
  `PlaybackError` carries only `message`; HTTP deadlines are OkHttp's 10 s.
  Closing that wrapper gap is what would shorten P-1's detection.
- **1.1** Whether the top bar traps horizontal movement at its ends is
  unverified since it was rebuilt. Next: Right from the cog, Left from Home.
- **1.2** The decoder instantiated for 5.1 was never captured (six channels
  and mask `0x0000003F` are measured). Next: catch
  `OMX.realtek.audio.dolby.eac3.decoder` in use.
- **1.3** Whether the panel runs two video decoders at once is unknown:
  `dumpsys media.player` gives both `6` and `1` for
  `max-concurrent-instances` (measured). Next: allocate a second decoder in
  the app and observe, which is §2.1's experiment.
- **1.4** "No custom headers" is verified from source only. Next:
  `verify-on-device.sh headers` on a real fragment request; tell core.
- **1.5** `expo-video` halves `player.volume` on a transient duck (asserted,
  `AudioFocusManager.kt`). Whether ducks compound or a restore is missed is
  unmeasured.
- **1.6** `checkPlatformSurface`'s findings on Settings, including the three
  `titleIndex` probes, have never been read on the set.
- **1.7** What a dead `expo-video` player reports for `currentTime` and
  `bufferedPosition` is unmeasured. Not blocking; core's staleness guard
  wants the answer.
- **1.8** Quiet and slightly out of sync on the set's own speakers.
  Measured: six channels on a DIRECT output thread, no effect chains, about
  197 ms write latency, no underruns. Asserted: the HAL's fold-down, which
  skips the set's speaker processing, is the cause. The fix is ours, not
  started: on the set's speakers do not advertise multichannel
  (`Capabilities.kt` reading `AudioManager`, with an `AudioDeviceCallback`).
  App gain cannot exceed unity. Next: Tom's call between the gate now and a
  stereo-track A/B first (needs a listener).
- **1.9** A `5xx` from one API family charges every node the walk visited:
  `route()`, `find()` and `mutation()` record failures without asking
  `failureBlamesEndpoint` (asserted; reported to core). At core `22e0620`
  `route()` now asks it; `mutation()`, `find()` and the advisory walk still
  record on a retryable failure alone (`macha-ts`
  `src/cluster/endpointRouting.ts`). Home then said every endpoint had failed
  while only the catalogue was down (measured). What the cooldown did to the
  candidate list is unmeasured; reproducing needs the server condition.
- **1.12** Continue Watching is not per-account: core's `signOut` clears
  only the session key (measured; the fix is core's storage). Unseen on the
  set, status unclear: a resumed entry keeping its position (`a1e01c0`, core
  `d93c9d8`), and the Settings 401, sign-out dialog and sign-in wall fixes.

## 2. Player work

- **2.0** The player is `expo-video`; capability detection stays native.
  `ExoPlayerAdapter` and `PlayerEngine.kt` stay in the tree, unused and
  undisturbed. Standing costs: no `DataSource` injection point, and no HTTP
  status from the player (core's readiness walk classifies failures).
- **2.1** **Tier 3, the no-shutter handover, is not built**, and it is why
  this repo exists. Until it is, a promotion shows a brief black frame. The
  change: give the standby an off-screen or alpha-0 `VideoView` so it
  renders a first frame. Gated on §1.3. Do not promote the moment the
  standby is ready; measure the margin here. The retired player is released
  by presentation (`releaseRetiredPlayer()`), not inside the swap: look
  there first if a promotion leaves a dead surface.
- **2.2** No standby promotion has been recorded here. Next: on one, confirm
  the picture and one additional `resolver.stop`.
- **2.2b** Core's watchdog re-arm after a pause and its re-base after a
  backward seek are unexercised here (asserted from core). Next: pause past
  the node's `session_idle`, resume, and read whether the node is charged.
- **2.4** Nothing calls `runtime.prepare()`, so every play pays capability
  detection inline (read from source).
- **2.5** `PlaybackQueueStore` is constructed and read by nothing; core's
  `PlaylistStore` is not constructed. Both wait on Music (§4.6).
- **2.6** The park (a fatal error while paused, met on resume) is
  unobserved; the re-attach is expected to blank the held frame until Tier
  3. `secureStorage` is not supplied to core, so the token sits in
  `AsyncStorage`; `expo-secure-store` would make it Keystore-backed.
- **2.7** Unmeasured: on a remux title, the readout against the picture and
  `seekMs + seekOffsetMs === seekRequestedMs`; the forward buffer reached on
  a high-bitrate title (60 s asked); two players each holding a minute.
- **2.9** Unchecked: what core does with the position after a representation
  change through `runtime.update`. Status unclear.
- **2.10** **A refusal is read by its code, never a status or an axis**
  (`failureCopy.ts` takes core's `isAccountSessionLimit`). The account-cap
  sentence is built and unseen.
- **2.11** **"Macha is working on it" is not started.** Tom's ruling: the
  splash logo, small, top right over the video, while a recovery runs that
  would have ended playback in any other player (failover, regenerate,
  standby promotion, the park, a `segment_not_ready` hold); never for
  start, seek, rebuffer or a viewer's own change, which are the spinner's.
  It renders outside the chrome's gate, with a Settings switch, default on.
  The dependency-free part goes to core; the web and phone clients port it
  once it is proved here. Open: what core guarantees about `notice`; the
  switch's name; whether off also silences the notice text.

## 3. Decisions for Tom

- **3.1** `addDirectSourceAlternative`: a local HTTP proxy in the app, or
  wait for the native engine? The web's rests on a Service Worker. Without
  it direct play gets a warm standby, not byte-level failover.
- **3.2** The GitHub repository is public (measured 2026-10-04: the API
  answers without credentials). Nothing to decide unless that is unwanted.
- **3.6** Decided, not built: the client ships with no endpoints. `app.json`
  still carries one, so clearing hands it back. The work: ship `[]`, an
  `unconfigured` access state and screen, and a separate pre-fill for
  development. Waiting on the web client's answers about cold start,
  discovery and clearing (status unclear).

## 4. Parity with `macha-client`

Logic is core's; what is missing is presentation. §2.11 runs the other way.

- **4.1 Screens.** Ported: Home and Continue Watching, the Movies and Series
  libraries, detail, series (seasons folded in), player, Settings (endpoint
  edits adopted on restart), login, search, and an offline gate. Partial:
  Music, albums grid only (§4.6); Status, one reading with no actions and no
  polling. Not ported: `/connection`, the endpoint gate (§3.6). Not doing
  (Tom): `/manage`, `/manage/files`, `/items/:id/edit`, `/ingest`,
  `/sponsor`.
- **4.2 Player chrome.** Built: restart, rewind, play/pause, forward,
  previous/next episode, options, stop, the scrubber with accelerating seek,
  the buffering spinner with start progress, the Diagnostics trail. Missing:
  the mini player and §2.11's logo. Volume and mute are removed (Tom).
- **4.3 Components.** Missing, in D-pad order: `OverflowMenu` and `Modal`
  (Music depends on them), then `MediaPageTitle`'s refresh, `EpisodeRail`,
  `SectionNav`, `MusicNav`, `StatusNav`, `ConnectionForm`,
  `DeviceCapabilities`, `AsyncIconButton`, `AppLogo`. Reuse `TvTextInput`
  for any text field. An `ArtworkRef` with no `url` renders as the letter
  placeholder; it needs a data URI or a cached file.
- **4.4 Hooks.** Missing: the artwork hooks (`useArtworkUrl` and its
  helpers) and `usePollingTask`, so Status does not poll.
- **4.5 Stores.** `ContinueWatchingStore` is used; `PlaybackQueueStore` is
  unread (§2.5); `VolumeStore` is this client's (`src/state/volumeStore.ts`,
  Tom's ruling).
- **4.6 Music.** Home's Music row and an albums grid exist; an album cannot
  be opened. Not started: `/music`, artists, artist, album, tracks,
  playlists. Three blockers, to do first and together: `OverflowMenu` and
  `Modal` as focus scopes (copy `PlayerOptions`); a queue that survives the
  screen; a mini player. **Tom's call** whether a television wants all of
  it, before the first screen.
