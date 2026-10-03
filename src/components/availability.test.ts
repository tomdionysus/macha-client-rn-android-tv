import { describe, expect, it } from 'vitest';
import type { MediaSummary } from '@machafoundation/core';
import { availabilityMarker, cardInteraction, firstAvailableIndex } from './availability';

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

describe('cardInteraction', () => {
  it('keeps an unavailable card out of focus and off OK', () => {
    expect(cardInteraction(item('unavailable'), false)).toEqual({ focusable: false, selectable: false });
  });

  it('lets an unavailable Continue Watching card take focus, to reach its remove button, but not play on OK', () => {
    expect(cardInteraction(item('unavailable'), true)).toEqual({ focusable: true, selectable: false });
  });

  it('leaves every other card focusable and selectable', () => {
    for (const code of ['complete', 'partial', 'unknown', undefined]) {
      expect(cardInteraction(item(code), false)).toEqual({ focusable: true, selectable: true });
      expect(cardInteraction(item(code), true)).toEqual({ focusable: true, selectable: true });
    }
  });
});
