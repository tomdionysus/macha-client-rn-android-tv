import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { trackLiveSession } from '../state/liveSessions';
import {
  PlaybackRuntime,
  type PlaybackHost,
  type PlaybackResolver,
  type PlaybackRuntimeOptions,
  type Platform,
} from '@machafoundation/core';

/**
 * The application-scoped playback runtime. `PlaybackRuntime` wraps
 * `PlaybackCoordinator`, which owns failover, stall recovery and standby
 * promotion; never drive `ClusterPlaybackResolver` directly.
 */
export function usePlaybackRuntime(
  platform: Platform,
  resolver: PlaybackResolver,
  options?: PlaybackRuntimeOptions,
) {
  // Keyed only by platform: replacing the runtime on a resolver change would
  // drop an active generation's presentation host.
  const runtime = useMemo(() => new PlaybackRuntime(platform, resolver, options), [platform]);
  const [state, setState] = useState(() => runtime.getSnapshot());

  useEffect(() => runtime.subscribeLifecycle(setState), [runtime]);

  // Record the live session durably (`state/liveSessions.ts`), at app scope
  // so it outlives the player screen.
  useEffect(
    () => runtime.subscribePlayback((snapshot) => trackLiveSession(snapshot?.session?.sessionId)),
    [runtime],
  );
  useEffect(() => {
    runtime.setResolver(resolver);
  }, [resolver, runtime]);
  useEffect(() => () => void runtime.dispose(), [runtime]);

  // Close the session on `background`, or the node keeps its transcode slot
  // and the next viewer gets a 429. Not `inactive`: on Android that is
  // transient, e.g. a dialog over the app.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'background') runtime.terminateForPageExit();
    });
    return () => subscription.remove();
  }, [runtime]);

  return { runtime, state };
}

/**
 * Bind a presentation surface. The host is an opaque token core compares by
 * identity; the native view binds itself to the engine.
 */
export function attachPlaybackHost(runtime: PlaybackRuntime, host: PlaybackHost): () => void {
  runtime.attach(host);
  return () => runtime.detach(host);
}
