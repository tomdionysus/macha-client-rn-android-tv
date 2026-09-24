import { StyleSheet, Text } from 'react-native';
import type { MediaSort, MediaSortKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, controlRow, focusFrame, rem, type } from '../styles/theme';
import { sortChoiceLabel } from '../text/viewerText';

/**
 * The sort choice, as one control that reads "Sort By Title" and moves to the
 * next choice on each press.
 *
 * **Tom's vocabulary** (2026-09-24, relayed by core): no separate "Sort by"
 * heading; each option reads "Sort By <label>", composed by core as
 * `MediaSort.choiceLabel`, from core's lists (`SEARCH_SORTS`,
 * `LIBRARY_SORTS`) — the same choices on all four clients.
 *
 * The web client's control is a `<select>`, which shows exactly one of these
 * labels until it is opened. A drop-down has no D-pad form here — it needs its
 * own focus scope and its own Back, and Back on a top-level screen leaves the
 * app — so pressing the control steps to the next choice instead, wrapping at
 * the end. It is the select's closed face, and four choices are never more
 * than three presses away.
 *
 * Focus is the media cards' thick border (`focusFrame`), always present so
 * nothing moves when it lands.
 */
export function SortControl({
  sorts,
  value,
  onChange,
  height,
}: {
  /** The row's height, when it sits in a row of equal controls (Search). */
  height?: number;
  sorts: readonly MediaSort[];
  value: MediaSortKey;
  onChange: (key: MediaSortKey) => void;
}): React.JSX.Element | null {
  if (sorts.length === 0) return null;
  const index = Math.max(0, sorts.findIndex((sort) => sort.key === value));
  const current = sorts[index]!;
  return (
    <Focusable
      ring={false}
      onSelect={() => onChange(sorts[(index + 1) % sorts.length]!.key)}
      style={[styles.control, height !== undefined && { height, paddingVertical: 0 }]}
      focusedStyle={styles.controlFocused}
    >
      {({ focused }) => (
        <Text style={[styles.label, focused && styles.labelFocused]} numberOfLines={1}>
          {sortChoiceLabel(current.key)}
        </Text>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  /**
   * `.search-bar .sort-control select { padding: 1rem 1.2rem; border-radius:
   * .65rem; font-size: 1.05rem }` over `.sort-control select { background:
   * #19191c; color: #d7d7da }`, with `focusFrame.border` in place of its 1px
   * so focus can be seen from the sofa.
   */
  control: {
    paddingHorizontal: rem(1.2),
    paddingVertical: rem(0.8),
    borderRadius: controlRow.radius,
    justifyContent: 'center',
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
    backgroundColor: colour.inputBackground,
  },
  controlFocused: {
    borderColor: colour.focus,
    backgroundColor: colour.accentSurfaceStrong,
  },
  label: {
    color: colour.optionText,
    fontSize: type.body,
  },
  labelFocused: {
    color: colour.heading,
  },
});
