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

Asserted from API knowledge rather than read in our resolved dependency — the
first task is to confirm each against the media3 version this client actually
links, which is **not currently pinned down**: both 1.8.0 and 1.9.0 resolve in
the Gradle cache and nobody has established which wins.

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
