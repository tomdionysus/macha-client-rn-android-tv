#!/usr/bin/env bash
# On-device verification for the Macha Android TV client.
#
# The television is only intermittently available, and the open questions
# (the 5.1 downmix, what Media3 puts on the wire, whether a promoted standby
# plays) all want the same session, so every check is here and ready. Missing
# one costs another wait.
#
# Staged deliberately. Stage 1 installs and stops, because the standing
# instruction is to install without starting. Nothing after stage 1 runs unless
# you ask for it by name.
#
#   ./scripts/verify-on-device.sh install     # install, then remove old Macha; does NOT launch
#   ./scripts/verify-on-device.sh capabilities  # what the app read off MediaCodecList
#   ./scripts/verify-on-device.sh audio       # THE measurement: decoder + channel mask
#   ./scripts/verify-on-device.sh instances   # concurrent decoder limit (gates seamless failover)
#   ./scripts/verify-on-device.sh headers     # what Media3 actually sends
#   ./scripts/verify-on-device.sh logs        # native playback logs (NOT this client's own; see the stage)
#   ./scripts/verify-on-device.sh bundle <literal>...  # is this literal in the APK's bundle?
set -uo pipefail

# Default target. `10.34.1.115` is install-only: take no measurement from it
# unless somebody is in front of it.
TV="${TV:-10.35.1.133:5555}"
PKG="foundation.macha.client.tv"
APK="android/app/build/outputs/apk/release/app-release.apk"
ADB="${ANDROID_HOME:-$HOME/Library/Android/sdk}/platform-tools/adb"

say() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

connect() {
  "$ADB" connect "$TV" >/dev/null 2>&1
  if ! "$ADB" -s "$TV" shell true >/dev/null 2>&1; then
    echo "TV not reachable at $TV — the set is powered off, or adb is not listening." >&2
    echo "Routing is not usually the problem: 10.34.1.50 answering while .115 does not means the set is off." >&2
    exit 1
  fi
}

case "${1:-}" in

install)
  connect
  say "Macha packages currently installed"
  "$ADB" -s "$TV" shell "pm list packages | grep -i macha" | tr -d '\r' || echo "(none)"

  # Install first, then remove: the package ids differ and can coexist, so a
  # dropped link never leaves the set with no Macha app.
  say "Installing $APK"
  [ -f "$APK" ] || { echo "APK missing — build it first." >&2; exit 1; }
  "$ADB" -s "$TV" install -r -d "$APK" || { echo "install failed — nothing removed" >&2; exit 1; }

  say "Confirming the new package is present before removing anything"
  if ! "$ADB" -s "$TV" shell "pm list packages" | tr -d '\r' | grep -qx "package:$PKG"; then
    echo "$PKG not present after install — refusing to remove the existing app." >&2
    exit 1
  fi

  # Present is not replaced: `install -r` hides a failed replace, so compare
  # versionCode and versionName on the device with what the APK declares.
  say "Confirming the device is running THIS build"
  aapt2="$(ls "${ANDROID_HOME:-$HOME/Library/Android/sdk}"/build-tools/*/aapt2 2>/dev/null | sort -V | tail -1)"
  if [ -z "$aapt2" ]; then
    echo "  aapt2 not found — cannot verify what landed. Continuing, unverified." >&2
  else
    apk_line="$("$aapt2" dump badging "$APK" 2>/dev/null | grep -m1 "^package:")"
    apk_code="$(printf '%s' "$apk_line" | sed -n "s/.*versionCode='\([0-9]*\)'.*/\1/p")"
    apk_name="$(printf '%s' "$apk_line" | sed -n "s/.*versionName='\([^']*\)'.*/\1/p")"
    dev="$("$ADB" -s "$TV" shell "dumpsys package $PKG" | tr -d '\r')"
    dev_code="$(printf '%s' "$dev" | sed -n 's/.*versionCode=\([0-9]*\).*/\1/p' | head -1)"
    dev_name="$(printf '%s' "$dev" | sed -n 's/.*versionName=\([^ ]*\).*/\1/p' | head -1)"
    echo "  apk:    versionCode=$apk_code versionName=$apk_name"
    echo "  device: versionCode=$dev_code versionName=$dev_name"
    if [ "$apk_code" != "$dev_code" ] || [ "$apk_name" != "$dev_name" ]; then
      echo "MISMATCH — the set is not running the APK just built." >&2
      echo "Nothing removed. Do not debug against this install." >&2
      exit 1
    fi
    echo "  match"
  fi
  echo "  $PKG present"

  say "Removing other Macha apps"
  for existing in $("$ADB" -s "$TV" shell "pm list packages | grep -i macha" | sed 's/package://' | tr -d '\r'); do
    [ "$existing" = "$PKG" ] && continue
    echo "  removing $existing"
    "$ADB" -s "$TV" uninstall "$existing" | tr -d '\r' || echo "  (failed; rerun to retry)"
  done

  say "Installed, and deliberately NOT launched"
  "$ADB" -s "$TV" shell "pm list packages | grep -i macha" | tr -d '\r'
  echo "Launch by hand from the TV home row, or:"
  echo "  $ADB -s $TV shell monkey -p $PKG -c android.intent.category.LEANBACK_LAUNCHER 1"
  ;;

capabilities)
  connect
  # Reads the source the app builds its capabilities from; a disagreement
  # means the probe is wrong.
  say "Platform decoders (the app builds its capabilities from this)"
  "$ADB" -s "$TV" shell "dumpsys media.player" | grep -E "^Media type" | sed 's/Media type //' | sort -u
  ;;

audio)
  connect
  # All three must hold:
  #   1. the decoder is a platform E-AC-3/AC-3 decoder, not AAC (AAC means the
  #      node transcoded);
  #   2. the channel count reaching AudioTrack is 6, not 2;
  #   3. the channel mask is positional (0x3F), not the index mask 0x8000003F,
  #      which loses the centre channel.
  # 1 and 2 with an index mask means direct play works and the set cannot fold
  # down: core's speaker-layout gap, not this client's.
  say "Active audio tracks at AudioFlinger (channel mask and format)"
  "$ADB" -s "$TV" shell "dumpsys media.audio_flinger" \
    | grep -iE "channel|format|sample|track|mixer" | head -40

  say "Codecs currently instantiated"
  "$ADB" -s "$TV" shell "dumpsys media.player" | grep -iE "eac3|ac3|aac|mp4a" | head -20

  echo
  echo "Read it as: platform e/ac3 decoder + 6 channels + a mask WITHOUT the 0x80000000 bit = the premise holds."
  ;;

instances)
  connect
  # A primed standby is a second ExoPlayer, so a second concurrent decoder
  # session. dumpsys reports the limit per codec only where the platform
  # populates it; otherwise it is unknown.
  say "Concurrent decoder instances per codec"
  "$ADB" -s "$TV" shell "dumpsys media.player" \
    | grep -iE "^Media type|instances|concurrent" | head -60
  echo
  echo "Anything reporting 1 for hevc/avc means a primed standby cannot coexist"
  echo "with the playing decoder for that codec."
  ;;

headers)
  connect
  # Checks on the wire that Media3 sends no custom headers.
  say "Media3 HTTP requests (watch while something plays)"
  "$ADB" -s "$TV" logcat -c
  echo "Playing now? Ctrl-C when you have a fragment or two."
  "$ADB" -s "$TV" logcat | grep -iE "DefaultHttpDataSource|okhttp|GET http|User-Agent|Range:|Authorization"
  ;;

bundle)
  # Gradle cannot see inside the symlinked core, so an "up to date" build can
  # ship stale JavaScript. Name a literal only the new code emits and look for
  # it in the APK's bundle.
  #
  # Each literal is searched in UTF-8 and UTF-16: Hermes stores any string with
  # a non-ASCII character (`—`, `…`) as UTF-16, which a byte grep misses.
  shift
  [ $# -gt 0 ] || { echo "usage: verify-on-device.sh bundle <literal>..." >&2; exit 1; }
  [ -f "$APK" ] || { echo "APK missing — build it first." >&2; exit 1; }
  work="$(mktemp -d)"
  trap 'rm -rf "$work"' EXIT
  unzip -o -q "$APK" assets/index.android.bundle -d "$work" || {
    echo "no assets/index.android.bundle in $APK" >&2; exit 1; }
  b="$work/assets/index.android.bundle"
  say "Bundle inside $APK"
  echo "  bytes: $(wc -c < "$b" | tr -d ' ')"
  echo "  sha:   $(shasum -a 256 < "$b" | cut -c1-16)"
  missing=0
  # Counted in Python: the UTF-16 needle is mostly NUL bytes, which every way
  # of passing a pattern to grep splits or truncates, reporting "absent".
  for lit in "$@"; do
    read -r n enc <<<"$(LIT="$lit" B="$b" python3 -c '
import os, sys
needle, blob = os.environ["LIT"], open(os.environ["B"], "rb").read()
for label, raw in (("utf-8", needle.encode("utf-8")), ("utf-16", needle.encode("utf-16-le"))):
    n = blob.count(raw)
    if n:
        print(n, label); sys.exit()
print(0, "-")
')"
    if [ "${n:-0}" -gt 0 ]; then
      printf '  present  %s (%s, %s)\n' "$lit" "$n" "$enc"
    else
      printf '  MISSING  %s\n' "$lit"
      missing=$((missing + 1))
    fi
  done
  [ "$missing" -eq 0 ] || { echo "$missing literal(s) absent — this APK does not carry the change." >&2; exit 1; }
  echo "  all present"
  ;;

logs)
  connect
  # A release build prints no JavaScript here: `playbackLog.ts` sets
  # `console: __DEV__` because the console bridge costs CPU on this panel
  # (measured on `10.35.1.133`: zero ReactNativeJS lines in a session).
  say "What the PLATFORM reports (decoder, audio routing, media3)"
  "$ADB" -s "$TV" logcat -c
  echo "Native only. For this client's own playback evidence — the chosen"
  echo "instruction, the failure trail, a failover — use the on-screen trail:"
  echo "  Settings -> Diagnostics -> on, then reproduce; the failure overlay"
  echo "  prints the last dozen lines, lifted to 'info' while it is on."
  echo "A debug build ('npm run android') is the only one that mirrors those"
  echo "lines to logcat, and it is not what goes on the set."
  echo
  "$ADB" -s "$TV" logcat \
    | grep -iE "ExoPlayer|MediaCodec|AudioSink|AudioTrack|MachaPlayer|ReactNativeJS"
  ;;

*)
  sed -n '1,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
  ;;
esac
