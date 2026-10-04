package foundation.macha.player

import android.app.Activity
import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.view.WindowManager
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.media3.datasource.TransferListener
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy
import androidx.media3.exoplayer.upstream.LoadErrorHandlingPolicy

/**
 * The ExoPlayer instance behind core's `Player` interface. One long-lived
 * engine, not one per view: `detachHost()` unbinds presentation and keeps
 * playing, so the engine must outlive its surface.
 */
class PlayerEngine(private val context: Context) {

  /**
   * First-byte wait for a fragment. Calibrated against the server's 6000 ms
   * segment hold (core's `SERVER_SEGMENT_HOLD_MS`): a held request
   * sends no bytes, so a shorter deadline fails a healthy node over as a
   * network fault. Clears the hold by 9000 ms; moves if the hold changes.
   */
  private val readTimeoutMs = 15_000

  /** media3's default; independent of the segment hold. */
  private val connectTimeoutMs = 8_000

  private val handler = Handler(Looper.getMainLooper())

  /**
   * Runs on ExoPlayer's looper, which it throws off of. Expo's synchronous
   * `Function` has no `runOnQueue`, so the marshalling is here. Inline when
   * already on main, so `attach` is not deferred a frame.
   */
  private inline fun onMain(crossinline block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else handler.post { block() }
  }

  /**
   * Last known seekable extent, for `localSeekCoverage()` to answer on the JS
   * thread. Refreshed each event tick, so at most one tick stale.
   */
  @Volatile
  private var seekableDurationMs = 0L

  var player: ExoPlayer? = null
    private set

  /** Query/credential-free origin currently serving bytes, for `streamOrigin`. */
  @Volatile
  private var streamOrigin: String? = null

  /** From `PlaybackSource.isManifest`; never sniffed. */
  private var currentIsManifest = false

  /**
   * True between a seek being issued and resolved: `STATE_BUFFERING` alone
   * cannot tell a seek from a stall.
   */
  @Volatile
  private var seeking = false

  var onEvent: ((Map<String, Any?>) -> Unit)? = null
  /** (httpStatus or -1, platformKind or null, message): evidence, not a verdict. */
  var onFailure: ((Int, String?, String) -> Unit)? = null
  var onDegradation: ((String) -> Unit)? = null

  private val ticker = object : Runnable {
    override fun run() {
      emitEvent()
      handler.postDelayed(this, TICK_MS)
    }
  }

  private companion object {
    /**
     * Transport tick while playing. Presentation only (a continuous-looking
     * scrubber); unrelated to any server or network deadline.
     */
        const val TICK_MS = 250L
  }

  fun ensurePlayer(): ExoPlayer {
    player?.let { return it }

    // Platform decoders only: they hand AudioTrack a positional channel mask,
    // so the set's downmix keeps the centre channel. Extension renderers would
    // substitute bundled software decoders.
    val renderers = DefaultRenderersFactory(context)
      .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF)
      .setEnableDecoderFallback(true)

    val created = ExoPlayer.Builder(context, renderers)
      .setMediaSourceFactory(DefaultMediaSourceFactory(httpDataSourceFactory()))
      .setSeekBackIncrementMs(10_000)
      .setSeekForwardIncrementMs(30_000)
      .build()

    // `handleAudioFocus = true`: pause on permanent focus loss, duck on transient.
    created.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
        .build(),
      /* handleAudioFocus = */ true,
    )

    // CPU wake lock only; the screen is held by FLAG_KEEP_SCREEN_ON.
    created.setWakeMode(C.WAKE_MODE_NETWORK)

    created.addListener(PlayerListener())
    player = created
    return created
  }

  private fun httpDataSourceFactory(): DefaultHttpDataSource.Factory =
    DefaultHttpDataSource.Factory()
      .setConnectTimeoutMs(connectTimeoutMs)
      .setReadTimeoutMs(readTimeoutMs)
      .setAllowCrossProtocolRedirects(true)
      .setTransferListener(object : TransferListener {
        override fun onTransferInitializing(source: androidx.media3.datasource.DataSource, spec: DataSpec, isNetwork: Boolean) = Unit
        override fun onTransferStart(source: androidx.media3.datasource.DataSource, spec: DataSpec, isNetwork: Boolean) {
          // The node serving bytes, which after a direct-source promotion may
          // not be the one that negotiated the session.
          if (isNetwork) streamOrigin = spec.uri.let { "${it.scheme}://${it.authority}" }
        }
        override fun onBytesTransferred(source: androidx.media3.datasource.DataSource, spec: DataSpec, isNetwork: Boolean, bytesTransferred: Int) = Unit
        override fun onTransferEnd(source: androidx.media3.datasource.DataSource, spec: DataSpec, isNetwork: Boolean) = Unit
      })

  fun play(
    url: String,
    mimeType: String?,
    isManifest: Boolean,
    positionMs: Long,
    startPaused: Boolean,
    headers: Map<String, String>,
    subtitleUrl: String?,
  ) = onMain {
    val exo = ensurePlayer()
    currentIsManifest = isManifest
    streamOrigin = Uri.parse(url).let { "${it.scheme}://${it.authority}" }

    val factory = httpDataSourceFactory().apply {
      if (headers.isNotEmpty()) setDefaultRequestProperties(headers)
    }

    val itemBuilder = MediaItem.Builder().setUri(url)
    mimeType?.let { itemBuilder.setMimeType(it) }
    subtitleUrl?.let {
      itemBuilder.setSubtitleConfigurations(
        listOf(
          MediaItem.SubtitleConfiguration.Builder(Uri.parse(it))
            .setMimeType(subtitleMimeType(it))
            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
            .build(),
        ),
      )
    }
    val item = itemBuilder.build()

    // The source states manifest or progressive: an undeclared .m3u8 is parsed
    // as a media file and reported as a source error.
    val source: MediaSource = if (isManifest) {
      HlsMediaSource.Factory(factory)
        .setLoadErrorHandlingPolicy(SegmentHoldAwarePolicy())
        .setAllowChunklessPreparation(true)
        .createMediaSource(item)
    } else {
      ProgressiveMediaSource.Factory(factory)
        .setLoadErrorHandlingPolicy(SegmentHoldAwarePolicy())
        .createMediaSource(item)
    }

    exo.setMediaSource(source)
    exo.prepare()
    if (positionMs > 0) exo.seekTo(positionMs)
    exo.playWhenReady = !startPaused
    startTicking()
  }

  fun pause() = onMain { player?.playWhenReady = false }

  fun resume() = onMain { player?.playWhenReady = true }

  fun seek(positionMs: Long) = onMain {
    seeking = true
    player?.seekTo(positionMs)
    emitEvent()
  }

  fun setVolume(volume: Float) = onMain { player?.volume = volume.coerceIn(0f, 1f) }

  /** Releases source-side resources and cancels acquisition; keeps the engine. */
  fun stop() = onMain {
    stopTicking()
    player?.let {
      it.stop()
      it.clearMediaItems()
    }
    streamOrigin = null
    emitEvent()
  }

  /** Final destruction. */
  fun release() = onMain {
    stopTicking()
    player?.release()
    player = null
  }

  /**
   * Generation-local seekable ranges, in the same window-relative coordinates
   * as `currentPosition` and `seek()`. For a transcode, zero is the generation
   * start.
   */
  fun localSeekCoverage(): List<Map<String, Long>> {
    val duration = seekableDurationMs
    if (duration <= 0) return emptyList()
    return listOf(mapOf("startMs" to 0L, "endMs" to duration))
  }

  fun keepScreenOn(activity: Activity?, enabled: Boolean) {
    val target = activity ?: return
    target.runOnUiThread {
      if (enabled) {
        target.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      } else {
        target.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
      }
    }
  }

  private fun subtitleMimeType(url: String): String = when {
    url.contains(".vtt", ignoreCase = true) -> MimeTypes.TEXT_VTT
    url.contains(".srt", ignoreCase = true) -> MimeTypes.APPLICATION_SUBRIP
    url.contains(".ass", ignoreCase = true) || url.contains(".ssa", ignoreCase = true) -> MimeTypes.TEXT_SSA
    else -> MimeTypes.TEXT_VTT
  }

  private fun startTicking() {
    handler.removeCallbacks(ticker)
    handler.post(ticker)
  }

  private fun stopTicking() {
    handler.removeCallbacks(ticker)
  }

  private fun emitEvent() {
    val exo = player ?: return
    val duration = exo.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0L
    val position = exo.currentPosition.coerceAtLeast(0L)
    val buffered = exo.bufferedPosition.coerceAtLeast(position)
    seekableDurationMs = if (exo.isCurrentMediaItemSeekable) duration else 0L

    onEvent?.invoke(
      mapOf(
        "positionMs" to position,
        "durationMs" to duration,
        "paused" to !exo.playWhenReady,
        "ended" to (exo.playbackState == Player.STATE_ENDED),
        "seeking" to (seeking && exo.playbackState == Player.STATE_BUFFERING),
        "buffering" to (exo.playbackState == Player.STATE_BUFFERING),
        // ExoPlayer exposes one contiguous run, not a range set.
        "bufferedRangesMs" to listOf(mapOf("startMs" to position, "endMs" to buffered)),
        "forwardBufferMs" to (buffered - position).coerceAtLeast(0L),
        "streamOrigin" to streamOrigin,
      ),
    )
  }

  private inner class PlayerListener : Player.Listener {
    override fun onPlaybackStateChanged(state: Int) {
      if (state == Player.STATE_READY) seeking = false
      emitEvent()
      if (state == Player.STATE_ENDED || state == Player.STATE_IDLE) stopTicking() else startTicking()
    }

    override fun onPositionDiscontinuity(
      oldPosition: Player.PositionInfo,
      newPosition: Player.PositionInfo,
      reason: Int,
    ) {
      if (reason == Player.DISCONTINUITY_REASON_SEEK) seeking = true
      emitEvent()
    }

    override fun onIsPlayingChanged(isPlaying: Boolean) {
      emitEvent()
      if (isPlaying) startTicking()
    }

    override fun onPlayerError(error: PlaybackException) {
      stopTicking()
      onFailure?.invoke(httpStatusOf(error), platformKindOf(error), error.message ?: error.errorCodeName)
    }
  }

  /**
   * The HTTP status behind a failure, or -1.
   *
   * Local stand-in: the status-to-kind mapping is protocol and belongs in
   * `@machafoundation/core` as `playbackFailureKindForStatus(status)`. A `500`
   * here is `segment_not_ready`, a hold rather than a failure.
   */
  private fun httpStatusOf(error: PlaybackException): Int {
    var cause: Throwable? = error.cause
    while (cause != null) {
      if (cause is HttpDataSource.InvalidResponseCodeException) return cause.responseCode
      cause = cause.cause
    }
    return -1
  }

  /**
   * Evidence only the decoder can give, or null when the failure was an HTTP
   * status. Decoder failures are `media`/`unsupported`, never `stream`: they
   * would fail identically on every node.
   */
  private fun platformKindOf(error: PlaybackException): String? {
    if (httpStatusOf(error) != -1) return null

    var cause: Throwable? = error.cause
    while (cause != null) {
      if (cause is HttpDataSource.HttpDataSourceException) return "stream"
      cause = cause.cause
    }

    return when (error.errorCode) {
      PlaybackException.ERROR_CODE_DECODING_FORMAT_UNSUPPORTED,
      PlaybackException.ERROR_CODE_DECODER_INIT_FAILED,
      PlaybackException.ERROR_CODE_DECODER_QUERY_FAILED,
      -> "unsupported"

      PlaybackException.ERROR_CODE_PARSING_CONTAINER_MALFORMED,
      PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED,
      PlaybackException.ERROR_CODE_PARSING_CONTAINER_UNSUPPORTED,
      PlaybackException.ERROR_CODE_PARSING_MANIFEST_UNSUPPORTED,
      PlaybackException.ERROR_CODE_DECODING_FAILED,
      -> "media"

      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT,
      PlaybackException.ERROR_CODE_IO_BAD_HTTP_STATUS,
      PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND,
      PlaybackException.ERROR_CODE_IO_UNSPECIFIED,
      -> "stream"

      else -> null
    }
  }

  /**
   * Retries a held fragment on the same node with exponential backoff; no
   * other node has that fragment. Calibrated against the 6000 ms segment hold
   * (asserted): the 1 s floor avoids pure load, and the 8 s ceiling keeps the
   * total inside the coordinator's recovery window.
   */
  private inner class SegmentHoldAwarePolicy : DefaultLoadErrorHandlingPolicy() {
    override fun getRetryDelayMsFor(info: LoadErrorHandlingPolicy.LoadErrorInfo): Long {
      val cause = info.exception
      if (cause is HttpDataSource.InvalidResponseCodeException && cause.responseCode == 500) {
        val attempt = info.errorCount.coerceAtLeast(1)
        return (1_000L * (1L shl (attempt - 1).coerceAtMost(4))).coerceAtMost(8_000L)
      }
      return super.getRetryDelayMsFor(info)
    }

    override fun getMinimumLoadableRetryCount(dataType: Int): Int = 6
  }
}
