package foundation.macha.player

import android.content.Context
import android.hardware.display.DisplayManager
import android.view.Display
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The native surface core's `Player` implementation is written against.
 *
 * Everything here is transport and evidence. No playback *policy* lives on this
 * side: which node to use, when to fail over, when to prepare a standby and
 * what instruction to ask for are all core's decisions, made in
 * `PlaybackCoordinator`. This module's whole job is to do what it is told with
 * the platform's decoders and report honestly what happened.
 */
class MachaPlayerModule : Module() {

  companion object {
    /**
     * The engine, reachable by the view without going through JS.
     *
     * A view mounting has to bind to the *existing* engine synchronously — if
     * it had to ask JS for one it would create a second engine on remount and
     * the first would keep playing audio underneath.
     */
    @Volatile
    var sharedEngine: PlayerEngine? = null
      private set
  }

  private val engine: PlayerEngine
    get() = sharedEngine ?: PlayerEngine(appContext.reactContext!!).also { sharedEngine = it }

  override fun definition() = ModuleDefinition {
    Name("MachaPlayer")

    Events("onPlaybackEvent", "onFailure", "onDegradation")

    OnCreate {
      val created = PlayerEngine(appContext.reactContext!!)
      sharedEngine = created
      created.onEvent = { sendEvent("onPlaybackEvent", it) }
      // Evidence, not a verdict: the HTTP status when there was one, the
      // decoder's own opinion when there was not. Core owns the status mapping.
      created.onFailure = { httpStatus, platformKind, message ->
        sendEvent(
          "onFailure",
          mapOf(
            "httpStatus" to if (httpStatus > 0) httpStatus else null,
            "platformKind" to platformKind,
            "message" to message,
          ),
        )
      }
      created.onDegradation = { message -> sendEvent("onDegradation", mapOf("message" to message)) }
    }

    OnDestroy {
      sharedEngine?.release()
      sharedEngine = null
    }

    /**
     * What the hardware decodes, read from `MediaCodecList`.
     *
     * Containers come from ExoPlayer's extractor set rather than the device,
     * because `MediaCodecList` cannot answer that question at all.
     */
    Function("capabilities") {
      val inventory = Capabilities.read(appContext.reactContext!!)
      mapOf(
        "platform" to "android",
        "videoCodecs" to inventory.videoCodecs,
        "audioCodecs" to inventory.audioCodecs,
        "containers" to Capabilities.containers(),
        "hlsFmp4" to true,
        "hlsTs" to true,
        // ExoPlayer's HLS path is narrower than its progressive extractors:
        // fragmented MP4 carries H.264/HEVC and AAC dependably, and little
        // else. Stated rather than left unset, because an absent list falls
        // back to the direct-play lists and would silently claim E-AC-3 in
        // fMP4 — which is exactly the combination Tizen got wrong.
        "hlsVideoCodecs" to listOf("h264", "hevc"),
        "hlsAudioCodecs" to listOf("aac"),
        "dash" to true,
        "hdr" to inventory.hdr,
        "videoBitDepth" to inventory.videoBitDepth,
        "dolbyVision" to inventory.dolbyVision,
        "maxWidth" to inventory.maxWidth,
        "maxHeight" to inventory.maxHeight,
      )
    }

    /**
     * The panel's current mode in physical pixels, for the quality ceiling.
     *
     * Not React Native's window: on `.133` that reads 1920x1080 (960x540 dp at
     * density 2) while the panel runs 3840x2160, and automatic play capped at
     * the UI's size would refuse a 4K file on a 4K set. Tom, 2026-09-25: the
     * display class this TV states is the panel's. `Display.getMode()` is API
     * 23; the default display, because a television has one.
     */
    Function("displayMode") {
      val manager = appContext.reactContext?.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
      val mode = manager?.getDisplay(Display.DEFAULT_DISPLAY)?.mode
      if (mode == null) null else mapOf("width" to mode.physicalWidth, "height" to mode.physicalHeight)
    }

    /** The raw decoder inventory, so the Status screen can show what was read. */
    Function("decoderInventory") {
      val inventory = Capabilities.read(appContext.reactContext!!)
      inventory.decoders.map {
        mapOf("name" to it.name, "mimeType" to it.mimeType, "hardwareAccelerated" to it.hardwareAccelerated)
      }
    }

    AsyncFunction("play") { url: String,
                            mimeType: String?,
                            isManifest: Boolean,
                            positionMs: Double,
                            startPaused: Boolean,
                            headers: Map<String, String>?,
                            subtitleUrl: String? ->
      engine.play(
        url = url,
        mimeType = mimeType,
        isManifest = isManifest,
        positionMs = positionMs.toLong(),
        startPaused = startPaused,
        headers = headers ?: emptyMap(),
        subtitleUrl = subtitleUrl,
      )
      true
    }

    // No queue selection on these: a synchronous `Function` has none to give,
    // and `PlayerEngine` marshals every ExoPlayer touch onto the player's own
    // looper itself. `localSeekCoverage` answers from a cached extent for the
    // same reason — it must return a value on the calling thread.
    Function("pause") { engine.pause() }
    Function("resume") { engine.resume() }
    Function("seek") { positionMs: Double -> engine.seek(positionMs.toLong()) }
    Function("setVolume") { volume: Double -> engine.setVolume(volume.toFloat()) }
    Function("stop") { engine.stop() }
    Function("release") {
      sharedEngine?.release()
      sharedEngine = null
    }

    Function("localSeekCoverage") { engine.localSeekCoverage() }

    /**
     * Hold the screen awake for the duration of playback.
     *
     * Without this the set runs its dim/screensaver/sleep sequence straight
     * through a film — the WebView client had no equivalent, and a wake lock on
     * the CPU alone does not stop the display timing out.
     */
    Function("setKeepScreenOn") { enabled: Boolean ->
      engine.keepScreenOn(appContext.currentActivity, enabled)
    }

    View(MachaPlayerView::class) {
      // No props: the view is a surface, and every transport command goes to
      // the engine directly rather than through view re-renders.
    }
  }
}
