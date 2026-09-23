import { StyleSheet, Text, View } from 'react-native';
import type { MediaSort, MediaSortKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, focusFrame, radius, rem, type } from '../styles/theme';

/**
 * "Sort by", as a row of choices rather than a drop-down.
 *
 * The web client's `.sort-control` is a `<select>` (`SearchScreen.tsx`,
 * macha-client). A select has no D-pad form: a drop-down here needs its own
 * focus scope and its own Back, and Back on a top-level screen leaves the app,
 * so a slip closes Macha instead of the menu. Four choices fit in the row, and
 * each is one press away, so they are drawn as chips — the shape the player's
 * options already use.
 *
 * **What the choices are is core's** (`SEARCH_SORTS`, `orderMedia`); this only
 * draws them.
 *
 * Focus is the thick border every media card wears (`focusFrame`), with the
 * border always present so nothing moves. The player's option chips mark focus
 * with a one-pixel border and were measured unreadable on the set on
 * 2026-09-23 — this does not repeat that.
 */
export function SortControl({
  sorts,
  value,
  onChange,
}: {
  sorts: readonly MediaSort[];
  value: MediaSortKey;
  onChange: (key: MediaSortKey) => void;
}): React.JSX.Element {
  return (
    <View style={styles.control}>
      {/* `.sort-control { color: var(--text-faint) }` */}
      <Text style={styles.label}>Sort by</Text>
      {sorts.map((sort) => {
        const selected = sort.key === value;
        return (
          <Focusable
            key={sort.key}
            ring={false}
            onSelect={() => onChange(sort.key)}
            style={[styles.chip, selected && styles.chipSelected]}
            focusedStyle={styles.chipFocused}
          >
            {({ focused }) => (
              <Text style={[styles.chipLabel, (selected || focused) && styles.chipLabelActive]}>
                {sort.label}
              </Text>
            )}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // `.sort-control { display: flex; align-items: center; gap: .4rem }`
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.4),
  },
  // `.search-bar .sort-control { font-size: .95rem }`, text-faint.
  label: {
    color: colour.textFaint,
    fontSize: type.small,
    marginRight: rem(0.3),
  },
  // `.player-option-group button` for the pill, with `focusFrame.border` in
  // place of its 1px so focus can be seen from the sofa.
  chip: {
    paddingHorizontal: rem(0.9),
    paddingVertical: rem(0.55),
    borderRadius: radius.pill,
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
    backgroundColor: colour.optionSurface,
  },
  chipSelected: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  chipFocused: {
    borderColor: colour.focus,
  },
  chipLabel: {
    color: colour.optionText,
    fontSize: type.small,
  },
  chipLabelActive: {
    color: colour.heading,
  },
});
