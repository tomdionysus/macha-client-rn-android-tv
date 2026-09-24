import { StyleSheet, Text, View } from 'react-native';
import type { SearchCategory, SearchCategoryKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, controlRow, focusFrame, rem, type } from '../styles/theme';
import { categoryLabel } from '../text/viewerText';

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
                  // Rebuilt in core's order, so the list sent is stable
                  // whatever order the viewer switched them on in.
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
   * border-radius: .65rem; background: #19191c; color: #9a9aa2 }` — the
   * field's own shape, not a pill, whatever the class says — with
   * `focusFrame.border` in place of its 1px.
   *
   * **One deviation, and it is the television's.** On the web a toggle that is
   * on wears the focus colour on its border. Here a red border *is* focus, so
   * "on" is the fill and the bright text alone, and the border stays free to
   * say where the D-pad is.
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
