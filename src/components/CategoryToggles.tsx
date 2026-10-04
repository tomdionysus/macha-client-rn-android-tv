import { StyleSheet, Text, View } from 'react-native';
import type { SearchCategory, SearchCategoryKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, controlRow, focusFrame, rem, type } from '../styles/theme';
import { categoryLabel } from '../text/viewerText';

/**
 * Which media categories a search covers, each on or off; none is allowed.
 * The categories are core's `SEARCH_CATEGORIES`. Focus is the `focusFrame`
 * border; "on" is the fill.
 */
export function CategoryToggles({
  categories,
  selected,
  onChange,
  height,
}: {
  /** The row's height, when it sits in a row of equal controls (Search). */
  height?: number;
  categories: readonly SearchCategory[];
  selected: readonly SearchCategoryKey[];
  onChange: (next: SearchCategoryKey[]) => void;
}): React.JSX.Element {
  return (
    <View style={styles.row}>
      {categories.map((category) => {
        const on = selected.includes(category.key);
        return (
          <Focusable
            key={category.key}
            ring={false}
            onSelect={() =>
              onChange(
                on
                  ? selected.filter((key) => key !== category.key)
                  // Rebuilt in core's order, so the list sent is stable.
                  : categories.map((entry) => entry.key).filter((key) => key === category.key || selected.includes(key)),
              )
            }
            style={[styles.pill, height !== undefined && { height, paddingVertical: 0 }, on && styles.pillOn]}
            focusedStyle={styles.pillFocused}
          >
            {({ focused }) => (
              <Text style={[styles.label, (on || focused) && styles.labelActive]}>{categoryLabel(category.key)}</Text>
            )}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: rem(0.6),
  },
  /**
   * `.search-type-pill { padding: 0 1.1rem; border: 1px solid #3a3a40;
   * border-radius: .65rem; background: #19191c; color: #9a9aa2 }`, with
   * `focusFrame.border` for its 1px. Unlike the web, "on" does not colour the
   * border: here a red border means focus.
   */
  pill: {
    paddingHorizontal: rem(1.1),
    paddingVertical: rem(0.5),
    justifyContent: 'center',
    borderRadius: controlRow.radius,
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
    backgroundColor: colour.inputBackground,
  },
  pillOn: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  pillFocused: {
    borderColor: colour.focus,
  },
  label: {
    color: colour.toggleOff,
    fontSize: type.body,
  },
  labelActive: {
    color: colour.heading,
  },
});
