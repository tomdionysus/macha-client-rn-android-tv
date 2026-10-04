package foundation.macha.player

import android.content.Context
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * The surface the engine draws into. Mounting is core's `attach(host)`,
 * unmounting `detachHost()`; the engine and its session outlive the view.
 *
 * `PlayerView` is used for its `SubtitleView`. Its controller is off: the
 * chrome is React Native, and two controllers would compete for D-pad focus.
 */
class MachaPlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  val playerView = PlayerView(context).also { view ->
    view.useController = false
    // .native-video { object-fit: contain }
    view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    // .player-host { background: black }
    view.setBackgroundColor(android.graphics.Color.BLACK)
    // The chrome takes D-pad focus, never the video surface.
    view.isFocusable = false
    view.isFocusableInTouchMode = false
    addView(view, android.view.ViewGroup.LayoutParams(
      android.view.ViewGroup.LayoutParams.MATCH_PARENT,
      android.view.ViewGroup.LayoutParams.MATCH_PARENT,
    ))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    playerView.player = MachaPlayerModule.sharedEngine?.ensurePlayer()
  }

  override fun onDetachedFromWindow() {
    // Unbinds presentation only; the engine keeps its session.
    playerView.player = null
    super.onDetachedFromWindow()
  }
}
