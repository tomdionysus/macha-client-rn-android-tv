package foundation.macha.player

import android.content.Context
import android.media.MediaCodecInfo.CodecProfileLevel
import android.media.MediaCodecList
import android.view.Display

/**
 * What this television can decode, read from `MediaCodecList` rather than
 * asked of a browser, so AC-3/E-AC-3 and the rest direct-play.
 *
 * `MediaCodecList` says nothing about containers (curated below), and a codec
 * list is not "will this file play": bit depth and HDR are gated separately.
 */
object Capabilities {

  private val VIDEO_MIME = mapOf(
    "video/avc" to "h264",
    "video/hevc" to "hevc",
    "video/x-vnd.on2.vp8" to "vp8",
    "video/x-vnd.on2.vp9" to "vp9",
    "video/av01" to "av1",
    "video/mpeg2" to "mpeg2",
    "video/mp4v-es" to "mpeg4",
    "video/3gpp" to "h263",
  )

  private val AUDIO_MIME = mapOf(
    "audio/mp4a-latm" to "aac",
    "audio/ac3" to "ac3",
    "audio/eac3" to "eac3",
    "audio/eac3-joc" to "eac3",
    "audio/ac4" to "ac4",
    "audio/mpeg" to "mp3",
    "audio/mpeg-L2" to "mp2",
    "audio/vorbis" to "vorbis",
    "audio/opus" to "opus",
    "audio/flac" to "flac",
    "audio/raw" to "pcm",
    "audio/alac" to "alac",
    "audio/3gpp" to "amrnb",
    "audio/amr-wb" to "amrwb",
  )

  /**
   * Containers ExoPlayer's `DefaultExtractorsFactory` can demux; not
   * discoverable from the device. Bare audio containers are listed because a
   * codec claimed without its container makes a node transcode every such file.
   */
  private val CONTAINERS = listOf(
    "mp4", "m4v", "mov", "mkv", "matroska", "webm", "avi", "ts", "mpegts", "ps",
    "mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus",
  )

  /** Platform constant to Dolby Vision profile number. */
  private val DOLBY_VISION_PROFILES = mapOf(
    CodecProfileLevel.DolbyVisionProfileDvavPer to 0,
    CodecProfileLevel.DolbyVisionProfileDvavPen to 1,
    CodecProfileLevel.DolbyVisionProfileDvheDer to 2,
    CodecProfileLevel.DolbyVisionProfileDvheDen to 3,
    CodecProfileLevel.DolbyVisionProfileDvheDtr to 4,
    CodecProfileLevel.DolbyVisionProfileDvheStn to 5,
    CodecProfileLevel.DolbyVisionProfileDvheDth to 6,
    CodecProfileLevel.DolbyVisionProfileDvheDtb to 7,
    CodecProfileLevel.DolbyVisionProfileDvheSt to 8,
    CodecProfileLevel.DolbyVisionProfileDvavSe to 9,
  )

  private val TEN_BIT_PROFILES = setOf(
    CodecProfileLevel.HEVCProfileMain10,
    CodecProfileLevel.HEVCProfileMain10HDR10,
    CodecProfileLevel.HEVCProfileMain10HDR10Plus,
    CodecProfileLevel.VP9Profile2,
    CodecProfileLevel.VP9Profile2HDR,
    CodecProfileLevel.VP9Profile2HDR10Plus,
    CodecProfileLevel.VP9Profile3,
    CodecProfileLevel.VP9Profile3HDR,
    CodecProfileLevel.VP9Profile3HDR10Plus,
    CodecProfileLevel.AV1ProfileMain10,
    CodecProfileLevel.AV1ProfileMain10HDR10,
    CodecProfileLevel.AV1ProfileMain10HDR10Plus,
  )

  private val PQ_PROFILES = setOf(
    CodecProfileLevel.HEVCProfileMain10HDR10,
    CodecProfileLevel.HEVCProfileMain10HDR10Plus,
    CodecProfileLevel.VP9Profile2HDR,
    CodecProfileLevel.VP9Profile2HDR10Plus,
    CodecProfileLevel.VP9Profile3HDR,
    CodecProfileLevel.VP9Profile3HDR10Plus,
    CodecProfileLevel.AV1ProfileMain10HDR10,
    CodecProfileLevel.AV1ProfileMain10HDR10Plus,
  )

  data class Decoder(val name: String, val mimeType: String, val hardwareAccelerated: Boolean)

  /** Everything read off the device; shown on the Status screen. */
  data class Inventory(
    val videoCodecs: List<String>,
    val audioCodecs: List<String>,
    val decoders: List<Decoder>,
    val videoBitDepth: Int,
    val hdr: List<String>,
    val dolbyVision: List<Int>,
    val maxWidth: Int?,
    val maxHeight: Int?,
    /** Codecs whose own decoders stop short of `maxWidth` x `maxHeight`; see `read`. */
    val videoCodecMaxSize: Map<String, Pair<Int, Int>>,
    /** Codecs with no hardware decoder, whose size comes from a software one. Diagnostics. */
    val softwareOnlyVideoCodecs: List<String>,
  )

  fun read(context: Context): Inventory {
    val video = sortedSetOf<String>()
    val audio = sortedSetOf<String>()
    val decoders = mutableListOf<Decoder>()
    val dolbyVision = sortedSetOf<Int>()
    var bitDepth = 8
    val hardwareMax = mutableMapOf<String, Pair<Int, Int>>()
    val softwareMax = mutableMapOf<String, Pair<Int, Int>>()
    val decoderPq = mutableSetOf<Int>()
    var decoderTenBit = false

    val codecs = try {
      MediaCodecList(MediaCodecList.ALL_CODECS).codecInfos
    } catch (error: Throwable) {
      emptyArray()
    }

    for (info in codecs) {
      if (info.isEncoder) continue
      for (mimeType in info.supportedTypes) {
        val mime = mimeType.lowercase()

        // `isHardwareAccelerated` needs API 29; below it, go by the conventional
        // software names. Diagnostics only: software decoders still count.
        val hardware = if (android.os.Build.VERSION.SDK_INT >= 29) {
          runCatching { info.isHardwareAccelerated }.getOrDefault(false)
        } else {
          !info.name.startsWith("OMX.google.") && !info.name.startsWith("c2.android.")
        }
        decoders += Decoder(info.name, mime, hardware)

        VIDEO_MIME[mime]?.let { video += it }
        AUDIO_MIME[mime]?.let { audio += it }

        val capabilities = runCatching { info.getCapabilitiesForType(mimeType) }.getOrNull() ?: continue

        if (mime == "video/dolby-vision") {
          for (level in capabilities.profileLevels) {
            DOLBY_VISION_PROFILES[level.profile]?.let { dolbyVision += it }
          }
        }

        if (mime.startsWith("video/")) {
          for (level in capabilities.profileLevels) {
            if (level.profile in TEN_BIT_PROFILES) decoderTenBit = true
            if (level.profile in PQ_PROFILES) decoderPq += level.profile
          }
          runCatching {
            val v = capabilities.videoCapabilities ?: return@runCatching
            val sizes = if (hardware) hardwareMax else softwareMax
            val codec = VIDEO_MIME[mime] ?: mime
            val (w, h) = sizes[codec] ?: (0 to 0)
            sizes[codec] = maxOf(w, v.supportedWidths.upper) to maxOf(h, v.supportedHeights.upper)
          }
        }
      }
    }

    if (decoderTenBit) bitDepth = 10

    // Hardware first, software only for a codec with no hardware decoder: a
    // software decoder's declared size is what it accepts, not what the CPU
    // decodes in real time, and a stutter is not a failure the fallback sees.
    val codecMax = (hardwareMax.keys + softwareMax.keys).associateWith { codec ->
      hardwareMax[codec] ?: softwareMax.getValue(codec)
    }
    val softwareOnly = codecMax.keys.filter { it !in hardwareMax }
    val maxWidth = codecMax.values.maxOfOrNull { it.first } ?: 0
    val maxHeight = codecMax.values.maxOfOrNull { it.second } ?: 0

    return Inventory(
      videoCodecs = video.toList(),
      audioCodecs = audio.toList(),
      decoders = decoders,
      videoBitDepth = bitDepth,
      hdr = transferCharacteristics(context, decoderPq.isNotEmpty(), decoderTenBit),
      // Claimed only if the display agrees: an unpresentable profile is a black picture.
      dolbyVision = if (displaySupports(context, Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION)) {
        dolbyVision.toList()
      } else {
        emptyList()
      },
      // Decoder limits, not the panel's resolution.
      maxWidth = maxWidth.takeIf { it > 0 },
      maxHeight = maxHeight.takeIf { it > 0 },
      // Only codecs whose own largest frame is below the overall maximum
      // (VP8 on `.133` stops at 1080p).
      videoCodecMaxSize = codecMax
        .filterKeys { it in VIDEO_MIME.values }
        .filterValues { (w, h) -> w < maxWidth || h < maxHeight },
      softwareOnlyVideoCodecs = softwareOnly.filter { it in VIDEO_MIME.values }.sorted(),
    )
  }

  /**
   * HDR transfers, named only when decoder and display both support them:
   * an over-claim is a black screen, an under-claim only a transcode.
   */
  private fun transferCharacteristics(context: Context, decoderPq: Boolean, decoderTenBit: Boolean): List<String> {
    val transfers = mutableListOf<String>()
    val displayPq = displaySupports(context, Display.HdrCapabilities.HDR_TYPE_HDR10) ||
      displaySupports(context, Display.HdrCapabilities.HDR_TYPE_HDR10_PLUS)
    val displayHlg = displaySupports(context, Display.HdrCapabilities.HDR_TYPE_HLG)

    if (decoderPq && displayPq) transfers += "smpte2084"
    if (decoderTenBit && displayHlg) transfers += "arib-std-b67"
    return transfers
  }

  @Suppress("DEPRECATION")
  private fun displaySupports(context: Context, hdrType: Int): Boolean = runCatching {
    val manager = context.getSystemService(Context.DISPLAY_SERVICE) as android.hardware.display.DisplayManager
    val display = manager.getDisplay(Display.DEFAULT_DISPLAY) ?: return false
    display.hdrCapabilities?.supportedHdrTypes?.contains(hdrType) == true
  }.getOrDefault(false)

  fun containers(): List<String> = CONTAINERS
}
