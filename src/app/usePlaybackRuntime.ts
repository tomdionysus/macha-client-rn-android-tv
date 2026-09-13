import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  PlaybackRuntime,
  type MediaSummary,
  type PlaybackHost,
  type PlaybackResolver,
  type PlaybackRuntimeOptions,
  type Platform,
} from '@macha/core';

/**
 * The application-scoped playback runtime.
 *
 * `PlaybackRuntime` wraps `PlaybackCoordinator`, and going through it is the
 * single most important architectural decision in this client. Driving
 * `ClusterPlaybackResolver` directly — as the phone app does — skips the
 * coordinator, and with it node failover, stall detection, standby promotion
 * and the segment-container handling. Those are not features to add later;
 * they are what the coordinator already does for any host that hands it a
 * `Player`.
 */
export function usePlaybackRuntime(
  platform: Platform,
  resolver: PlaybackResolver,
  options?: PlaybackRuntimeOptions,
) {
  // Keyed only by platform. A resolver change is applied to the existing
  // runtime rather than replacing the app-scoped player, which would drop an
  // active generation's presentation host.
  const runtime = useMemo(() => new PlaybackRuntime(platform, resolver, options), [platform]);
  const [state, setState] = useState(() => runtime.getSnapshot());

  useEffect(() => runtime.subscribeLifecycle(setState), [runtime]);
  useEffect(() => {
    runtime.setResolver(resolver);
  }, [resolver, runtime]);
  useEffect(() => () => void runtime.dispose(), [runtime]);

  /**
   * Tell the runtime the host is going away.
   *
   * Nothing in core can decide this, and getting it wrong is invisible from the
   * client: nothing breaks locally, but the server keeps holding the session,
   * and with one transcode slot per node the *next* viewer gets a 429.
   *
   * `pagehide` is the browser's answer and does not exist here. A television
   * app that is backgrounded is genuinely not playing — unlike a backgrounded
   * browser tab, which legitimately is — so `background` is the right signal on
   * this platform. `inactive` is deliberately not used: on Android it is a
   * transient state during transitions, and terminating on it would end
   * playback for a dialog appearing over the app.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') runtime.terminateForPageExit();
    });
    return () => subscription.remove();
  }, [runtime]);

  return { runtime, state };
}

/**
 * Bind a presentation surface to the runtime.
 *
 * The host is an opaque token: core compares it by identity and hands it to
 * `player.attach()` without ever inspecting it, which is why `PlaybackHost` is
 * `unknown`. This client passes a stable empty object, because the native view
 * binds itself to the engine when it mounts and there is no handle to carry.
 */
export function attachPlaybackHost(runtime: PlaybackRuntime, host: PlaybackHost): () => void {
  runtime.attach(host);
  return () => runtime.detach(host);
}

/** Convenience type for the runtime's `facts` binding. */
export type PlaybackFactsLookup = (media: MediaSummary) => ReturnType<PlaybackRuntimeOptions['facts'] & {}>;
