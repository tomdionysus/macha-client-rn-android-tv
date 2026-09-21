#!/usr/bin/env bash
# On-device verification for the Macha Android TV client.
#
# Written before the first run so that run is complete rather than improvised.
# The television is only intermittently available, and the three open questions
# — the 5.1 downmix, what Media3 puts on the wire, and whether a promoted
# standby plays — all want the same session. Missing one costs another wait.
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
set -uo pipefail

# The set Tom controls, and therefore the one a bare invocation means.
#
# Both TCLs are targets (2026-09-20), but only this one can be switched on when
# the work needs it; `10.34.1.115` is updated **opportunistically when it
# happens to be up, and not run** — install on it, leave it alone, and take no
# measurement from it unless somebody is standing in front of it.
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

  # INSTALL FIRST, THEN REMOVE. The two packages have different ids and can
  # coexist, so there is never a moment with no Macha app on the set.
  #
  # This is not hypothetical tidiness: doing it the other way round, the
  # television dropped off the network between the uninstall and the install
  # and left the outcome unknown — possibly a set with the WebView client
  # removed and nothing put back. On a link this unreliable, order is the
  # difference between a retryable step and a hole.
  say "Installing $APK"
  [ -f "$APK" ] || { echo "APK missing — build it first." >&2; exit 1; }
  "$ADB" -s "$TV" install -r -d "$APK" || { echo "install failed — nothing removed" >&2; exit 1; }

  say "Confirming the new package is present before removing anything"
  if ! "$ADB" -s "$TV" shell "pm list packages" | tr -d '\r' | grep -qx "package:$PKG"; then
    echo "$PKG not present after install — refusing to remove the existing app." >&2
    exit 1
  fi

  # Present is not the same as *replaced*. `versionCode` is the only thing the
  # package manager compares, and every build before 2026-09-13 shipped 1, so
  # five different APKs were installed over each other indistinguishably in a
  # single session. `install -r` hides a failed replace completely: the risk was
  # never the install, it was reading new source while the set ran old bytecode.
  #
  # So assert rather than report — compare what the device now holds against
  # what this APK actually declares. Raised by the phone client, which reads
  # versionName back after installing; comparing both values against the
  # artifact is the stronger form of the same check.
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
  # The app logs nothing at startup by design; this reads the same source it
  # does, so the two can be compared. A disagreement means the probe is wrong.
  say "Platform decoders (the app builds its capabilities from this)"
  "$ADB" -s "$TV" shell "dumpsys media.player" | grep -E "^Media type" | sed 's/Media type //' | sort -u
  ;;

audio)
  connect
  # The measurement that settles the premise.
  #
  # "Listen for the dialogue" is the symptom; this is the evidence. Three things
  # must all hold for the client to have done its job:
  #
  #   1. the DECODER is a platform E-AC-3/AC-3 decoder, not an AAC one
  #      — an AAC decoder means the node transcoded and nothing was gained;
  #   2. the channel COUNT reaching AudioTrack is 6, not 2
  #      — 2 means something downmixed upstream of the set;
  #   3. the channel MASK is POSITIONAL, not an index mask
  #      — 0x8000003F is the index mask that loses the centre channel, and is
  #        exactly what Chromium hands AudioFlinger. A positional 5.1 mask is
  #        0x3F (FRONT_LEFT|FRONT_RIGHT|FRONT_CENTER|LOW_FREQUENCY|BACK_LEFT|
  #        BACK_RIGHT). The high bit is the whole difference.
  #
  # If 1 and 2 hold but 3 shows an index mask, the client is direct-playing and
  # the set still cannot fold down — which is core's speaker-layout gap, not
  # this client's bug, and is the answer core is waiting for.
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
  # Gates the seamless-failover design: priming a standby means two live
  # ExoPlayer instances, and therefore two concurrent decoder sessions.
  # Hardware decoder instances are scarce and enumerable — often one or two for
  # HEVC on a set like this. If the panel allows only one, a standby fails to
  # allocate exactly when it is most needed, and the design has to fall back to
  # an audio-only or lower-profile prime.
  #
  # dumpsys reports this per codec where the platform populates it. Where it
  # does not, the honest answer is "unknown", and the fallback is to try
  # allocating a second decoder and see — which is app work, not a shell check.
  say "Concurrent decoder instances per codec"
  "$ADB" -s "$TV" shell "dumpsys media.player" \
    | grep -iE "^Media type|instances|concurrent" | head -60
  echo
  echo "Anything reporting 1 for hevc/avc means a primed standby cannot coexist"
  echo "with the playing decoder for that codec."
  ;;

headers)
  connect
  # Turns the source-verified "no custom headers" claim into a wire-verified one.
  say "Media3 HTTP requests (watch while something plays)"
  "$ADB" -s "$TV" logcat -c
  echo "Playing now? Ctrl-C when you have a fragment or two."
  "$ADB" -s "$TV" logcat | grep -iE "DefaultHttpDataSource|okhttp|GET http|User-Agent|Range:|Authorization"
  ;;

logs)
  connect
  # **A release build prints no JavaScript here, and that is deliberate.**
  #
  # This stage used to claim that `ReactNativeJS` carried core's client log —
  # the chosen instruction, the failover, the failure trail. It does not, in
  # the only build that ever reaches a television: `playbackLog.ts` sets
  # `console: __DEV__` on purpose, because the JS/native console bridge costs
  # real CPU on this panel and nobody is attached to it with a cable.
  #
  # Measured 2026-09-21: 10,927 logcat lines across a full playback session on
  # `10.35.1.133`, running the release APK, containing **zero** ReactNativeJS
  # lines. A whole sitting went on diagnosing the silence rather than reading
  # the instrument that was already there.
  #
  # So this stage is now honest about what it can and cannot see, and says
  # where the client's own evidence actually lives.
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
