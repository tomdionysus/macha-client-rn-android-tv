import { describe, expect, it } from 'vitest';
import type { PlaybackInstructionReport, PlaybackStreamInfo } from '@machafoundation/core';
import {
  assumptionNote,
  audioProcessingNote,
  instructionNote,
  noteIsWarning,
  streamLabel,
} from './playbackOptions';

function report(overrides: Partial<PlaybackInstructionReport> = {}): PlaybackInstructionReport {
  return {
    mode: 'transcode',
    reasons: [],
    assumed: [],
    withoutFacts: false,
    chosenByViewer: false,
    ...overrides,
  } as PlaybackInstructionReport;
}

/*
 * The `MODE_TRANSFORMS` tests that were here are gone with the map. They pinned
 * a rule this client inherited from the web client and never observed: that a
 * bare mode is judged against the previous instruction's per-stream transforms
 * and refused. The server clears those fields the moment `mode` is named, so
 * the contradiction cannot be assembled — confirmed in core at 0.34.0 and in
 * the server source at 0.39.1.
 *
 * Four tests passed against a rule that should not have existed, which is worth
 * remembering: they tested that the map said what it said, never that the
 * server needed it to.
 */

/**
 * The chooser's worst failure has no symptom without these notes: a facts
 * lookup that fails falls back to transcode, the viewer sees a working picture,
 * and a whole library can be transcoded that would have direct-played. On a
 * television there is no console anyone will open, so this text is the only
 * place it can show.
 */
describe('explaining why the stream is served this way', () => {
  it('says nothing when there is no instruction to explain', () => {
    expect(instructionNote(undefined)).toBeUndefined();
  });

  it('names the viewer when the viewer chose', () => {
    expect(instructionNote(report({ chosenByViewer: true }))).toBe('Chosen by you.');
  });

  it('says outright when it decided with no facts at all', () => {
    const note = instructionNote(report({ withoutFacts: true }));
    expect(note).toContain('without facts');
    expect(noteIsWarning(report({ withoutFacts: true }))).toBe(true);
  });

  it('puts the no-facts case above the reasons, since it explains them all', () => {
    // A fallback decision may still carry reasons; leading with them would
    // describe reasoning that did not happen.
    const note = instructionNote(report({ withoutFacts: true, reasons: ['no-technical-facts'] }));
    expect(note).toContain('without facts');
  });

  it('translates reasons into something a viewer can act on', () => {
    const note = instructionNote(report({ reasons: ['audio-codec-not-playable'] }));
    expect(note).toBe('Chosen automatically: this device cannot decode the audio.');
  });

  it('joins several reasons rather than reporting only the first', () => {
    const note = instructionNote(report({
      reasons: ['audio-codec-not-playable', 'container-not-playable'],
    }));
    expect(note).toContain('cannot decode the audio');
    expect(note).toContain('cannot play the container');
  });

  it('passes an unrecognised reason through rather than dropping it', () => {
    // A reason core adds before this map does must still reach the screen:
    // silence is the one failure mode this whole note exists to prevent.
    const note = instructionNote(report({ reasons: ['something-new' as never] }));
    expect(note).toContain('something-new');
  });

  it('is not a warning when the decision was made normally', () => {
    expect(noteIsWarning(report({ reasons: ['source-plays-as-is'] }))).toBe(false);
  });
});

describe('naming what was decided without', () => {
  it('lists missing inputs, because each one is a defect rather than a note', () => {
    expect(assumptionNote(report({ assumed: ['hlsVideoCodecs', 'hlsAudioCodecs'] })))
      .toBe('Decided without: hlsVideoCodecs, hlsAudioCodecs.');
  });

  it('says nothing when nothing was assumed', () => {
    expect(assumptionNote(report())).toBeUndefined();
  });

  it('says nothing when the viewer chose, since nothing was inferred', () => {
    expect(assumptionNote(report({ chosenByViewer: true, assumed: ['operations'] })))
      .toBeUndefined();
  });
});

describe('labelling a stream a viewer is choosing between', () => {
  const stream = (over: Partial<PlaybackStreamInfo>): PlaybackStreamInfo =>
    ({ index: 1, codec: 'eac3', ...over }) as PlaybackStreamInfo;

  it('leads with the language, which is what a viewer is actually choosing by', () => {
    expect(streamLabel(stream({ language: 'eng', channels: 6 }), 'Audio 1'))
      .toBe('ENG · EAC3 · 6ch');
  });

  it('falls back to a name when the stream has no language', () => {
    expect(streamLabel(stream({}), 'Audio 1')).toBe('Audio 1 · EAC3');
  });

  it('marks a forced subtitle, which changes what selecting it means', () => {
    expect(streamLabel(stream({ language: 'eng', codec: 'subrip', forced: true }), 'Subtitle 2'))
      .toContain('forced');
  });
});

describe('reporting what the server is doing to the audio', () => {
  it('names the output codec on a transcode, which is the 5.1 question', () => {
    // The measurement this project exists for is whether E-AC-3 reaches the
    // panel. "transcode → AAC" is that failure, stated.
    expect(audioProcessingNote('transcode', 'aac')).toBe('Server processing: transcode → AAC');
  });

  it('reports a transcode even when the output codec is unknown', () => {
    expect(audioProcessingNote('transcode', undefined)).toBe('Server processing: transcode');
  });

  it('reports a copy, which is what direct play should show', () => {
    expect(audioProcessingNote('copy', undefined)).toBe('Server processing: copy');
  });

  it('reports an omitted stream rather than implying it was copied', () => {
    expect(audioProcessingNote('omit', undefined)).toBe('Server processing: omitted');
  });
});

