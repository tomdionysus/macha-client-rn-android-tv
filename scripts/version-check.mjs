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
import { readFileSync } from 'node:fs';
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

if (problems.length > 0) {
  console.error('version-check: inconsistent version\n  ' + problems.join('\n  '));
  process.exit(1);
}

console.log(`version-check: ${expo.version} (versionCode ${expected}) consistent.`);
