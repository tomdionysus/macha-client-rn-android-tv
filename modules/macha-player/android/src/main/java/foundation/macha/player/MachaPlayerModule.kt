package foundation.macha.player

import android.content.Context
import android.hardware.display.DisplayManager
import android.view.Display
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The native surface core's `Player` implementation is written against.
 * Transport and evidence only: playback policy is core's `PlaybackCoordinator`.
 */
class MachaPlayerModule : Module() {

  companion object {
    /**
     * Reachable by the view without JS, so a remounting view binds to the
     * existing engine instead of creating a second one.
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
      // Evidence, not a verdict: core owns the status mapping.
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

    /** Codecs from `MediaCodecList`; containers from ExoPlayer's extractor set. */
    Function("capabilities") {
      val inventory = Capabilities.read(appContext.reactContext!!)
      mapOf(
        "platform" to "android",
        "videoCodecs" to inventory.videoCodecs,
        "audioCodecs" to inventory.audioCodecs,
        "containers" to Capabilities.containers(),
        "hlsFmp4" to true,
        "hlsTs" to true,
        // ExoPlayer's HLS path is narrower than its progressive extractors.
        // Must be stated: an absent list falls back to the direct-play lists
        // and would claim E-AC-3 in fMP4.
        "hlsVideoCodecs" to listOf("h264", "hevc"),
        "hlsAudioCodecs" to listOf("aac"),
        "dash" to true,
        "hdr" to inventory.hdr,
        "videoBitDepth" to inventory.videoBitDepth,
        "dolbyVision" to inventory.dolbyVision,
        "maxWidth" to inventory.maxWidth,
        "maxHeight" to inventory.maxHeight,
        "videoCodecMaxSize" to inventory.videoCodecMaxSize.mapValues { (_, size) ->
          mapOf("width" to size.first, "height" to size.second)
        },
        "softwareOnlyVideoCodecs" to inventory.softwareOnlyVideoCodecs,
      )
    }

    /**
     * The panel's current mode in physical pixels, for the quality ceiling.
     * Not React Native's window, which reads 1920x1080 on a 3840x2160 panel
     * (`.133`).
     */
    Function("displayMode") {
      val manager = appContext.reactContext?.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
      val mode = manager?.getDisplay(Display.DEFAULT_DISPLAY)?.mode
      if (mode == null) null else mapOf("width" to mode.physicalWidth, "height" to mode.physicalHeight)
    }

    /** The raw decoder inventory, for the Status screen. */
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

    // A synchronous `Function` has no queue: `PlayerEngine` marshals onto the
    // player's looper itself, and `localSeekCoverage` answers from a cache.
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

    /** Keeps the display awake during playback; a CPU wake lock does not. */
    Function("setKeepScreenOn") { enabled: Boolean ->
      engine.keepScreenOn(appContext.currentActivity, enabled)
    }

    View(MachaPlayerView::class) {
      // No props: transport commands go to the engine, not through re-renders.
    }
  }
}
