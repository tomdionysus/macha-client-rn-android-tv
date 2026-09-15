import { describe, expect, it } from 'vitest';
import type { ClientLogEntry } from '@machafoundation/core';
import { playbackFailureTrail } from './failureTrail';

function entry(overrides: Partial<ClientLogEntry> = {}): ClientLogEntry {
  return {
    sequence: 1,
    timestamp: '2026-09-13T00:00:00.000Z',
    elapsedMs: 1_000,
    level: 'warn',
    scope: 'playback',
    event: 'first-fragment-held',
    ...overrides,
  };
}

describe('playbackFailureTrail', () => {
  it('keeps only warnings and errors', () => {
    // A screen that also listed every routine step would bury the three lines
    // that matter under the fifty that do not.
    const trail = playbackFailureTrail([
      entry({ level: 'debug', event: 'tick' }),
      entry({ level: 'info', event: 'first-fragment' }),
      entry({ level: 'warn', event: 'stalled' }),
      entry({ level: 'error', event: 'failure' }),
    ]);

    expect(trail.map((line) => line.event)).toEqual(['playback stalled', 'playback failure']);
  });

  it('keeps the most recent entries, not the first', () => {
    // A cluster walk generates more than a dozen lines and the useful ones
    // are always the last.
    const many = Array.from({ length: 40 }, (_, index) =>
      entry({ event: `step-${index}`, elapsedMs: index }));

    const trail = playbackFailureTrail(many);

    expect(trail).toHaveLength(12);
    expect(trail.at(-1)?.event).toBe('playback step-39');
  });

  it('reads the message out of an Error rather than printing {}', () => {
    // An Error nested in a data object stringifies to `{}`, and the message
    // inside it is the whole point of the line.
    const trail = playbackFailureTrail([
      entry({ data: { cause: new Error('node refused the fragment') } }),
    ]);

    expect(trail[0]?.detail).toContain('node refused the fragment');
  });

  it('reads a bare Error too', () => {
    const trail = playbackFailureTrail([entry({ data: new Error('bare') })]);

    expect(trail[0]?.detail).toBe('bare');
  });

  it('truncates a long detail so older entries survive on screen', () => {
    const trail = playbackFailureTrail([entry({ data: { url: 'x'.repeat(500) } })]);

    expect(trail[0]?.detail?.length).toBeLessThan(140);
    expect(trail[0]?.detail?.endsWith('…')).toBe(true);
  });

  it('omits a detail rather than showing an empty object', () => {
    const trail = playbackFailureTrail([entry({ data: {} })]);

    expect(trail[0]?.detail).toBeUndefined();
  });

  it('survives a circular structure', () => {
    // Losing a log line is acceptable; losing the failure screen to one is not.
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    const trail = playbackFailureTrail([entry({ data: circular })]);

    expect(trail).toHaveLength(1);
    expect(trail[0]?.detail).toBeUndefined();
  });

  it('carries the elapsed time, which is what distinguishes the causes', () => {
    // The §1.2 question is whether a failover followed a rewind or a hold, and
    // that is answered by when the lines happened relative to each other.
    const trail = playbackFailureTrail([
      entry({ elapsedMs: 4_200, event: 'stalled' }),
      entry({ elapsedMs: 11_300, level: 'error', event: 'failure' }),
    ]);

    expect(trail.map((line) => line.atMs)).toEqual([4_200, 11_300]);
  });
});
