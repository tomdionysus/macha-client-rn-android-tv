# Roadmap — exercises for the contributor

Work this client should do and has deliberately not done, written down so it is
a decision rather than an omission.

Each entry states the problem, what is already known and how it was established,
and — because this is a client for hardware that is rarely in the room — **what
cannot be verified without equipment nobody here has**. An entry that reaches
"needs a receiver" is not blocked on thinking; it is blocked on a receiver, and
saying so is the point of the document.

The house rule from `AGENTS.md` applies throughout: a claim is **measured** or
it is **asserted**, and the two are never filed side by side without a label.

---

## Audio passthrough: capability is a property of the output chain, not the decoder

**Status:** latent, not active. **Not verifiable on either television we have.**

### The problem

This client reads its audio capabilities from `MediaCodecList`
(`modules/macha-player/.../Capabilities.kt`), which answers *"can this device
**decode** it"*. On a television that is the wrong question.

A set wired to an AV receiver or soundbar over HDMI/ARC/eARC frequently does not
decode AC-3 or E-AC-3 at all. It passes the compressed bitstream out and the
receiver decodes it. Such a set lists **no** AC-3 decoder and plays AC-3
perfectly in 5.1.

On that hardware this client reads an empty decoder list, stops claiming `ac3`,
and the node begins transcoding audio that previously passed through untouched.
The viewer loses multichannel to an AAC downmix and the cluster pays for a
transform nobody needed.

**It is the mirror of the fault the phone client fixed, and quieter.** That one
over-claimed and produced *silence* — a fault somebody reports. This one
under-claims and produces *worse sound and more node load*, which nothing in a
smoke test looks for because nothing is visibly broken.

### Why it is not biting us

Measured 2026-09-21: both TCL sets have real AC-3 and E-AC-3 decoders in
`MediaCodecList`, so the claim is correct on both today. **Neither set can
exercise the passthrough path at all**, because neither needs it.

### What the platform offers

Asserted from API knowledge rather than read in our resolved dependency. **The
version is settled: media3 `1.9.0`** — see the delivery-claims entry below for
how that was established and why our own `build.gradle` says otherwise. So
`AudioCapabilities` and `isPassthroughPlaybackSupported` are in what this client
links, and the first task of this exercise is already done.

| | |
| --- | --- |
| `AudioTrack.isDirectPlaybackSupported(AudioFormat, AudioAttributes)` | API 29+. The canonical "can this encoding go out untouched". |
| `AudioDeviceInfo.getEncodings()` | What the HDMI sink accepts. |
| `AudioManager.ACTION_HDMI_AUDIO_PLUG` | Carries `EXTRA_ENCODINGS` and `EXTRA_MAX_CHANNEL_COUNT` from EDID. The runtime signal. |
| `Settings.Global.ENCODED_SURROUND_OUTPUT` | AUTO / NEVER / ALWAYS / MANUAL, plus `..._ENABLED_FORMATS`. |
| `androidx.media3.exoplayer.audio.AudioCapabilities` | Combines the above. `AudioCapabilitiesReceiver` re-reads them when the route changes. |

Measured on `10.34.1.115`, 2026-09-21: `encoded_surround_output` is **unset**,
so the platform default applies, and an HDMI output device is present.

### The shape a solution takes

1. **Claim = a decoder exists ∪ passthrough is supported.** Never the decoder
   list alone.
2. **Respect `ENCODED_SURROUND_OUTPUT`.** It is the viewer's stated intent and
   it outranks any probe. A viewer who set NEVER wants stereo, and claiming
   AC-3 over the top of that is wrong even when the receiver would accept it.
3. **Offer an override in this client's own Settings.** Every system that ships
   this has needed one, for one reason: **EDID lies.** Receivers under-report,
   HDMI switches and soundbars strip encodings out of the chain, and ARC
   advertises less than eARC on the same box. Detection is the default, not the
   authority.
4. **Recompute when the route changes**, via `AudioCapabilitiesReceiver` or the
   HDMI plug broadcast.

### The part that is a design decision rather than a probe

Point 4 changes something structural. **This client's capabilities are read
once.** Passthrough makes them *mutable at runtime* — somebody plugging in a
soundbar mid-film changes the true answer. That forces a choice nobody has
made:

- re-declare to core and re-resolve the generation when the chain changes, or
- accept a stale claim until the next play.

Neither is obviously right, and it is core's business as much as this client's,
so it wants Tom and the core session rather than a unilateral fix here.

### How other systems solve it, for whoever picks this up

Asserted — this is ecosystem knowledge, not something measured in those trees.

**Plex, Jellyfin and Emby do not infer it.** The client sends a declared device
profile and the server obeys; capability detection is the client's problem, and
each exposes explicit surround/passthrough settings to the viewer. **Kodi** has
a whole audio-output page with per-codec checkboxes — AC3-capable receiver,
E-AC3, DTS-HD, TrueHD — probing where it can and always allowing an override.

That architecture is ours: core resolves from what this client declares. So the
whole of this exercise lives in **what we declare**, and none of it needs core
to change — except the mutability question above.

### What cannot be done without hardware

Points 1 and 2 are testable on the sets we have. **Points 3 and 4 are not.**
Both TCLs decode AC-3 internally, so no measurement here can distinguish a
working passthrough claim from a decoder claim that happens to agree. This
needs a set with a receiver or soundbar on the HDMI chain, and until one exists
any implementation is asserted rather than measured — which is precisely the
state this repository refuses to file next to a measurement.

---

## The six delivery claims are asserted, and nothing would catch them going stale

**Status:** live. **Testable here, no special hardware needed.**

### What is asserted

`MachaPlayerModule.kt`'s `capabilities()` reads decoders from the device but
states six things outright:

    containers        18 fixed strings: mp4 m4v mov mkv matroska webm avi ts
                      mpegts ps mp3 m4a aac wav flac ogg oga opus
    hlsFmp4           true, unconditional
    hlsTs             true, unconditional
    hlsVideoCodecs    ["h264", "hevc"]
    hlsAudioCodecs    ["aac"]
    dash              true, unconditional

Two carry real reasoning. `MediaCodecList` says nothing about containers —
ExoPlayer's extractors are fixed at build time — and advertising `mp3` as a
codec but not as a container once made a node transcode every MP3 in the
library. The HLS lists are stated rather than left unset so they cannot fall
back to the direct-play lists and silently claim E-AC-3 in fMP4.

### Why they are still a hazard

Every one is a claim about **what the linked media3 does**, and nothing checks
them against it. They were true of some version at some time. A media3 bump that
narrows an extractor, or an `expo-video` upgrade that changes the HLS path,
changes the truth without changing this file — and the failure surfaces as a
node transcoding something it need not, or a viewer getting no audio, on a
television.

**The web client does not have this class of bug**, because it probes:
`canPlayType` for the element and `MediaSource.isTypeSupported` separately for
the delivery path, so its HLS audio list can legitimately differ from its
direct-play one. Nothing is hardcoded there but the list of candidates to ask
about. On 2026-09-21 that paid for itself:
`isTypeSupported('audio/mp4; codecs="ac-3"')` answered `false` in one line and
settled a question that had produced four invented mechanisms.

### Why we cannot simply copy that

`isTypeSupported` is a browser API. On Android there is **no runtime analogue
for container or delivery support** — these are properties of the linked
library, not of the device, and no amount of probing the hardware will reveal
them.

### So the exercise is falsifiability, not probing

Pin them to a known media3 and assert them in a test, so a version bump that
changes ExoPlayer's behaviour fails here rather than on a television:

1. **The version is now known: `1.9.0`**, read from
   `android/app/build/outputs/sdk-dependencies/release/sdkDependencies.txt`.
   Both this repo's own module and `expo-video` declare media3, at different
   versions, and Gradle resolves upward — so the effective version is the
   highest any module asks for, not what our own `build.gradle` says.
2. **Assert the claims against `DefaultExtractorsFactory` and the HLS
   extractor factory** of that version, in a test that names the version it was
   calibrated against, in the manner of `src/player/timingBudgets.ts`.
3. **`dash: true` is the weakest and worth settling first** — it is
   unconditional and nobody has confirmed the DASH module is reachable through
   `expo-video`'s player at all.

---

## When this client grows its first timestamp

**Status:** not yet applicable — **this client renders no wall-clock time at
all**, which is why the entry exists before the code does.

Audited 2026-09-21: `Date.now()` appears three times and all three are
elapsed-time sources — the seek-acceleration ladder, the stall watchdog, the
readiness wait. There is no `toLocale*`, no `Intl.DateTimeFormat`, no rendering
of any `*_unix_ms`, and nothing in the Kotlin formats a date. The failure trail
stamps `elapsedMs`, monotonic within a session. **A client that only ever emits
durations is zone-free by construction rather than by discipline**, and that is
the property to keep.

### The rule, Tom's, 2026-09-21

> *"Times should be presented in local, but backend we always deal in UTC.
> Timezones are a presentation problem."*

- **On screen** — the reader's own zone, **labelled with it**:
  `21 Sep 2026, 18:51:52 GMT+3`. Local answers "when, for me"; the label is what
  stops it being read as the node's own time.
- **Everywhere else** — epoch ms in the data, and Zulu when a string must
  exist: logs, anything handed to another machine, anything read beside a node
  journal.
- **Never-stated renders `—`**, not 1970, which is its own misreading.
- **Content keeps the viewer's zone** deliberately. An air date is about their
  evening, not about correlating two journals.

### The wrinkle that is this client's alone

A set-top box takes its zone from whatever the installer set, and both
televisions live in racks with nobody in front of them. Elsewhere a wrong zone
is an hour out and a person notices; here an unset or misconfigured device
clock can be **wrong by hours with no viewer to see it**. So the zone label on
screen is doing more work on this platform than on any other, and any timestamp
must come from the API's epoch ms rather than the device clock.

The incident behind the rule is the web client's: a timeline sent to the server
session stamped EEST while es-1 ran CEST, every time an hour out, recognised
only from the sequence. Plausible, silent, survives review.
