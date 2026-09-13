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

**Do not reimplement anything in `@macha/core`.** API families, endpoint routing
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
- **`@macha/core` is a `file:` link and npm will not rebuild it for you.** A
  stale `dist/` typechecks green and fails at runtime — and `dist:check` cannot
  see src that is ahead of its last build. Run `cd ../macha-ts && npm run build`
  after changing core.
- Expo's synchronous `Function` has no `runOnQueue`; only `AsyncFunction` does.
  `PlayerEngine` marshals onto ExoPlayer's looper itself.

## Verifying

```sh
npm run typecheck
npm test
npx expo export --platform android
```

The export is not redundant: typechecking cannot tell you whether core's ESM
resolves through the RN bundler.

Anything about decoders, audio routing, downmix or failover has to be confirmed
on the television — the TCL set at `10.34.1.115:5555` over `adb connect`, which
is frequently powered off. Nothing about playback has been exercised on hardware
yet; do not write documentation that implies otherwise.

**The Samsung/Tizen TV is not ours.** It belongs to the web client and the
session that owns it. Never deploy to it.
