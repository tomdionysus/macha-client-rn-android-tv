package foundation.macha.tvinput

import android.app.Activity
import android.view.KeyEvent
import android.view.Window
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The remote, delivered to JavaScript.
 *
 * **React Native cannot do this in the architecture this app is built with.**
 * `useTVEventHandler` listens for `onHWKeyEvent`, which is emitted only by
 * `ReactAndroidHWInputDeviceHelper`, which is called only from the legacy
 * `ReactRootView`. This app is bridgeless, so its key events go to
 * `JSKeyDispatcher` instead — which never emits that event, and which opens
 * with `if (focusedViewTag == View.NO_ID) return`, discarding everything unless
 * an Android view holds focus. The focus model here is a JavaScript registry
 * over plain `View`s that never take Android focus, so nothing arrives by
 * either route. Verified in `react-native-tvos@0.86.2-0`'s own source; the fork
 * does not patch it.
 *
 * So the client owns this seam, for the same reason it owns `Capabilities.kt`:
 * where React Native's abstraction does not serve a television, the native code
 * is already here and reading the platform directly costs less than working
 * around the gap.
 *
 * **Why the window callback and not `MainActivity`.** Overriding
 * `dispatchKeyEvent` on the activity would mean editing generated code under
 * `android/`, which `expo prebuild` regenerates — the exact way this project
 * has already lost its leanback flags once and its ABI pin twice. Wrapping
 * `Window.Callback` needs no generated file and survives a prebuild untouched.
 *
 * **Back is deliberately not handled here.** It goes to React Native's
 * `BackHandler`, which works under bridgeless and — unlike this bridge — can
 * answer *synchronously* whether JavaScript consumed it. Consuming Back on a
 * guess would either trap the viewer in the app or drop them out of it.
 */
class MachaTvInputModule : Module() {

  private var patchedWindow: Window? = null
  private var originalCallback: Window.Callback? = null

  override fun definition() = ModuleDefinition {
    Name("MachaTvInput")

    Events(EVENT_NAME)

    OnCreate { install(appContext.currentActivity) }

    // The activity is routinely absent at OnCreate; this is the reliable hook,
    // and re-entering the foreground after the set has slept is also when a
    // stale callback would need replacing. `install` is idempotent.
    OnActivityEntersForeground { install(appContext.currentActivity) }

    OnDestroy { uninstall() }
  }

  private fun install(activity: Activity?) {
    val window = activity?.window ?: return
    if (patchedWindow === window) return
    uninstall()

    val existing = window.callback ?: return
    originalCallback = existing
    patchedWindow = window
    window.callback = KeyInterceptingCallback(existing) { event -> handleKeyEvent(event) }
  }

  private fun uninstall() {
    val window = patchedWindow ?: return
    // Only restore a callback that is still ours. Something else may have
    // wrapped the window after us, and clobbering its callback would break it.
    if (window.callback is KeyInterceptingCallback) {
      window.callback = originalCallback
    }
    patchedWindow = null
    originalCallback = null
  }

  /** True when this key belongs to the app and the platform should not also act on it. */
  private fun handleKeyEvent(event: KeyEvent): Boolean {
    val command = COMMANDS[event.keyCode] ?: return false

    // Emitted on ACTION_DOWN only. The legacy helper this replaces emitted on
    // both down and up, and `useTvNavigation` never inspected `eventKeyAction`
    // — so every press would have moved focus twice had that path ever run.
    //
    // `repeatCount` is passed rather than filtered: a held direction is how a
    // viewer crosses a long row on a D-pad, and JavaScript decides whether to
    // accelerate. ACTION_UP is still consumed below so the platform does not
    // act on a key the app has taken.
    if (event.action == KeyEvent.ACTION_DOWN) {
      sendEvent(
        EVENT_NAME,
        mapOf(
          "eventType" to command,
          "repeatCount" to event.repeatCount,
        ),
      )
    }

    return event.action == KeyEvent.ACTION_DOWN || event.action == KeyEvent.ACTION_UP
  }

  private class KeyInterceptingCallback(
    private val delegate: Window.Callback,
    private val onKey: (KeyEvent) -> Boolean,
  ) : Window.Callback by delegate {
    override fun dispatchKeyEvent(event: KeyEvent): Boolean =
      if (onKey(event)) true else delegate.dispatchKeyEvent(event)
  }

  private companion object {
    const val EVENT_NAME = "onTvKey"

    /**
     * The remote, in the web client's command vocabulary.
     *
     * `select` covers Enter as well as D-pad centre because television remotes
     * and the emulator disagree about which one the OK button sends. The media
     * keys are here because a television remote has transport buttons and a
     * viewer will press them — the WebView client on this set never handled
     * them at all.
     */
    val COMMANDS: Map<Int, String> =
      mapOf(
        KeyEvent.KEYCODE_DPAD_UP to "up",
        KeyEvent.KEYCODE_DPAD_DOWN to "down",
        KeyEvent.KEYCODE_DPAD_LEFT to "left",
        KeyEvent.KEYCODE_DPAD_RIGHT to "right",
        KeyEvent.KEYCODE_DPAD_CENTER to "select",
        KeyEvent.KEYCODE_ENTER to "select",
        KeyEvent.KEYCODE_NUMPAD_ENTER to "select",
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE to "playPause",
        KeyEvent.KEYCODE_MEDIA_PLAY to "playPause",
        KeyEvent.KEYCODE_MEDIA_PAUSE to "playPause",
        KeyEvent.KEYCODE_MEDIA_REWIND to "rewind",
        KeyEvent.KEYCODE_MEDIA_FAST_FORWARD to "fastForward",
        KeyEvent.KEYCODE_MEDIA_STOP to "stop",
        KeyEvent.KEYCODE_MEDIA_NEXT to "next",
        KeyEvent.KEYCODE_MEDIA_PREVIOUS to "previous",
      )
  }
}
