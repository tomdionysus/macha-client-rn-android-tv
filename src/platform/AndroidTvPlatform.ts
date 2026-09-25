import type { Platform, PlaybackCapabilities, Player } from '@machafoundation/core';
import { BackHandler } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { MachaPlayer, type NativeDecoder } from '../../modules/macha-player';
import { ExpoVideoAdapter } from '../player/ExpoVideoAdapter';

/**
 * The Android TV platform binding.
 *
 * `name` is `'android'` because the field names the *executor*, not the
 * operating system — this is ExoPlayer, the same as the phone client, and
 * saying `'web'` would be a claim nothing on the wire could catch.
 */
export class AndroidTvPlatform implements Platform {
  readonly name = 'android' as const;

  private cached?: PlaybackCapabilities;
  private displayRead = false;
  private displayCached?: { width: number; height: number };
  private player?: ExpoVideoAdapter;

  /**
   * What the hardware decodes, read once from `MediaCodecList`.
   *
   * The measurement is why this client exists. On the target set the platform
   * decoders include ac3, eac3, hevc and av01; Chromium in the WebView reports
   * `aac, opus, vorbis, mp3, flac` and forces the node to transcode 5.1 E-AC-3
   * to AAC, losing the centre channel in a downmix the mixer cannot perform.
   *
   * This stays on the native module even though playback moved to
   * `expo-video`, which exposes no codec enumeration at all. The phone client
   * answers this from a hardcoded conservative list, and doing that here would
   * make the node transcode AC-4, AV1 and Dolby Vision that the panel decodes
   * natively — defeating the point of the client to save a native dependency
   * that is already built.
   */
  async capabilities(): Promise<PlaybackCapabilities> {
    if (this.cached) return this.cached;

    const native = MachaPlayer.capabilities();
    const capabilities: PlaybackCapabilities = {
      platform: 'android',
      videoCodecs: native.videoCodecs,
      audioCodecs: native.audioCodecs,
      containers: native.containers,
      hlsFmp4: native.hlsFmp4,
      hlsTs: native.hlsTs,
      hlsVideoCodecs: native.hlsVideoCodecs,
      hlsAudioCodecs: native.hlsAudioCodecs,
      dash: native.dash,
      hdr: native.hdr,
      videoBitDepth: native.videoBitDepth,
      ...(native.dolbyVision.length > 0 ? { dolbyVision: native.dolbyVision } : {}),
      // Real decoder limits when the device reports them. Never the panel's
      // resolution: screen size is not a decoder limit, and claiming 1920x1080
      // on a set whose decoder handles 4K forces a transcode that buys nothing.
      ...(native.maxWidth ? { maxWidth: native.maxWidth } : {}),
      ...(native.maxHeight ? { maxHeight: native.maxHeight } : {}),
    };

    this.cached = capabilities;
    return capabilities;
  }

  /**
   * The panel's physical mode, for the quality ceiling; undefined where the
   * platform reports none, which leaves automatic play uncapped by the display.
   *
   * **The panel's, not the UI's.** React Native's window on `.133` is
   * 1920x1080 while the panel runs 3840x2160 (Tom, 2026-09-25: the display
   * class this TV states is the panel's), and capping at the UI would keep a
   * 4K set off its 4K files. Read once: the mode is the set's, not the app's.
   * Not a capability either — screen size is not a decoder limit (above).
   */
  display(): { width: number; height: number } | undefined {
    if (!this.displayRead) {
      this.displayRead = true;
      try {
        const mode = MachaPlayer.displayMode();
        if (mode && mode.width > 0 && mode.height > 0) this.displayCached = mode;
      } catch {
        this.displayCached = undefined;
      }
    }
    return this.displayCached;
  }

  /**
   * The player core drives.
   *
   * `expo-video` rather than the native `ExoPlayerAdapter` in this tree, on
   * Tom's decision of 2026-09-10: it is the proven component, this client has
   * never been run, and it is Media3 underneath so the hardware-decoder
   * premise is unaffected. `ExpoVideoAdapter`'s own comment records what that
   * costs — seamless failover most of all. Called once, from the
   * `PlaybackRuntime` constructor.
   */
  createPlayer(): Player {
    this.player = new ExpoVideoAdapter();
    return this.player;
  }

  /**
   * The surface for `PlayerScreen` to render.
   *
   * Core never carries a presentation handle — `PlaybackHost` is `unknown` and
   * compared by identity — so the screen cannot get this from the runtime.
   * Presentation only; nothing here is playback policy.
   */
  videoPlayer(): VideoPlayer | undefined {
    return this.player?.video;
  }

  /**
   * Follow the active player across a promotion.
   *
   * A warm standby is a second `VideoPlayer`, so promoting it changes which
   * instance `videoPlayer()` returns. A screen that read it once would keep
   * rendering the player that was just released.
   */
  subscribePlayerChange(listener: (player: VideoPlayer) => void): () => void {
    return this.player?.subscribePlayerChange(listener) ?? (() => undefined);
  }

  /** Presentation confirming it has let go of the player a promotion replaced. */
  releaseRetiredPlayer(): void {
    this.player?.releaseRetiredPlayer();
  }

  exitApplication(): void {
    BackHandler.exitApp();
  }

  /** The raw decoder list, for the Status screen. Diagnostics, not policy. */
  decoders(): NativeDecoder[] {
    try {
      return MachaPlayer.decoderInventory();
    } catch {
      return [];
    }
  }
}

export const androidTvPlatform = new AndroidTvPlatform();
