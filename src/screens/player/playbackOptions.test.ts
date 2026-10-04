import { describe, expect, it } from 'vitest';
import type { PlaybackInstructionReport, PlaybackStreamInfo, VersionStep } from '@machafoundation/core';
import {
  assumptionNote,
  modeChoices,
  modeObjectionNote,
  qualityChoices,
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
    // A reason core adds before this map does must still reach the screen.
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


describe('the modes offered', () => {
  const all = ['direct', 'remux', 'transcode'] as const;

  it('drops a mode this set cannot play', () => {
    const offered = [
      { mode: 'direct', offered: false, reasons: ['video-size-exceeds-client'] },
      { mode: 'remux', offered: true, reasons: [] },
      { mode: 'transcode', offered: true, reasons: [] },
    ] as const;
    expect(modeChoices(all, offered as never).map((choice) => choice.mode)).toEqual(['remux', 'transcode']);
  });

  it('keeps a mode offered despite an objection, and says why', () => {
    const offered = [
      { mode: 'direct', offered: true, reasons: ['video-size-exceeds-client'] },
      { mode: 'remux', offered: true, reasons: [] },
      { mode: 'transcode', offered: true, reasons: [] },
    ] as const;
    const choices = modeChoices(all, offered as never);
    expect(choices.map((choice) => choice.mode)).toEqual(['direct', 'remux', 'transcode']);
    expect(modeObjectionNote(choices)).toBe('Direct: the picture is larger than this device decodes.');
  });

  it('never offers a mode the node does not', () => {
    const offered = all.map((mode) => ({ mode, offered: true, reasons: [] }));
    expect(modeChoices(['transcode'], offered as never).map((choice) => choice.mode)).toEqual(['transcode']);
  });

  it("offers the node's modes when there are no facts to reason from", () => {
    expect(modeChoices(all, undefined).map((choice) => choice.mode)).toEqual([...all]);
    expect(modeObjectionNote(modeChoices(all, undefined))).toBeUndefined();
  });
});

describe('the one Quality row', () => {
  const step = (quality: number) => ({ quality, source: 'file', instruction: { mode: 'direct' } }) as unknown as VersionStep;
  const steps = [step(2160), step(1440), step(1080), step(720)];
  const label = (choice: ReturnType<typeof qualityChoices>[number]) =>
    choice.kind === 'version' ? `v${choice.step.quality}` : choice.kind === 'cap' ? `c${choice.height}` : 'original';

  it('offers the versions, then the caps below the smallest, and no Original', () => {
    expect(qualityChoices(steps, [1440, 1080, 720, 480, 360], true).map(label)).toEqual([
      'v2160', 'v1440', 'v1080', 'v720', 'c480', 'c360',
    ]);
  });

  it('offers the versions alone while the node cannot change quality (direct)', () => {
    expect(qualityChoices(steps, [480, 360], false).map(label)).toEqual(['v2160', 'v1440', 'v1080', 'v720']);
  });

  it('keeps Original and the caps for an item with one version', () => {
    expect(qualityChoices([step(1080)], [720, 480], true).map(label)).toEqual(['original', 'c720', 'c480']);
    expect(qualityChoices([], [720], false)).toEqual([]);
  });
});
