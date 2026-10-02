import { describe, expect, it } from 'vitest';
import type { PlaybackProgress, VersionStep } from '@machafoundation/core';
import { startPreferences } from './startPreferences';

// Left playing the 1080p file by the viewer's choice of Direct, English
// subtitles on: what a resume has to bring back.
const entry = {
  itemId: 'tmdb:movie:286217',
  fileMediaId: 'macha:hd',
  positionMs: 84_000,
  durationMs: 9_080_000,
  updatedAt: 1,
  resume: {
    chosenByViewer: true,
    mode: 'direct',
    maxHeight: null,
    audioStream: 1,
    subtitleStream: 2,
    subtitleLanguage: 'eng',
  },
} as unknown as PlaybackProgress;

describe('what a play starts with', () => {
  it('resumes on the same file, with the choices it was left with', () => {
    const preferences = startPreferences(84_000, entry);
    expect(preferences).toMatchObject({ mediaId: 'macha:hd', mode: 'direct', subtitleStream: 2 });
  });

  it('starts fresh from the beginning: Restart carries nothing over', () => {
    expect(startPreferences(0, entry)).toBeUndefined();
  });

  it('plays a picked version as the viewer picked it, resume or not', () => {
    const step = { quality: 720, source: 'transcode', mediaId: 'macha:uhd', maxHeight: 720, instruction: { mode: 'transcode', video: 'transcode', audio: 'transcode' } } as unknown as VersionStep;
    expect(startPreferences(84_000, entry, step)).toMatchObject({ mediaId: 'macha:uhd', maxHeight: 720 });
  });

  it('leaves a title with no entry to core', () => {
    expect(startPreferences(84_000, undefined)).toBeUndefined();
  });
});
