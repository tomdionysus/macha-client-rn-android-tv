import type { Platform, PlaybackCapabilities, Player } from '@machafoundation/core';
import { BackHandler } from 'react-native';
import type { VideoPlayer } from 'expo-video';
import { MachaPlayer, type NativeDecoder } from '../../modules/macha-player';
import { ExpoVideoAdapter } from '../player/ExpoVideoAdapter';

/**
 * The Android TV platform binding. `name` names the executor (ExoPlayer), not
 * the operating system.
 */
export class AndroidTvPlatform implements Platform {
  readonly name = 'android' as const;

  private cached?: PlaybackCapabilities;
  private displayRead = false;
  private displayCached?: { width: number; height: number };
  private player?: ExpoVideoAdapter;

  /**
   * What the hardware decodes, read once from `MediaCodecList` through the
   * native module: `expo-video` exposes no codec enumeration.
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
      // Decoder limits, never the panel's resolution.
      ...(native.maxWidth ? { maxWidth: native.maxWidth } : {}),
      ...(native.maxHeight ? { maxHeight: native.maxHeight } : {}),
      // Codecs whose decoders stop short of that limit; core's chooser holds
      // their streams to it.
      ...(native.videoCodecMaxSize && Object.keys(native.videoCodecMaxSize).length > 0
        ? { videoCodecMaxSize: native.videoCodecMaxSize }
        : {}),
    };

    this.cached = capabilities;
    return capabilities;
  }

  /**
   * The panel's physical mode, for the quality ceiling; undefined leaves
   * automatic play uncapped. Not React Native's window, which on `.133` is
   * 1920x1080 on a 3840x2160 panel. Read once.
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
   * The player core drives: `expo-video` (Media3 underneath), at the cost
   * `ExpoVideoAdapter` documents. Called once, from `PlaybackRuntime`.
   */
  createPlayer(): Player {
    this.player = new ExpoVideoAdapter();
    return this.player;
  }

  /**
   * The surface for `PlayerScreen`. Core's `PlaybackHost` is `unknown`, so the
   * screen cannot get it from the runtime.
   */
  videoPlayer(): VideoPlayer | undefined {
    return this.player?.video;
  }

  /**
   * A promoted standby is a second `VideoPlayer`, so `videoPlayer()` changes
   * and the screen must follow it.
   */
  subscribePlayerChange(listener: (player: VideoPlayer) => void): () => void {
    return this.player?.subscribePlayerChange(listener) ?? (() => undefined);
  }

  /** Presentation has let go of the player a promotion replaced. */
  releaseRetiredPlayer(): void {
    this.player?.releaseRetiredPlayer();
  }

  exitApplication(): void {
    BackHandler.exitApp();
  }

  /** Video codecs with no hardware decoder. For Settings; diagnostics only. */
  softwareOnlyVideoCodecs(): string[] {
    try {
      return MachaPlayer.capabilities().softwareOnlyVideoCodecs ?? [];
    } catch {
      return [];
    }
  }

  /** The raw decoder list, for the Status screen; diagnostics only. */
  decoders(): NativeDecoder[] {
    try {
      return MachaPlayer.decoderInventory();
    } catch {
      return [];
    }
  }
}

export const androidTvPlatform = new AndroidTvPlatform();
