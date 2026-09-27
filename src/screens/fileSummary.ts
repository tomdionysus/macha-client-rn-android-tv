import type { PlaybackMode, QualityClass, VersionFile } from '@machafoundation/core';

/** One pill under a title: a way this set plays some of the item's files, and their qualities. */
export interface FileGroup {
  mode: PlaybackMode;
  /** Highest first, each once. */
  qualities: QualityClass[];
}

const MODE_ORDER: readonly PlaybackMode[] = ['direct', 'remux', 'transcode'];

/**
 * An item's files, grouped by how this set would play each one.
 *
 * Tom, 2026-09-27: a title with several files should say so, as small pills
 * under the title — "Direct: 4K, 1080p, 720p". From core's `versions.files`,
 * whose `instruction` is the chooser's answer for this device, so a group is
 * how the file would play here, not what it is. Only for more than one file:
 * one file is the title, and says nothing a viewer can choose between.
 */
export function fileGroups(files: readonly VersionFile[] | undefined): FileGroup[] {
  if (!files || files.length < 2) return [];
  return MODE_ORDER.flatMap((mode) => {
    const qualities = [...new Set(files.filter((file) => file.instruction.mode === mode).map((file) => file.quality))]
      .sort((a, b) => b - a);
    return qualities.length > 0 ? [{ mode, qualities }] : [];
  });
}
