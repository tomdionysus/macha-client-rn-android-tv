import { describe, expect, it } from 'vitest';
import { nextWatermark, progressWriteDue } from './progressPersistence';

const INTERVAL = 300_000;
const playing = { paused: false, durationMs: 7_200_000 };
const paused = { paused: true, durationMs: 7_200_000 };

/**
 * When a resume point is written, and — as much — when it is not.
 *
 * The motivating incident is measured: on 2026-09-22 at 20:42:15 the set
 * replaced Android System WebView and force-stopped this app at `adj 0`, in the
 * foreground, mid-use. A `SIGKILL` runs nothing — no `stop`, no unmount, no
 * final write — so the only resume point that survives is one already on disk.
 * `usePlaybackRuntime` makes the same argument for the live-session record:
 * *what survives a kill is what was live when the process died.*
 */
describe('when a resume point is due', () => {
  it('writes when playback pauses', () => {
    expect(progressWriteDue({ paused: false, wroteAtMs: 0 }, paused, 1_000, INTERVAL)).toBe('paused');
  });

  it('writes once for a pause, not on every snapshot while held there', () => {
    // Position is not moving, so a second write records nothing new — and this
    // store is backed by AsyncStorage, where a write per playback event on a
    // paused film is pure churn.
    expect(progressWriteDue({ paused: true, wroteAtMs: 1_000 }, paused, 2_000, INTERVAL)).toBeUndefined();
  });

  it('writes again on the next pause after a resume', () => {
    expect(progressWriteDue({ paused: false, wroteAtMs: 1_000 }, paused, 9_000, INTERVAL)).toBe('paused');
  });

  it('writes on the interval while playing', () => {
    expect(progressWriteDue({ paused: false, wroteAtMs: 0 }, playing, INTERVAL, INTERVAL)).toBe('interval');
  });

  it('does not write before the interval has elapsed', () => {
    expect(progressWriteDue({ paused: false, wroteAtMs: 0 }, playing, INTERVAL - 1, INTERVAL)).toBeUndefined();
  });

  it('does not run the interval while paused', () => {
    // Nothing is advancing, and the pause itself already wrote. A film left
    // paused overnight would otherwise rewrite the same position every five
    // minutes until the node reaps it.
    expect(progressWriteDue({ paused: true, wroteAtMs: 0 }, paused, INTERVAL * 10, INTERVAL)).toBeUndefined();
  });

  it('prefers the pause when a pause and an elapsed interval land together', () => {
    // Same write either way; naming it `paused` keeps the reason honest for
    // anyone reading a trail.
    expect(progressWriteDue({ paused: false, wroteAtMs: 0 }, paused, INTERVAL * 2, INTERVAL)).toBe('paused');
  });
});

/**
 * The two states where writing would record a falsehood.
 */
describe('when there is nothing worth recording', () => {
  it('writes nothing when there is no playback at all', () => {
    // The clean stop. Writing here would stamp a resume point at whatever the
    // last event happened to say, after the viewer had already left.
    expect(progressWriteDue({ paused: false, wroteAtMs: 0 }, undefined, INTERVAL * 5, INTERVAL)).toBeUndefined();
  });

  it('writes nothing until a duration is known', () => {
    // `closePlayer` has always guarded on this: a duration of zero makes the
    // progress fraction meaningless, and Continue Watching renders it as an
    // item with no position at all.
    expect(
      progressWriteDue({ paused: false, wroteAtMs: 0 }, { paused: false, durationMs: 0 }, INTERVAL, INTERVAL),
    ).toBeUndefined();
  });

  it('writes nothing on a pause before a duration is known', () => {
    expect(
      progressWriteDue({ paused: false, wroteAtMs: 0 }, { paused: true, durationMs: 0 }, 1_000, INTERVAL),
    ).toBeUndefined();
  });
});

/**
 * The hole the television found, which no unit test had: a write core declines
 * must not count as a write.
 */
describe('after an attempted write', () => {
  it('advances the clock when the entry landed', () => {
    expect(nextWatermark({ paused: false, wroteAtMs: 10 }, false, 5_000, true)).toEqual({
      paused: false,
      wroteAtMs: 5_000,
    });
  });

  it('leaves the clock alone when core declined the entry', () => {
    // Core stores nothing below 30 s of position and reports it by returning a
    // list the entry is absent from. Advancing here pushed the next attempt a
    // full interval out, so a film killed at seventy seconds recorded nothing —
    // measured on the set, 2026-09-22.
    expect(nextWatermark({ paused: false, wroteAtMs: 10 }, false, 5_000, false)).toEqual({
      paused: false,
      wroteAtMs: 10,
    });
  });

  it('tracks the pause either way, because that edge is not about storage', () => {
    expect(nextWatermark({ paused: false, wroteAtMs: 10 }, true, 5_000, false).paused).toBe(true);
    expect(nextWatermark({ paused: true, wroteAtMs: 10 }, false, 5_000, true).paused).toBe(false);
  });
});
