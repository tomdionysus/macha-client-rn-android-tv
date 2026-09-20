# Working on this client

`README.md` orients you; [`docs/HISTORY.md`](docs/HISTORY.md) has the
measurements and the experiments that failed. **Read HISTORY before designing
anything about playback or failover** — most of the expensive mistakes here have
already been made once.

## Non-negotiables

**This is an Android TV app.** Leanback, D-pad, 10-foot UI. No touch handlers,
no gestures, no phone layouts, no phone/tablet branching. If a change would make
sense on a handset, it probably does not belong here.

**Playback goes through `PlaybackCoordinator`.** Never call
`ClusterPlaybackResolver` directly. Failover, stall recovery and standby
promotion live in the coordinator, and a host that bypasses it silently loses
all three — that is the mistake the phone client made, and it is why
coordinator-internal fixes reach three of the four clients and miss one.

**Do not reimplement anything in `@machafoundation/core`.** API families, endpoint routing
and health, playback resolution, Continue Watching, playlists, volume, sorting
and title indexing are all there. If something seems missing, ask the session
that owns `macha-ts` before writing a local version.

**And push shared logic *into* core rather than keeping it.** The rule is
Tom's: if functionality is common across the clients, the dependency-free part
of it belongs in core and every client refactors onto it. So consuming core is
only half the job — the other half is noticing when you are about to write
something that is not TV-specific, and proposing it upstream instead.

The test is *what does this actually depend on*. Rectangle geometry, a protocol
constant, an HTTP status mapping: no dependencies, so they belong in core.
ExoPlayer, `MediaCodecList`, `AppState`, RN views, D-pad input, the manifest:
genuinely platform, so they stay here. When you must keep a local copy because
core does not have it yet, **say so at the declaration** and name what should
replace it — `src/player/timingBudgets.ts` and `PlayerEngine.kt`'s failure
classifier both do this.

**Appearance comes from `src/styles/theme.ts`**, a port of
`macha-client/src/styles/base.css`. A colour or size written inline is one that
will not follow when the web client changes. Cite the CSS rule in a comment, as
the existing components do.

**The focus model is a port, not a design.** `src/hooks/tvFocus.ts` reproduces
the web client's scoring weights so navigation behaves identically. Change a
weight in both places, and update `tvFocus.test.ts`.

**Every timing budget states what it is calibrated against, at its
definition** — and is guarded by a test asserting the *relationship*, not the
value. See `src/player/timingBudgets.ts`. Several bugs in this project have been
two independently chosen timeouts colliding.

**Say whether a claim is measured or asserted.** "Measured" means read off a
device or a node; "asserted" means taken from an implementation or a contract.
Confident theories have died on contact with measurement here more than once,
and the fix that mattered came from a log rather than from reasoning.

**The same distinction applies to claims about the other repositories**, and it
was added because it kept being the thing that went wrong: three mistakes in two
days here were all statements about another tree, made without opening it, and
filed next to verified facts because nothing in a peer's compressed sentence
marks which it is. So a claim about `macha-ts`, `macha-client` or
`macha-client-rn` names the file it was read from, or says that nobody has read
it.

**Prove a test red before trusting it green — and check *why* it is red.** This
repo already lands the fix behind a test seen failing first. The refinement,
from core and the web client the same week: a test can go red for a reason that
has nothing to do with the defect, and then its green proves nothing. Core
shipped one that passed against broken code because the figure it used sat
below the threshold it was testing. Read the failure message, not the colour.

## Things that have already caught someone out

- The target TV is **`armeabi-v7a` only**. Check any new native dependency
  ships 32-bit ARM before adding it.
- **Verify the artifact, not the source.** A config plugin added without
  re-running `expo prebuild` does nothing, and two APKs shipped installable on a
  phone before anyone checked with `aapt2 dump badging`.
- `android/` is generated and gitignored. Manifest changes belong in
  `plugins/withAndroidTvOnly.js`.
- `react-native` is an alias for `react-native-tvos`; its prerelease version
  fails peer ranges, hence `legacy-peer-deps` in `.npmrc`.
- **`@machafoundation/core` comes from the registry.** No `file:` link, no
  `npm link`, and a local `../macha-ts` checkout does not feed this tree — the
  cycle is deliberately what a user sees on install. The stale-`dist` class of
  fault is gone with it. For an unreleased core change, core publishes under a
  dist-tag: `npm install @machafoundation/core@next`.
- Expo's synchronous `Function` has no `runOnQueue`; only `AsyncFunction` does.
  `PlayerEngine` marshals onto ExoPlayer's looper itself.

## Branching and releases

Tom's convention, project-wide across every Macha repository. Relayed by the
phone client 2026-09-13 and confirmed by Tom the same day.

- Work happens on **`develop`**, a long-lived generic branch. Releases live on
  **`main`**, and a release is a **tag on `main`**.
- Tags are **bare semver** — `0.1.0`, never `v0.1.0` — and **annotated**, so
  `git describe` and `--sort=v:refname` behave. One tag per release commit.
- **Do not name branches after versions.** The phone client created
  `release/0.5.0` before knowing what the next version would be, and it ended
  up carrying a patch — which a version-named branch cannot do. This repo made
  the same mistake on its first day and renamed `0.2.0` to `develop`.
- **Put the version bump inside the release commit**, so the tag points at a
  tree that is exactly what ships rather than at one commit before it.

### `versionCode` is the number Android actually compares

It ignores `versionName` entirely, so **two builds sharing a code are the same
build** as far as the package manager is concerned.

Every APK this client produced before 2026-09-13 shipped `versionCode 1`,
because nothing set `android.versionCode` and the Expo default is 1. Five
genuinely different builds went onto the television in one afternoon and the
device could not tell them apart. `install -r` hid it completely; the cost of
it not being hidden would have been a build that failed to replace and hours
spent debugging bytecode that was no longer the source on screen.

Derived, so it is monotonic and reads back as the version it came from:

    major * 10000 + minor * 100 + patch        0.1.0 -> 100, 0.4.1 -> 401

`npm run version:check` enforces it and runs from `pretest`, so a mismatch
fails before anything is built. The derivation is the phone client's, kept
identical so the two Android clients read alike.

## Verifying

```sh
npm run typecheck
npm test
npx expo export --platform android
```

The export is not redundant: typechecking cannot tell you whether core's ESM
resolves through the RN bundler.

Anything about decoders, audio routing, downmix or failover has to be confirmed
on a television, over `adb connect`. **There are two TCL sets and they are not
the same hardware** — `10.35.1.133` (Android 12, and a 960x540 dp viewport,
which is where the 2026-09-19 work was measured) and `10.34.1.115` (Android 11,
where 2026-09-12/13 was). Both are frequently powered off, and network adb has
to be switched on at the set before either answers. `TODO/ACTIVE.md` §0 has
both, with what differs.

**Playback works and 5.1 was measured** — direct play, six channels, positional
`0x0000003F`, 2026-09-13. **Failover has never run against a node at all**: no
watchdog has fired, no standby has been promoted, and the park, the
classification probe and the promotion gate added on 2026-09-19 have never met
one. Do not write documentation that implies otherwise in either direction.

**The Samsung/Tizen TV is not ours.** It belongs to the web client and the
session that owns it. Never deploy to it.
