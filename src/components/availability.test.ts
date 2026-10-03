import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { availabilityMarker, firstAvailableIndex } from './availability';

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

describe('firstAvailableIndex', () => {
  it('passes over unavailable titles to the first that can take focus', () => {
    expect(firstAvailableIndex([item('unavailable'), item('unavailable'), item('partial'), item()])).toBe(2);
    expect(firstAvailableIndex([item(), item('unavailable')])).toBe(0);
    expect(firstAvailableIndex([item('unavailable')])).toBe(-1);
  });
});
