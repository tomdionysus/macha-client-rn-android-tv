import { requireNativeModule, requireNativeView } from 'expo';
import type * as React from 'react';
import type { ViewProps } from 'react-native';

export interface NativePlaybackEvent {
  positionMs: number;
  durationMs: number;
  paused: boolean;
  ended: boolean;
  seeking: boolean;
  buffering: boolean;
  bufferedRangesMs: { startMs: number; endMs: number }[];
  forwardBufferMs: number;
  streamOrigin?: string | null;
}

/** The evidence kinds core reasons about, mirrored from `PlaybackFailureKind`. */
export type NativeFailureKind = 'stream' | 'media' | 'unsupported' | 'not-ready' | 'unknown';

/**
 * What the player saw, not what it concluded.
 *
 * `httpStatus` is present when the failure carried one; core turns that into a
 * kind via `playbackFailureKindForStatus`, so the mapping is not duplicated
 * here. `platformKind` is the decoder's own evidence — whether *this* decoder
 * could handle the bytes — which is the part only the platform can answer.
 */
export interface NativeFailure {
  httpStatus?: number | null;
  platformKind?: NativeFailureKind | null;
  message: string;
}

export interface NativeCapabilities {
  platform: 'android';
  videoCodecs: string[];
  audioCodecs: string[];
  containers: string[];
  hlsFmp4: boolean;
  hlsTs: boolean;
  hlsVideoCodecs: string[];
  hlsAudioCodecs: string[];
  dash: boolean;
  hdr: string[];
  videoBitDepth: number;
  dolbyVision: number[];
  maxWidth: number | null;
  maxHeight: number | null;
}

export interface NativeDecoder {
  name: string;
  mimeType: string;
  hardwareAccelerated: boolean;
}

interface MachaPlayerNativeModule {
  capabilities(): NativeCapabilities;
  decoderInventory(): NativeDecoder[];
  play(
    url: string,
    mimeType: string | null,
    isManifest: boolean,
    positionMs: number,
    startPaused: boolean,
    headers: Record<string, string> | null,
    subtitleUrl: string | null,
  ): Promise<boolean>;
  pause(): void;
  resume(): void;
  seek(positionMs: number): void;
  setVolume(volume: number): void;
  stop(): void;
  release(): void;
  localSeekCoverage(): { startMs: number; endMs: number }[];
  setKeepScreenOn(enabled: boolean): void;
  addListener(event: 'onPlaybackEvent', listener: (event: NativePlaybackEvent) => void): { remove(): void };
  addListener(event: 'onFailure', listener: (event: NativeFailure) => void): { remove(): void };
  addListener(event: 'onDegradation', listener: (event: { message: string }) => void): { remove(): void };
}

export const MachaPlayer = requireNativeModule<MachaPlayerNativeModule>('MachaPlayer');

/** The video surface. Mounting is `attach`, unmounting is `detachHost`. */
export const MachaPlayerView: React.ComponentType<ViewProps> = requireNativeView('MachaPlayer');
