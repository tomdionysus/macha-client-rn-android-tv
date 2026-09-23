#!/usr/bin/env node
/**
 * Keep the version honest in the three places Android and npm each read a
 * different one.
 *
 * **`versionCode` is what Android actually compares.** It ignores
 * `versionName` entirely, so two builds sharing a code are the same build as
 * far as the package manager is concerned. Every APK this client produced up
 * to 2026-09-13 shipped `versionCode 1`, because nothing set
 * `android.versionCode` and the Expo default is 1 — five genuinely different
 * builds were installed on the television that day and the device could not
 * tell them apart. `install -r` hid it; the cost would have been a build that
 * failed to replace and an afternoon spent debugging bytecode that was no
 * longer the source on screen.
 *
 * Raised by the phone client, which hit the same thing. The derivation is
 * theirs so the two Android clients read alike:
 *
 *     major * 10000 + minor * 100 + patch      0.1.0 -> 100, 0.4.1 -> 401
 *
 * Monotonic across any version we will plausibly ship, and it reads back as
 * the version it came from — which matters when the only thing a device will
 * tell you is the number.
 *
 * Run by `pretest`, so a mismatch fails before anything is built.
 */
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(readFileSync(join(root, name), 'utf8'));

export function versionCodeFor(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) throw new Error(`version is not bare semver: ${version}`);
  const [, major, minor, patch] = match.map(Number);
  if (minor > 99 || patch > 99) {
    // The scheme allocates two digits each; a 100th minor would collide with
    // the next major and the ordering would silently invert.
    throw new Error(`minor and patch must each stay below 100: ${version}`);
  }
  return major * 10000 + minor * 100 + patch;
}

const pkg = read('package.json');
const app = read('app.json');
const expo = app.expo ?? app;

const problems = [];
if (expo.version !== pkg.version) {
  problems.push(`app.json version ${expo.version} does not match package.json ${pkg.version}`);
}

const expected = versionCodeFor(expo.version);
const actual = expo.android?.versionCode;
if (actual === undefined) {
  problems.push(`app.json has no android.versionCode — Expo would default it to 1, and every build would look identical to the device`);
} else if (actual !== expected) {
  problems.push(`android.versionCode is ${actual}, expected ${expected} for ${expo.version}`);
}

/**
 * The generated tree is what actually builds, and it does not follow `app.json`
 * on its own.
 *
 * `android/` is produced by `expo prebuild` and gitignored, so a version bump in
 * `app.json` reaches an APK only after a regeneration. On 2026-09-13 that gap
 * shipped an APK carrying `versionCode 1` while `app.json` said 100 — and this
 * script passed, because it only ever compared two config files to each other.
 * It verified intent and never the artifact.
 *
 * The install-time assertion does not catch it either: the APK and the device
 * would both read the stale number and agree.
 *
 * Skipped rather than failed when `android/` is absent, since a clean checkout
 * has not prebuilt yet and that is not an error.
 */
const gradle = join(root, 'android', 'app', 'build.gradle');
if (existsSync(gradle)) {
  const source = readFileSync(gradle, 'utf8');
  const code = /^\s*versionCode\s+(\d+)/m.exec(source)?.[1];
  const name = /^\s*versionName\s+"([^"]+)"/m.exec(source)?.[1];
  if (code === undefined || name === undefined) {
    problems.push('android/app/build.gradle states no versionCode/versionName to check');
  } else {
    if (Number(code) !== expected) {
      problems.push(
        `android/app/build.gradle has versionCode ${code}, expected ${expected}`
        + ' — run `npx expo prebuild --platform android` so the generated tree follows app.json',
      );
    }
    if (name !== expo.version) {
      problems.push(`android/app/build.gradle has versionName ${name}, expected ${expo.version}`);
    }
  }
}

/**
 * The version a reader sees first, under the README's title as `_v0.6.0_`.
 *
 * Tom, 2026-09-23: it goes there and it stays current. A hand-written copy of
 * a number is the kind that goes stale in silence, so it is checked here with
 * the others rather than trusted to be remembered at release time. Only the
 * first line after the title counts, so a version quoted in prose further down
 * can neither satisfy this nor trip it.
 */
const readme = readFileSync(join(root, 'README.md'), 'utf8').split('\n');
const titleAt = readme.findIndex((line) => line.startsWith('# '));
const underTitle = readme.slice(titleAt + 1).find((line) => line.trim() !== '');
const wanted = `_v${pkg.version}_`;
if (titleAt < 0 || underTitle?.trim() !== wanted) {
  problems.push(
    `README.md should carry ${wanted} as the first line under its title; found ${JSON.stringify(underTitle ?? '')}`,
  );
}

if (problems.length > 0) {
  console.error('version-check: inconsistent version\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log(`version-check: ${expo.version} (versionCode ${expected}) consistent, config and generated tree.`);
