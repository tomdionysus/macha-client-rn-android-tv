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
 * The ExoPlayer instance behind core's `Player` interface.
 *
 * Deliberately a single long-lived engine rather than one per view. Core draws
 * a hard line between `detachHost()` (unbind presentation, keep playing) and
 * `detach()` (destroy) — conflating them means a view remount silently kills
 * playback — so the engine has to outlive the surface it draws into.
 */
class PlayerEngine(private val context: Context) {

  /**
   * How long to wait for a fragment's first byte.
   *
   * Calibrated against the **server's 6000 ms segment hold**, not chosen
   * freely. A node near the production frontier holds a request for a fragment
   * it has not produced yet and then answers `500 segment_not_ready`. A held
   * request sends no bytes, so any read deadline below the hold means the
   * client aborts first and takes its timeout path — which looks like a network
   * fault and gets treated as one, failing a healthy node over for doing
   * exactly what it was asked.
   *
   * media3's own `DEFAULT_READ_TIMEOUT_MILLIS` is 8000, which clears 6000 by a
   * margin that — per `docs/writing-a-player.md` — was read out of a shipped
   * artifact and has never been confirmed against a running client. 15000 is
   * set explicitly here so the margin is stated rather than inherited: it
   * clears the hold by 9000 ms, and it is the only number in this file that
   * must move if the server's hold changes.
   */
  private val readTimeoutMs = 15_000

  /** Connect is a separate question from the hold and keeps media3's default. */
  private val connectTimeoutMs = 8_000

  private val handler = Handler(Looper.getMainLooper())

  /**
   * Run on the thread ExoPlayer was built on.
   *
   * Every ExoPlayer instance is bound to one looper and throws if touched from
   * another. Expo's synchronous `Function` runs on the JS thread and offers no
   * queue selection — only `AsyncFunction` has `runOnQueue` — so the marshalling
   * belongs here rather than in the module definition. Running inline when
   * already on main keeps `attach` from being deferred a frame behind the view.
   */
  private inline fun onMain(crossinline block: () -> Unit) {
    if (Looper.myLooper() == Looper.getMainLooper()) block() else handler.post { block() }
  }

  /**
   * Last known seekable extent, readable without touching the player.
   *
   * `localSeekCoverage()` has to answer synchronously on the JS thread, which
   * cannot ask ExoPlayer anything. The value is refreshed on every event tick
   * from the main thread, so it is at most one tick stale — and a seek target
   * is validated by the player again anyway.
   */
  @Volatile
  private var seekableDurationMs = 0L

  var player: ExoPlayer? = null
    private set

  /** Query/credential-free origin currently serving bytes, for `streamOrigin`. */
  @Volatile
  private var streamOrigin: String? = null

  /** Set by the JS layer from `PlaybackSource.isManifest` — never sniffed. */
  private var currentIsManifest = false

  /**
   * True between a seek being issued and the player resolving it.
   *
   * Tracked explicitly because `STATE_BUFFERING` alone cannot distinguish a
   * seek from a stall, and the two mean opposite things to a viewer: one is
   * their own input being served, the other is the stream in trouble.
   */
  @Volatile
  private var seeking = false

  var onEvent: ((Map<String, Any?>) -> Unit)? = null
  /** (httpStatus or -1, platformKind or null, message) — evidence, not a verdict. */
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
     * Transport tick while playing.
     *
     * 250 ms is a presentation choice, not a protocol one: it is the coarsest
     * interval at which a scrubber and an elapsed-time readout still look
     * continuous to a viewer sitting three metres away. It is unrelated to any
     * server or network deadline, and nothing in core reads it.
     */
        const val TICK_MS = 250L
  }

  fun ensurePlayer(): ExoPlayer {
    player?.let { return it }

    // Platform decoders only. This is the entire point of the app: ExoPlayer
    // uses the TV's own AC-3/E-AC-3/HEVC decoders and, for multichannel audio,
    // hands AudioTrack a *positional* channel mask so the set's own downmix
    // keeps the centre channel. Extension renderers would substitute bundled
    // software decoders and give back exactly the problem being escaped.
    val renderers = DefaultRenderersFactory(context)
      .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_OFF)
      .setEnableDecoderFallback(true)

    val created = ExoPlayer.Builder(context, renderers)
      .setMediaSourceFactory(DefaultMediaSourceFactory(httpDataSourceFactory()))
      .setSeekBackIncrementMs(10_000)
      .setSeekForwardIncrementMs(30_000)
      .build()

    // `handleAudioFocus = true` makes ExoPlayer request AUDIOFOCUS_GAIN when it
    // starts and abandon it when it stops, pausing on permanent loss and
    // ducking on transient. The WebView client held no focus at all, so a
    // system sound or a voice assistant played over the film instead of
    // interrupting it.
    created.setAudioAttributes(
      AudioAttributes.Builder()
        .setUsage(C.USAGE_MEDIA)
        .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
        .build(),
      /* handleAudioFocus = */ true,
    )

    // Holds a CPU wake lock across playback. The *screen* is kept awake
    // separately via FLAG_KEEP_SCREEN_ON, because a television runs its
    // dim/screensaver/sleep sequence on the display regardless of the CPU.
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
          // Which node is actually serving bytes, which after a direct-source
          // promotion is not necessarily the node that negotiated the session.
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

    // Never sniff manifest versus progressive — the source states it. Handing
    // ExoPlayer an .m3u8 without declaring it makes it parse the playlist as a
    // media file and report a source error.
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

  /** Release source-side resources and cancel acquisition, keeping the engine. */
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
   * Generation-local seekable ranges.
   *
   * ExoPlayer's `currentPosition` is already relative to the current window's
   * start, so it needs no origin normalisation — and `seek()` above uses the
   * same coordinate system, which is the contract's actual requirement. For a
   * transcode the server produces the generation from its own seek point, so
   * ExoPlayer's zero *is* the generation start.
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
        // A single contiguous run is what ExoPlayer exposes; it does not
        // publish a full range set, so reporting one range is the honest shape.
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
   * Turn an ExoPlayer failure into the evidence kind core reasons about.
   *
   * Reporting a decoder failure as a stream failure sends the viewer around the
   * whole cluster to fail identically on every node, so anything the decoder
   * told us is reported as `media`/`unsupported` and never retried elsewhere.
   *
   * The `500` case is the one that is not a failure at all: a node holding a
   * fragment it has not produced yet answers `500 segment_not_ready`, which is
   * the node working correctly near the production frontier. Reported as
   * `not-ready` it costs nothing; reported as `stream` it prepares a standby on
   * another node that is producing a *different* generation and does not have
   * that fragment either.
   *
   * **The status-to-kind mapping below is protocol, not platform, and does not
   * belong in this file.** It is specified in `writing-a-player.md` and then
   * reimplemented by every client — the web one against hls.js, this one
   * against media3. It has been proposed for `@machafoundation/core` as
   * `playbackFailureKindForStatus(status)`. When that lands, this class should
   * report the raw HTTP status as evidence and let the TypeScript adapter apply
   * core's rule, so no protocol knowledge remains on the platform side. The
   * decoder-error branches below are genuinely ours and stay.
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
   * Evidence only the decoder can give.
   *
   * This is what genuinely belongs on the platform side: whether *this* decoder
   * could handle the bytes. Returns null when the failure was an HTTP status,
   * which core maps itself.
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
   * Retry a held fragment on the *same* node, backing off exponentially.
   *
   * Failing over cannot help a hold: the next node is producing a different
   * generation and does not have that fragment either. `Retry-After` on the
   * hold is only a hint, so the backoff is ours.
   *
   * The delays are calibrated against the same 6000 ms hold as the read
   * timeout: a held request already cost up to six seconds before answering, so
   * retrying sooner than a second is pure load, and the ceiling keeps total
   * wait inside the coordinator's own recovery window rather than racing it.
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
