import { useEffect, useRef } from 'react';
import {
  isFinished,
  nextWatermark,
  progressWriteDue,
  type ContinueWatchingStore,
  type MediaSummary,
  type PlaybackRuntime,
  type ProgressWatermark,
} from '@machafoundation/core';
import {
  CONTINUE_WATCHING_TICK_MS,
  CONTINUE_WATCHING_WRITE_INTERVAL_MS,
} from '../player/timingBudgets';
import { attributableProgress } from './progressAttribution';

/**
 * Writes the viewer's place while they watch, so a killed process loses at
 * most one interval. The rule is core's (`progressWriteDue`, `nextWatermark`).
 * At app scope so it outlives the player screen. Evaluated on every snapshot
 * (a pause is recorded at once) and on a tick (snapshots may not arrive while
 * a film plays).
 */
export function useContinueWatchingWriter(
  runtime: PlaybackRuntime,
  continueWatching: ContinueWatchingStore,
  /** What is playing, read at write time — never captured. */
  media: MediaSummary | undefined,
): void {
  const mediaRef = useRef(media);
  mediaRef.current = media;
  const watermark = useRef<ProgressWatermark>({ paused: true, wroteAtMs: 0, attemptedAtMs: 0 });

  useEffect(() => {
    const evaluate = (): void => {
      const snapshot = runtime.getPlaybackSnapshot();
      const now = Date.now();

      if (!snapshot) {
        // Between films: reset so the next does not inherit this one's clock.
        watermark.current = { paused: true, wroteAtMs: 0, attemptedAtMs: 0 };
        return;
      }

      const current = { paused: snapshot.intent.paused, durationMs: snapshot.event.durationMs };
      const due = progressWriteDue(
        watermark.current,
        current,
        now,
        CONTINUE_WATCHING_WRITE_INTERVAL_MS,
        CONTINUE_WATCHING_TICK_MS,
      );
      if (!due) {
        watermark.current = { ...watermark.current, paused: current.paused };
        return;
      }

      const playing = mediaRef.current;
      if (!playing) {
        // The route has gone but the runtime has not stopped: no media to attach.
        watermark.current = { ...watermark.current, paused: current.paused };
        return;
      }

      // Only ever the media the player is actually on: see `attributableProgress`.
      const progress = attributableProgress(snapshot, playing);
      if (!progress) {
        watermark.current = { ...watermark.current, paused: current.paused };
        return;
      }

      if (isFinished(progress)) {
        // Core drops a finished item; `closePlayer` removes it once on the way out.
        watermark.current = nextWatermark(watermark.current, current.paused, now, true);
        return;
      }

      // Core may decline (nothing below 30 s is stored); read the outcome.
      const stored = continueWatching.update(progress);
      const landed = stored.some((entry) => entry.itemId === progress.itemId);
      watermark.current = nextWatermark(watermark.current, current.paused, now, landed);
    };

    const unsubscribe = runtime.subscribePlayback(evaluate);
    const tick = setInterval(evaluate, CONTINUE_WATCHING_TICK_MS);
    return () => {
      clearInterval(tick);
      unsubscribe();
    };
  }, [runtime, continueWatching]);
}
