import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { availabilityMarker, firstPlayableIndex, isPlayable, withoutStoredAvailability } from './availability';

const item = (availability?: string) =>
  ({ id: 'i', kind: 'movie', title: 'T', mediaIds: [], ...(availability ? { availability } : {}) }) as MediaSummary;

describe('availabilityMarker', () => {
  it('marks partial, unavailable and unknown titles', () => {
    expect(availabilityMarker(item('partial'))).toBe('partial');
    expect(availabilityMarker(item('unavailable'))).toBe('unavailable');
    expect(availabilityMarker(item('unknown'))).toBe('unknown');
  });

  it('marks nothing for a complete title, a title without the field, or a code it does not know', () => {
    expect(availabilityMarker(item('complete'))).toBeUndefined();
    expect(availabilityMarker(item())).toBeUndefined();
    expect(availabilityMarker(item('archived'))).toBeUndefined();
  });
});

describe('isPlayable', () => {
  it('refuses only an unavailable title', () => {
    expect(isPlayable(item('unavailable'))).toBe(false);
    for (const code of ['complete', 'partial', 'unknown', 'archived', undefined]) {
      expect(isPlayable(item(code))).toBe(true);
    }
  });
});

describe('firstPlayableIndex', () => {
  it('passes over unavailable titles to the first that can take focus', () => {
    expect(firstPlayableIndex([item('unavailable'), item('unavailable'), item('partial'), item()])).toBe(2);
    expect(firstPlayableIndex([item(), item('unavailable')])).toBe(0);
    expect(firstPlayableIndex([item('unavailable')])).toBe(-1);
  });
});

describe('withoutStoredAvailability', () => {
  it('drops a stored availability, so a stale unavailable cannot lock a Continue Watching card', () => {
    const stored = { ...item('unavailable'), availabilityMembers: { total: 1, complete: 0, partial: 0, unavailable: 1, unknown: 0 } };
    const shown = withoutStoredAvailability(stored);
    expect(shown.availability).toBeUndefined();
    expect(shown.availabilityMembers).toBeUndefined();
    expect(isPlayable(shown)).toBe(true);
    expect(shown.title).toBe('T');
  });

  it('returns a title with nothing stored unchanged', () => {
    const plain = item();
    expect(withoutStoredAvailability(plain)).toBe(plain);
  });
});
