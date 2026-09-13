package foundation.macha.player

import android.content.Context
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/**
 * The surface the engine draws into.
 *
 * Mounting this view is core's `attach(host)`; unmounting is `detachHost()`.
 * Neither creates or destroys a playback session — the engine outlives the
 * view, so a remount survives rather than silently ending playback.
 *
 * media3's `PlayerView` is used for its `SubtitleView`, which renders text
 * tracks with the platform's own caption styling. Its built-in controller is
 * switched off: the transport chrome is React Native, drawn to match the web
 * client, and two controllers competing for D-pad focus is a trap.
 */
class MachaPlayerView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {

  val playerView = PlayerView(context).also { view ->
    view.useController = false
    // The web client's `.native-video { object-fit: contain }`.
    view.resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
    // `.player-host { background: black }`.
    view.setBackgroundColor(android.graphics.Color.BLACK)
    // The chrome above must take D-pad focus, never the video surface.
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
    // Unbind presentation only. The engine keeps its session and its resources.
    playerView.player = null
    super.onDetachedFromWindow()
  }
}
