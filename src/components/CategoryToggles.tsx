import { StyleSheet, Text, View } from 'react-native';
import type { SearchCategory, SearchCategoryKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, focusFrame, radius, rem, type } from '../styles/theme';

/**
 * Which kinds of media a search covers: Movies, TV Shows, Music, each on or
 * off, in any combination including none.
 *
 * **Tom's, relayed by core (2026-09-24).** The categories, their names and the
 * kinds each covers are core's (`SEARCH_CATEGORIES`); core also answers an
 * empty selection with nothing and no request. The web client draws them as
 * toggle pills, and so does this: a pill is one focus target and one press, so
 * it needs no D-pad translation.
 *
 * Focus is the media cards' thick border (`focusFrame`), always present so
 * nothing moves; being switched on is the fill.
 */
export function CategoryToggles({
  categories,
  selected,
  onChange,
}: {
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
                  // Rebuilt in core's order, so the list sent is stable
                  // whatever order the viewer switched them on in.
                  : categories.map((entry) => entry.key).filter((key) => key === category.key || selected.includes(key)),
              )
            }
            style={[styles.pill, on && styles.pillOn]}
            focusedStyle={styles.pillFocused}
          >
            {({ focused }) => (
              <Text style={[styles.label, (on || focused) && styles.labelActive]}>{category.label}</Text>
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
  // `.player-option-group button` for the pill, with `focusFrame.border` in
  // place of its 1px so focus can be seen from the sofa.
  pill: {
    paddingHorizontal: rem(1),
    paddingVertical: rem(0.5),
    borderRadius: radius.pill,
    borderWidth: focusFrame.border,
    borderColor: colour.inputBorder,
    backgroundColor: colour.optionSurface,
  },
  pillOn: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  pillFocused: {
    borderColor: colour.focus,
  },
  label: {
    color: colour.optionText,
    fontSize: type.small,
  },
  labelActive: {
    color: colour.heading,
  },
});
