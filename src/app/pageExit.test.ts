import { describe, expect, it } from 'vitest';
import type { MediaSummary, PlaybackRuntimeSnapshot } from '@machafoundation/core';
import { PageExit } from './pageExit';

const film = { id: 'film', title: 'Film', kind: 'movie' } as unknown as MediaSummary;
const request = { media: film, startPositionMs: 0, returnTo: 'detail' };

const runtimeIn = (phase: PlaybackRuntimeSnapshot['phase']): PlaybackRuntimeSnapshot => ({
  phase,
  generation: 1,
  ...(phase === 'idle' ? {} : { request }),
});

describe('PageExit', () => {
  it('closes a live session on background and offers it back on return', () => {
    const exit = new PageExit();
    expect(exit.background(runtimeIn('playing'))).toBe(request);
    expect(exit.active()).toBe(request);
  });

  it('offers a closed session back once only', () => {
    const exit = new PageExit();
    exit.background(runtimeIn('paused'));
    exit.active();
    expect(exit.active()).toBeUndefined();
  });

  it('has nothing to offer when nothing was playing', () => {
    const exit = new PageExit();
    expect(exit.background(runtimeIn('idle'))).toBeUndefined();
    expect(exit.active()).toBeUndefined();
  });

  it('does not bring back a failure the viewer was looking at', () => {
    const exit = new PageExit();
    exit.background(runtimeIn('failed'));
    expect(exit.active()).toBeUndefined();
  });

  it('keeps the first exit when background arrives twice before return', () => {
    const exit = new PageExit();
    exit.background(runtimeIn('starting'));
    expect(exit.background(runtimeIn('playing'))).toBeUndefined();
    expect(exit.active()).toBe(request);
  });
});
