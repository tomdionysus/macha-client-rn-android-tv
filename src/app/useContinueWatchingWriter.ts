import { useEffect, useRef } from 'react';
import {
  isFinished,
  progressFor,
  type ContinueWatchingStore,
  type MediaSummary,
  type PlaybackRuntime,
} from '@machafoundation/core';
import {
  CONTINUE_WATCHING_TICK_MS,
  CONTINUE_WATCHING_WRITE_INTERVAL_MS,
} from '../player/timingBudgets';
import {
  nextWatermark,
  progressWriteDue,
  type ProgressWatermark,
} from '../player/progressPersistence';

/**
 * Keep the viewer's place on disk while they are still watching.
 *
 * **At app scope rather than the player screen's, for the reason
 * `usePlaybackRuntime` gives for the live-session record**: the whole job of
 * this write is to outlive things, and a screen that unmounts when the viewer
 * presses Back would stop writing exactly when there is still something to
 * record. The two are the same rule applied to the two halves of a kill — that
 * one tracks what the *node* is still holding, this one tracks where the
 * *viewer* was.
 *
 * Until this existed the only write was in `closePlayer`, which runs when a
 * viewer leaves deliberately and never when the process is killed. `SIGKILL`
 * runs nothing; see `progressPersistence.ts` for the measured kill that
 * prompted it.
 *
 * Two triggers, because neither is sufficient alone: every playback snapshot,
 * so a pause is recorded when it happens rather than up to five minutes later;
 * and a tick, because snapshots cannot be relied on to keep arriving while a
 * film simply plays. `progressWriteDue` decides in both cases, so the rule
 * lives in one tested place rather than in two timers.
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
        // No playback is the boundary between one film and the next. Resetting
        // here stops the next film inheriting this one's clock and waiting a
        // full interval for its first attempt.
        //
        // It does **not** put the next film into Continue Watching
        // immediately, and an earlier version of this comment claimed it did:
        // core stores nothing below 30 s of position, so the earliest a film
        // can appear is the first tick after that — which is the right
        // behaviour, since something opened and abandoned inside half a minute
        // is not unfinished business.
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
        // The player route has gone but the runtime has not stopped yet. There
        // is nothing to attach the record to, and an entry saved without its
        // media renders in Continue Watching as a bare id.
        watermark.current = { ...watermark.current, paused: current.paused };
        return;
      }

      const progress = progressFor(playing, snapshot.event.positionMs, snapshot.event.durationMs);

      if (isFinished(progress)) {
        // Core drops a finished item from the list rather than storing a
        // position in it, so attempting this every tick through the closing
        // credits is a storage write per tick that removes an entry already
        // gone. `closePlayer` does the removal once, on the way out.
        watermark.current = nextWatermark(watermark.current, current.paused, now, true);
        return;
      }

      // **Core may decline this, and says so by returning a list without it** —
      // it stores nothing below 30 s of position. Read the outcome rather than
      // re-deriving the rule, so its floor can move without this moving.
      const stored = continueWatching.update(progress);
      const landed = stored.some((entry) => entry.mediaId === progress.mediaId);
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
