# macha-client-rn-tv

_v0.9.1_

The Macha client for **Android TV**: React Native, leanback, D-pad only.

It plays the original file on the set's own hardware decoders, which a WebView
cannot reach. Chromium has no AC-3 or E-AC-3 decoder, so the web client on a
television makes the node transcode surround sound and loses the channel
layout. The measure of this client is how little it transcodes.

It matches the look and D-pad behaviour of the web client,
[`macha-client`](https://github.com/tomdionysus/macha-client). Everything that
is not presentation comes from
[`@machafoundation/core`](https://www.npmjs.com/package/@machafoundation/core).

## What works

- Home, Movies, TV Shows, series and seasons, detail, Search, Music (albums),
  Status, Settings, sign-in: 11 of the web client's 28 routes.
  [`TODO/ACTIVE.md`](TODO/ACTIVE.md) §4 lists the rest.
- Direct play, remux and transcode, on the TCL sets. 5.1 reaches the set as six
  positional channels (measured).
- Failover from one node to another, at the same position (measured twice).
  Standby promotion has not been seen.

## Where this sits

| Repo | What it is |
| --- | --- |
| [`macha`](https://github.com/tomdionysus/macha) | The server: a distributed filesystem and media server, every node an equal peer |
| [`macha-ts`](https://github.com/tomdionysus/macha-core-npm) | `@machafoundation/core`: API, cluster routing, playback coordination, client state |
| [`macha-client`](https://github.com/tomdionysus/macha-client) | React web client, and the Samsung/Tizen TV app |
| [`macha-client-rn`](https://github.com/tomdionysus/macha-client-rn) | React Native phone app |
| **`macha-client-rn-tv`** | This: React Native Android TV |

This is not the phone app. `android.software.leanback` is required, so the APK
does not install on a handset.

## Install on a television

The set must be Android TV with a 32-bit ARM ABI (`armeabi-v7a`) and network
adb switched on in Developer options.

```sh
adb connect <tv-address>:5555
TV=<tv-address>:5555 ./scripts/verify-on-device.sh install
```

The script installs the APK you built, checks the set is running that exact
build, and does not launch it. The build carries one server address, set in
`app.json` under `extra.machaEndpoints`; change it there, or in the app's
Settings.

## Build

```sh
npm install                                    # .npmrc sets legacy-peer-deps
EXPO_TV=1 npx expo prebuild --platform android --clean
cd android && EXPO_TV=1 ./gradlew :app:assembleRelease \
  -PreactNativeArchitectures=armeabi-v7a
```

The release APK embeds the JS bundle and is signed with the debug keystore, so
it runs with no Metro server.

- **Core:** `main` installs `@machafoundation/core` from the registry. Working
  branches link the sibling checkout (`file:../macha-ts`): clone it beside this
  repo and run `npm run build` there, because this client imports core's
  `dist`.
- **`android/` is generated** and gitignored. Manifest changes go in
  `plugins/withAndroidTvOnly.js`, then re-run prebuild.
- **After changing core or JS**, delete
  `android/app/build/generated/assets/react/release/index.android.bundle`
  before `assembleRelease`, or Gradle reuses the old bundle.
- **Verify the artifact:** `aapt2 dump badging` should show leanback required
  and `native-code: 'armeabi-v7a'`.

## Check

```sh
npm run typecheck
npm test                              # runs version:check first
npx expo export --platform android    # proves core bundles through Metro
```

## How it is put together

```
PlaybackRuntime -- PlaybackCoordinator -- ExpoVideoAdapter -- expo-video (Media3)
     (core)              (core)            (src/player)
```

- **Playback goes through core's `PlaybackCoordinator`**, which owns failover,
  stall recovery and standby promotion. The adapter implements core's `Player`
  and holds no policy.
- **The player is `expo-video`.** A native engine (`modules/macha-player`,
  `PlayerEngine.kt`, `ExoPlayerAdapter`) is in the tree and not in use.
- **Capabilities are read from `MediaCodecList`** through the native module,
  never a hardcoded list, and shown on the Settings screen. An under-claim
  makes the node transcode silently.
- **Focus** (`src/hooks/tvFocus.ts`) is a port of the web client's scorer,
  weights included, so navigation matches.
- **Appearance** (`src/styles/theme.ts`) is a port of the web client's
  `base.css`; each style cites its rule.
- **Viewer text** is this client's, in `src/text/viewerText.ts`. Core supplies
  facts and codes, never words.
- **Timing budgets** (`src/player/timingBudgets.ts`) state what each is
  calibrated against, and tests assert the relationships between them.

## Further reading

- [`AGENTS.md`](AGENTS.md): the rules for changing this repo.
- [`TODO/ACTIVE.md`](TODO/ACTIVE.md): open work, the test sets, and the traps of
  driving them over adb.
- [`docs/ROADMAP.md`](docs/ROADMAP.md): work deliberately not done, and what
  each item needs.
- [`docs/HISTORY.md`](docs/HISTORY.md): measurements, decisions and dead ends.
- [`docs/principles-and-laws.md`](docs/principles-and-laws.md): the laws every
  Macha project shares.
- `macha-ts/docs/writing-a-player.md`: the contracts behind core's `Player`.
