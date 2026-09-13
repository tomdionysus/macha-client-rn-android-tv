package foundation.macha.player

import android.content.Context
import android.media.MediaCodecInfo.CodecProfileLevel
import android.media.MediaCodecList
import android.view.Display

/**
 * What this television can actually decode, read from `MediaCodecList`.
 *
 * This is the reason the app exists. The WebView client asks Chromium what it
 * can play, and Chromium ships no AC-3/E-AC-3 support whatever the panel is
 * wired to — so `canPlayType` answers `aac, opus, vorbis, mp3, flac`, the node
 * transcodes 5.1 E-AC-3 to 5.1 AAC, and Chromium hands AudioFlinger a
 * six-channel track with an *index* channel mask (0x8000003F) that the mixer
 * cannot fold down. The centre channel — the dialogue — is lost.
 *
 * The platform decoder list on the target set is much wider than the browser's:
 * measured on a TCL 55B6B (Android 11) it includes ac3, eac3, ac4, hevc, av01,
 * vp9 and mpeg2. Reading the hardware directly is what lets most of the library
 * direct-play with no transcode at all.
 *
 * Two honest limits on this enumeration, both from `docs/writing-a-player.md`:
 * `MediaCodecList` says nothing about **containers** — those are ExoPlayer's
 * extractor set, fixed at build time — so containers are curated below. And a
 * codec list answers "which decoders exist", not "will this file play", which
 * is why bit depth and HDR are reported as separate, independently-gated facts.
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
   * Containers ExoPlayer's `DefaultExtractorsFactory` can demux.
   *
   * Curated deliberately: this is not discoverable from the device, and a
   * codec list without the container that carries it is not a capability.
   * Getting this wrong is expensive in a specific way — advertising `mp3` as a
   * codec but not as a container made a node transcode every MP3 in the
   * library, burning CPU to produce something strictly worse than the original.
   * The bare audio containers are therefore listed explicitly.
   */
  private val CONTAINERS = listOf(
    "mp4", "m4v", "mov", "mkv", "matroska", "webm", "avi", "ts", "mpegts", "ps",
    "mp3", "m4a", "aac", "wav", "flac", "ogg", "oga", "opus",
  )

  /** Dolby Vision profile constants are powers of two; the exponent is the profile number. */
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

  /** Everything read off the device, kept so a person can see it on the Status screen. */
  data class Inventory(
    val videoCodecs: List<String>,
    val audioCodecs: List<String>,
    val decoders: List<Decoder>,
    val videoBitDepth: Int,
    val hdr: List<String>,
    val dolbyVision: List<Int>,
    val maxWidth: Int?,
    val maxHeight: Int?,
  )

  fun read(context: Context): Inventory {
    val video = sortedSetOf<String>()
    val audio = sortedSetOf<String>()
    val decoders = mutableListOf<Decoder>()
    val dolbyVision = sortedSetOf<Int>()
    var bitDepth = 8
    var maxWidth = 0
    var maxHeight = 0
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

        // `isHardwareAccelerated` needs API 29; below it, software decoders are
        // conventionally named. Reported for diagnostics only — a software
        // decoder is still a decoder and is not excluded from the claim.
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
            maxWidth = maxOf(maxWidth, v.supportedWidths.upper)
            maxHeight = maxOf(maxHeight, v.supportedHeights.upper)
          }
        }
      }
    }

    if (decoderTenBit) bitDepth = 10

    return Inventory(
      videoCodecs = video.toList(),
      audioCodecs = audio.toList(),
      decoders = decoders,
      videoBitDepth = bitDepth,
      hdr = transferCharacteristics(context, decoderPq.isNotEmpty(), decoderTenBit),
      // A profile the panel cannot present is a black picture, so the display
      // has to agree before any Dolby Vision profile is claimed.
      dolbyVision = if (displaySupports(context, Display.HdrCapabilities.HDR_TYPE_DOLBY_VISION)) {
        dolbyVision.toList()
      } else {
        emptyList()
      },
      // Real decoder limits, not the panel's resolution. Screen size is not a
      // decoder limit: claiming 1920x1080 on a set with a 4K-capable decoder
      // forces a transcode that buys nothing.
      maxWidth = maxWidth.takeIf { it > 0 },
      maxHeight = maxHeight.takeIf { it > 0 },
    )
  }

  /**
   * HDR transfers, gated on decode *and* presentation.
   *
   * Over-claiming here is the dangerous direction — an over-claimed capability
   * is a black screen, an under-claimed one is a transcode nobody needed — so
   * both halves must agree before a transfer is named. A codec probe alone is
   * not evidence that anything reaches the panel.
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
