import { describe, expect, it } from 'vitest';
import type { VersionFile } from '@machafoundation/core';
import { fileGroups } from './fileSummary';

const file = (quality: number, mode: string, index = 0) =>
  ({ quality, index, instruction: { mode } }) as unknown as VersionFile;

describe('the files under a title', () => {
  it('groups them by how this set plays them, direct first, highest first', () => {
    expect(fileGroups([file(720, 'direct'), file(2160, 'transcode'), file(1080, 'direct'), file(2160, 'direct')])).toEqual([
      { mode: 'direct', qualities: [2160, 1080, 720] },
      { mode: 'transcode', qualities: [2160] },
    ]);
  });

  it('names a quality once however many files share it', () => {
    expect(fileGroups([file(1080, 'direct'), file(1080, 'direct')])).toEqual([{ mode: 'direct', qualities: [1080] }]);
  });

  it('says nothing for a single file, or before the facts answer', () => {
    expect(fileGroups([file(1080, 'direct')])).toEqual([]);
    expect(fileGroups(undefined)).toEqual([]);
  });
});
