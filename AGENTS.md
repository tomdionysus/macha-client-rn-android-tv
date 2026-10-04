# Working on this client

`README.md` orients you. Read [`docs/HISTORY.md`](docs/HISTORY.md) before
designing anything about playback or failover: it records what was measured and
which theories failed. [`docs/principles-and-laws.md`](docs/principles-and-laws.md)
is the shared Macha document (1 control, 2 viewer, 3 loader, 4 Shoot Thyself);
cite laws by number. Its text is core's and changes in core first.

## Non-negotiables

- **This is an Android TV app.** Leanback, D-pad, 10-foot UI. No touch
  handlers, gestures, phone layouts or phone/tablet branching.
- **Playback goes through `PlaybackCoordinator`.** Never call
  `ClusterPlaybackResolver` directly: failover, stall recovery and standby
  promotion live in the coordinator, and a host that bypasses it loses all
  three.
- **Do not reimplement anything in `@machafoundation/core`.** API families,
  routing and health, playback resolution, Continue Watching, playlists,
  volume, sorting, title indexing and availability are there. If something
  seems missing, ask the session that owns `macha-ts`.
- **Push shared logic into core.** The test is what the code depends on.
  Geometry, a protocol constant, a status mapping: no dependencies, so core.
  ExoPlayer, `MediaCodecList`, `AppState`, RN views, D-pad input, the manifest:
  platform, so here. A local copy kept until core has it says so at its
  declaration and names its replacement.
- **Every word a viewer sees is this client's.** Core carries facts and codes,
  never labels or sentences. Viewer text lives in `src/text/viewerText.ts`. The
  web client words a sentence first; port it word for word from its tree.
- **Match the web client, within the device.** Appearance comes from
  `src/styles/theme.ts`, a port of `macha-client/src/styles/base.css`; cite the
  CSS rule in a comment and write no colour or size inline.
- **The focus model is a port.** `src/hooks/tvFocus.ts` reproduces the web
  client's scoring weights. Change a weight in both places and in
  `tvFocus.test.ts`.
- **Every timing budget states what it is calibrated against, at its
  definition**, and a test asserts the relationship, not the value. See
  `src/player/timingBudgets.ts`.
- **Say whether a claim is measured or asserted.** Measured means read off a
  device or a node; asserted means taken from an implementation or a contract.
- **A claim about another repository names the file it was read from**, or
  says nobody has read it.
- **Prove a test red before trusting it green, and read why it is red.** A
  test can fail for a reason unrelated to the defect, and then its green
  proves nothing.
- **Comments say what the code cannot, briefly, in the present tense.** No
  dates, hashes, attributions or stories in comments or test names. History
  goes in `docs/HISTORY.md`, `TODO/COMPLETED.md` and commit messages.

## Traps

- The target sets are **`armeabi-v7a` only**. Check a new native dependency
  ships 32-bit ARM.
- **Verify the artifact, not the source.** A config plugin added without
  re-running `expo prebuild` does nothing; check the APK with
  `aapt2 dump badging`.
- `android/` is generated and gitignored. Manifest changes belong in
  `plugins/withAndroidTvOnly.js`.
- `react-native` is an alias for `react-native-tvos`, whose prerelease version
  fails peer ranges; hence `legacy-peer-deps` in `.npmrc`.
- **Core comes from the registry on `main` and from `../macha-ts` on working
  branches.** Before anything merges to `main`, restore the registry version
  and re-run the three checks against it. For an unreleased core change
  without the link: `npm install @machafoundation/core@next`.
- **This client imports core's `dist`, which can lag its source.** Before
  measuring anything that depends on which core answered:

      ls -l node_modules/@machafoundation/core        # symlink, or a copy?
      git -C ../macha-ts log --oneline -1             # which core is on disk
      grep -rl <the new symbol> node_modules/@machafoundation/core/dist

- Expo's synchronous `Function` has no `runOnQueue`; only `AsyncFunction` does.
  `PlayerEngine` marshals onto ExoPlayer's looper itself.

## Branching and releases

The convention across every Macha repository:

- Work happens on a long-lived working branch (`develop`, or the branch
  `TODO/ACTIVE.md` §0 names). Releases live on `main`; a release is a tag.
- Tags are bare semver (`0.1.0`, never `v0.1.0`) and annotated. One tag per
  release commit.
- Do not name branches after versions.
- The version bump goes inside the release commit, so the tag points at
  exactly what ships.
- The version number and every push are Tom's word.

**`versionCode` is what Android compares**, and it ignores `versionName`: two
builds sharing a code are the same build to the package manager. It is derived:

    major * 10000 + minor * 100 + patch        0.1.0 -> 100, 0.4.1 -> 401

`npm run version:check` enforces it across `package.json`, `app.json`, the
README and the generated `android/` tree, and runs before `npm test`. After a
bump, re-run `EXPO_TV=1 npx expo prebuild --platform android`. Builds between
releases share a code, so record the APK's md5 at every install.

## Verifying

```sh
npm run typecheck
npm test
npx expo export --platform android
```

The export proves core's ESM resolves through the RN bundler, which
typechecking cannot.

Anything about decoders, audio routing, downmix or failover is confirmed on a
television over `adb connect`. There are two TCL sets, on different hardware
and often powered off; `TODO/ACTIVE.md` has their addresses, what differs, and
the rules for driving them. Check a set is idle before any key or install.

**What has been measured:** direct play of 5.1 as six positional channels
(`0x0000003F`), and failover from one node to another at the same position,
twice. Which failover path fired was not recorded. Standby promotion, the park,
the classification probe and the promotion gate have not been seen to act. Do
not write documentation that implies more than that, or less.

**The Samsung/Tizen TV is not ours.** It belongs to the web client. Never
deploy to it.
