# History

The record behind the decisions in this client: what was measured, what it
cost, and which theories did not survive.

Kept separate from the README so that stays short. Its value is mostly negative
— it is the file that stops someone re-running an experiment that already
failed, or re-deriving a number that has already been read off the hardware.

Everything here says how it was established. "Measured" means read off a device
or a node; "asserted" means taken from an implementation or a contract and not
yet confirmed on hardware. The difference has mattered repeatedly.

---

## 2026-09-09 — Founding measurements

### What the WebView host does on this set, and why it does not change the remit

Reported by the web-client session: the WebView APK from
`macha-client/platforms/android` has been deployed to this same TCL 55B6B and
Tom watched media on it — launching, browsing, D-pad and playback all render.
5.1 audio fails: index channel mask, no positional information to fold,
dialogue gone.

**This was briefly allowed to soften the premise of this repo, and that was a
mistake.** The README was rewritten to open "Not because Android TV is
unsupported — it works", which is wrong on its own terms: rendering a UI and
showing a picture is not properly playing media. The WebView cannot reach the
hardware decoders, so the node transcodes what the browser cannot decode and the
surround layout is lost. That insufficiency is the founding purpose of this
client and is not subject to revision by a peer's report that the other client
renders.

Kept here as a caution: peer sessions supply evidence, not remit. Their reports
are input to be verified, and a report about *their* client cannot redefine what
this one is for.

### The decoder gap (measured, TCL 55B6B, Android 11)

`adb shell dumpsys media.player`, filtered to media types with a decoder:

- **Video:** avc, hevc, vp8, vp9, av01, mpeg2, mp4v-es, dolby-vision, 3gpp
- **Audio:** mp4a-latm (AAC), **ac3**, **eac3**, **ac4**, mpeg (MP3), mpeg-L2,
  flac, opus, vorbis, raw, amr-wb, g711

Against Chromium's `canPlayType` in the same set's WebView: `aac, opus, vorbis,
mp3, flac`. The AC-3/E-AC-3 decoders named in the original brief
(`OMX.realtek.audio.dolby.ac3.decoder`, `…eac3.decoder`) are present, confirming
the premise: the browser, not the panel, is the constraint.

### The set is 32-bit only (measured)

`getprop ro.product.cpu.abilist` → `armeabi-v7a,armeabi`. **No arm64.** This was
not in the brief and is easy to miss, since most modern Android targets are
arm64 and some native libraries no longer ship 32-bit at all. Every build here
is pinned with `-PreactNativeArchitectures=armeabi-v7a`, and the resulting APK
is verified to contain `native-code: 'armeabi-v7a'`.

`pm list features` also confirms `android.software.leanback_only` and
`android.hardware.type.television`, with **no touchscreen feature** — the set is
genuinely D-pad only.

### Cluster node facts (measured, 10.44.1.50, server 0.36.9)

`GET /api/v1/playback/status` under an anonymous session, which was deleted
afterwards:

| Field | Value | Consequence |
| --- | --- | --- |
| `pipeline_idle_ms` | 60000 | The number core's `ALTERNATE_RECOVERY_WINDOW_MS` (30 s) is calibrated against. 30 s is half of it — the window is validated, not merely plausible. |
| `max_video_transcodes` | 1 | One transcode slot per node. A session left open really does cost the *next* viewer a 429, which is why `terminateForPageExit()` on `background` is not optional. |
| `idle_pipelines_reclaimed` | 2 | Reclaim is live on this node, not theoretical. |
| `max_sessions` | 8 | |
| `media_engine` | libav 7.1.5 | `ffmpeg_available` and `ffprobe_available` are both **false**. |

Only the home node has been measured. `10.34.1.50`, at the television's own
site, may be configured differently.

### Custom HTTP headers: none (source-verified, wire-unverified)

Asked across all four clients, because Media3 fetches fragments through its own
`HttpDataSource` and that traffic never passes through core, so nobody else can
see it.

- **One header-setting site**, `PlayerEngine.kt:201`
  (`setDefaultRequestProperties`), and it forwards `PlaybackSource.headers`
  verbatim from core. This client originates no header of its own and rewrites
  nothing. **The property is therefore inherited from core on this path, not
  independently held** — if core ever adds a custom header, Media3 will send it
  and this client will neither know nor object.
- **No `X-` or `Macha-` literal** anywhere in `src/`, `modules/`, `plugins/`.
- **Nothing branches on a response header.** Failure classification reads
  `InvalidResponseCodeException.responseCode` — the HTTP *status*, which is the
  deliberate discriminator per `writing-a-player.md`. `Retry-After` appears once,
  in a comment saying it is not used.
- **No HTTP layer outside core's**, and the capability probe is local
  (`MediaCodecList`, `Display.getHdrCapabilities()`) and makes no requests.

Static reads of code that has been compiled but never run. Media3 also sets its
own `User-Agent` and range headers, which are real traffic and neither custom
nor ours. **Capture an actual fragment request when the set is available** to
turn this into a wire-verified claim.

---

## Timing budgets and what each answers to

The rule this project keeps relearning: **state what a budget is calibrated
against, at its definition.** Four separate bugs have been two independently
chosen timeouts colliding.

The one server number everything derives from: a node holds a request for a
fragment it has not produced for **6000 ms** (`streaming.segment_timeout`),
then answers `500 segment_not_ready`. That is the node working correctly. It is
reported to core as `not-ready` — not a failure at all — and retried on the
*same* node, because the next node is producing a different generation and does
not have that fragment either.

| Number | Value | Answers to |
| --- | --- | --- |
| `readTimeoutMs` (`PlayerEngine.kt`) | 15000 | The 6000 ms hold. A held request sends no bytes, so a deadline below it aborts first and reports a working node as a network fault. media3's own default is 8000 — a margin read from a shipped artifact and never confirmed against a running client, so 15000 states the margin rather than inheriting it. |
| Hold retry backoff | 1000 → 8000 | The same hold. Retrying sooner than a second loads a node that already waited six. |
| `MEDIA_STALL_TIMEOUT_MS` (core) | 7000 | The same hold, from core's side. Guarded here too, from the consumer end. |
| `CHROME_HIDE_MS` | 4000 | Nothing on the wire. Long enough to read the stream-status line, short enough not to sit over the picture. |
| `SCRUB_COMMIT_MS` | 400 | The remote's own auto-repeat (~60–100 ms), so a long hold costs one seek however far it travelled. The web client gets this free from key-up, which a TV event stream does not provide. |
| `TICK_MS` | 250 | Presentation only. The coarsest tick at which a scrubber still looks continuous at three metres. |

`src/player/timingBudgets.test.ts` asserts the *relationships*, never the
values, and cross-checks the Kotlin copy by reading it out of the source. A test
pinning `15000` fails whenever someone deliberately retunes it, which teaches
people to update the number and move on; a test pinning "must clear the hold"
fails only when the retune is wrong.

---

## 2026-09-19 — The numbers stop being ours (core `0.14.0`)

Every budget in the table above was chosen against one compiled-in server
default, because that was the only figure a client could see. Server `0.45.0`
and `0.46.0` changed that: a node now states its own `startup_timeout_ms`,
`segment_timeout_ms` and `stream.look_ahead_ms`, core reads them through
`EndpointHealthMonitor` and carries them on `PlaybackSource.budgets`, and a
host that goes on using its own constants is guessing at a number it has been
handed.

**The decision worth recording is which figure wins when they disagree.** A
stated deadline is taken **whole, including when it is shorter** than this
client's own — `firstFragmentTimeoutMs()`. The temptation is to take the larger
of the two, on the reasoning that waiting longer is the safer error; it is not.
Core owns *when to stop* and the host owns *what happens until then*, and of
two deadlines the shorter silently wins while the other layer looks broken —
the same fault this file's timing table already records four times, arrived at
from the opposite direction. Preferring our own number would also keep a viewer
in front of a node core had already decided was worth leaving. The local
constant is now only what a node too old to state one gets, and a node that
cannot say is not a node that needs less time.

**A `404` stopped meaning the node is bad.** Core `0.13.0` gave it a kind of its
own, `not-found`, because a reaped session and a fragment past the end of a
plan answer identically — measured by the core session against one node, same
status and same machine code, differing by one word of English in a body no
fragment loader surfaces. Read as `stream` it was endpoint evidence, so the
node that answered honestly was charged a failure and dropped while the viewer
was sent to one that had never held the session. This client reports the kind
from its readiness walk now, and the obligation that arrives with it — an
adapter reporting `not-found` must not tear its presentation down, because the
buffer is the cover core builds the replacement behind.

**Where the walk does not reach, and what the web client said to do about it.**
The walk runs at `play()`. A session reaped *while the viewer is paused
mid-film* is found by `expo-video`'s own loader, and `PlayerError` is
`{ message: string }` — no status to classify. That reap is not a risk on a
television but a certainty: `SERVER_SESSION_IDLE_MS` is 30 minutes, a paused
client stops asking for fragments within about one buffer, and somebody pausing
a film for half an hour is ordinary.

Tom's instruction on 2026-09-19 was that the experience must be as close as
possible to the web client, so the web session was asked rather than guessed at.
Three things came back and all three are now in `ExpoVideoAdapter`:

- **Ask the node, not the session.** Asking whether the *session* is alive is
  the obvious move and it is wrong: a fragment past the end of a live plan and a
  reaped session both answer `404 not_found`, one word of English apart in a
  body no loader surfaces (measured by them against one node, 2026-09-17). A
  live session therefore does not prove the fragment was servable. The readiness
  walk asks what the loader asked.
- **Latch the verdict rather than parse the message.** Their Direct Play path
  has this problem exactly — a 404 body handed to the element raises a generic
  decode error — and they did not read the text: the layer that sees statuses
  remembers, and the statusless error is interpreted against that memory.
  Nothing in either client classifies from a message string.
- **Classify conservatively.** `unknown` costs a spinner; a wrong `stream` costs
  a healthy node its place in the candidate list. The asymmetry is why the
  server speaks its counter-intuitive dialect on holds in the first place.

**And a pause must not be judged at all.** Their measurement: a paused
generation called dead seven seconds in, a failover that could not succeed, and
a viewer looking at `Playback failed` naming a node they had never been on. The
fix is to park a fatal error raised while nobody is waiting and meet it again on
resume — keyed on viewer *intent*, because between a play request and the
element running nothing is playing while the viewer is very much waiting. Both
clients now do this. This one cannot keep the buffer or the frame across it,
since `expo-video` owns its loader, so a parked source is re-attached and the
viewer sees the held frame blank and come back.

**Provenance, because it decides what a comparison means.** Their 404 policy is
in their source and **not deployed** — the nodes run 0.17.1 and it ships in
0.17.2 — so a live web client today still condemns the node on a 404, and a
difference observed against it is not this platform behaving differently. Their
"no spinner on resume" is a reading of their own code, stated as such when
asked; nobody has watched a parked-then-resumed session on either client. All of
the above is **asserted**. The pause case is the first thing to provoke when the
set is next up.

**Two hazards this client raised came back fixed.** The stall watchdog not
re-arming after a pause, and a backward seek evicting a healthy node by dropping
the buffer below its own high-water mark. Both were reported from here because a
D-pad is the only seek affordance on a television and generates backward seeks
as ordinary viewing; core's fix carries that reasoning in its own comment. Read
out of the shipped `MediaWatchdog.js` rather than taken on report — and still
**unexercised on hardware**, like everything else about failover here.

## Theories that did not survive

### `PlaybackRuntime.attach` takes an `HTMLElement` — **wrong**

Reported as a core defect for native hosts. It was true of the `dist/` in the
working tree and false of core's source: `attach`/`detach` had already been
widened to `PlaybackHost`. The linked package was simply built before the
change.

The general trap is worth keeping: core's `dist:check` catches `dist` **behind**
`src`, and nothing catches `src` ahead of its last build. It caught three
sessions in one day. `npm test` here runs `dist:check` first; that narrows the
window but does not close it.

Landed in core 0.7.0 (`c8b1bb8`) along with `abortError()` replacing twelve
`DOMException` sites — `DOMException` is not on `globalThis` in React Native, so
the old `signal.reason ?? new DOMException(...)` idiom raised `ReferenceError`
there and almost never on the web.

### Warm standbys die by aging out — **does not generalise**

The phone client reported a standby that "promoted in 3 ms and was dead",
explained as the node reclaiming its pipeline after ~60 s idle, and filed it
with core as a defect in `prepareAlternate`.

The arithmetic does not support it. `ALTERNATE_RECOVERY_WINDOW_MS = 30_000`
(`PlaybackCoordinator.ts:134`, armed at 1284) *closes* an unused standby, and
the measured reclaim is 60000 ms — a 2× margin, so a coordinator-managed standby
cannot age into a reclaimed pipeline. More simply still: a standby promoted
after three milliseconds cannot have aged into anything at all.

The report has been withdrawn. **The cause of that dead standby is unknown.**
The most economical explanation is that the phone client bypasses the
coordinator and so never gets the 30 s expiry, and this is supported from the
other side: `macha-client` goes *through* the coordinator, implements
`preflightSource` and `addDirectSourceAlternative`, and promotes successfully on
the Samsung set. Two of the three coordinator-based clients therefore have no
such failure, and the one client that bypasses it does. Still short of a test —
this client can supply the third data point once it runs.

### A cost nobody had named

Falling out of the same exchange: with `max_video_transcodes: 1`, a standby
prepared against a transcode session is not merely idle and cheap — it holds
that node's **only** transcode slot for up to 30 s. That is a different cost
from the pipeline reclaim the window was chosen against, and an argument for
preparing late rather than eagerly that has nothing to do with reclaim.

It lands on this client first, because wiring the watchdogs is what made standby
preparation reachable here at all.

---

## Given back to core

Four things started here and now live in `@macha/core`, under Tom's rule that
functionality common to the clients belongs in core with every client
refactored onto it. Listed because "we wrote it, then deleted it" is otherwise
invisible in a repo, and because the boundary each one tested is worth keeping.

| Moved | Why it was not ours |
| --- | --- |
| `SERVER_SEGMENT_HOLD_MS` | A server fact every client is calibrated against. It had been living in a core docblock, a core test literal, and a constant here — three copies of one number, none able to see the others. Core's `MEDIA_STALL_TIMEOUT_MS` is now `SERVER_SEGMENT_HOLD_MS + 1_000` rather than a bare `7000`. |
| `playbackFailureKindForStatus` | Protocol, not platform. It was specified in prose and implemented once per player. The native side now reports the raw status and the adapter applies core's rule. |
| `checkPlatformSurface` | Core declares the surface, so core ships its check. Three hosts writing three probes of one contract is the shape this rule prevents. |
| `formatPlaybackTime` | Genuinely common formatting, with precedent — `PlaybackStatus.ts` already formats for display. |

**Refused, and rightly.** D-pad focus scoring was proposed and turned down,
because core's scope is "everything a client does that is *not* presentation"
and geometry deciding what a viewer looks at next is presentation. A boundary
that bends for a good-enough case stops being able to answer the question at
all. The duplication between the two TV clients is real and unresolved — the
open options are a shared `@macha/tv` package or accepting it with tests pinning
the weights on both sides. That is Tom's to decide; the port here has those
tests either way.

**One residue that cannot move.** media3's `LoadErrorHandlingPolicy` decides
whether to retry inside the loader, synchronously, on a thread that cannot call
into JavaScript — so "500 means hold" exists in Kotlin as well as in core.
`timingBudgets.test.ts` reads the status out of `PlayerEngine.kt` and asserts
core agrees it is `not-ready`, that 503/404 are not treated as holds, and that
no kind strings remain in the Kotlin. The knowledge is still duplicated; what
changed is that a drift now fails the build instead of silently retrying the
wrong thing.

**A bug found while handing one over.** The surface probe's `once` check needed
a second dispatch to distinguish `once` from its absence, and that needs `Event`
and `dispatchEvent` — neither of which is in core's declared surface, and
neither guaranteed on Hermes. The first version let their absence throw into the
catch and reported a *required* member as **absent**. A required member wrongly
marked absent is the worst output a probe can produce: it sends someone hunting
a defect that does not exist. It now reports "accepted, not verifiable here",
and a test manufactures the hostile host by deleting `globalThis.Event`.

---

## Build lessons

Each of these cost a failed build or a wrong artifact.

- **A config plugin added after `prebuild` does nothing.** The TV-only manifest
  plugin was written, added to `app.json`, and two APKs shipped with
  `leanback required="false"` — installable on a phone — because `android/` had
  been generated before the plugin existed. Verify the *artifact*
  (`aapt2 dump badging`), not the source manifest.
- **`expo-module-gradle-plugin` applies `com.android.library` and Kotlin
  itself.** Applying them by hand alongside it configures publishing before the
  `release` component exists: *"SoftwareComponent with name 'release' not
  found"*. It also requires `versionName` in `defaultConfig` — omitting it fails
  the whole autolinking plugin, not just the module.
- **A synchronous Expo `Function` has no `runOnQueue`;** only `AsyncFunction`
  does. ExoPlayer is bound to one looper, so the marshalling lives inside
  `PlayerEngine` instead, and `localSeekCoverage()` answers from a cached extent
  because it must return a value on the calling thread.
- **`react-native-tvos` publishes prereleases** (`0.86.2-0`), and a prerelease
  never satisfies a plain semver range, so every library declaring
  `peer react-native >=0.65 <1.0` rejects it. `legacy-peer-deps` is the fork's
  documented install mode, not a workaround for a real incompatibility.

---

## Not done, deliberately

**Seamless failover was briefly and wrongly listed here.** It is **required
work** and now lives in `TODO/ACTIVE.md`.

The error is kept because it is instructive. The phone session measured 7–8 s to
admit a replacement against ~1 s to prime a player and concluded the win was in
the endpoint walk rather than the player. That is sound *for a client that
cannot prime a second player at all* — `expo-video` builds its
`OkHttpDataSource.Factory` internally with no injection point. This client owns
its `ExoPlayer` instances and its data source factory, so adopting their answer
imported a constraint it does not have.

It also concealed a second mistake: **cold recovery and warm standby promotion
are different costs.** A warm standby has already paid the endpoint walk, and
promotion itself was measured at 3 ms — so player priming is nearly all of the
remaining visible cost, not a seventh of it. That is precisely the cost seamless
failover removes, and precisely the case `PlaybackCoordinator` produces.

**Search, music and management screens.** The web client has them; this one
covers Home, Movies, TV Shows, series/season drill-down, movie detail, player
and settings. Search in particular wants an on-screen keyboard design that has
not been done.

---

## Standing unknowns

Carried in the README's *Open questions*, repeated here with what would settle
them:

1. **5.1 downmix.** The measurement, and the criteria are fixed here *before*
   the run so the standard cannot be set after seeing the result.
   `scripts/verify-on-device.sh audio` collects it. Three things must all hold:

   | # | Must be | Read from | If not |
   | --- | --- | --- | --- |
   | 1 | a platform **E-AC-3/AC-3 decoder**, not AAC | `dumpsys media.player` | the node transcoded; nothing was gained and the premise fails here |
   | 2 | **6 channels** reaching AudioTrack | `dumpsys media.audio_flinger` | something downmixed upstream of the set |
   | 3 | a **positional** channel mask, not an index mask | same | the set cannot fold down |

   The mask is the whole point: `0x8000003F` is the *index* mask Chromium hands
   AudioFlinger, and the high bit is the entire difference from a positional
   `0x3F`. **If 1 and 2 hold but 3 shows an index mask, this client is
   direct-playing correctly and the set still cannot fold down** — which is
   core's speaker-layout gap rather than a defect here, and is the answer core
   is waiting for. A clean positional mask points the other way and is worth as
   much. Listening for dialogue is the symptom; this is the evidence.
2. **Standby promotion.** Provoke a stall, let the watchdog degrade, and see
   whether the promoted session plays.
3. **Audio focus.** Asserted from media3's `AudioFocusManager`, which keeps
   ducking as a separate volume multiplier rather than mutating user volume —
   unlike `expo-video`'s own handler, where ducks compound. Not confirmed here.
4. **What Media3 actually puts on the wire.** Capture a fragment request and
   confirm the header set, turning the source-verified claim above into a
   wire-verified one.
