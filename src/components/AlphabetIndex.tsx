import { StyleSheet, Text, View } from 'react-native';
import { ALPHABET_INDEX, type AlphabetIndexKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, font, radius, rem, type } from '../styles/theme';

/**
 * Jump-to-letter, from `.alphabet-index` in base.css.
 *
 * A fixed vertical strip down the right edge, as on the web — but this is the
 * component that earns its keep far more on a television than in a browser.
 * With a pointer, a long library is a scrollbar drag. With a D-pad it is one
 * focus step per card, and a library of a few hundred titles is unusable
 * without this.
 *
 * Letters with nothing behind them render dimmed and **not focusable**, so the
 * D-pad skips them rather than making the viewer press through dead entries —
 * the equivalent of the web client's `disabled` plus its missing
 * `data-tv-focusable`.
 */

/**
 * Horizontal space the strip occupies, so a grid beside it can reserve the
 * room rather than laying cards underneath it.
 */
export const alphabetStripWidth = rem(2.7);

export function AlphabetIndex({
  availableKeys,
  onSelect,
}: {
  availableKeys: Set<AlphabetIndexKey>;
  onSelect: (key: AlphabetIndexKey) => void;
}): React.JSX.Element {
  return (
    <View style={styles.strip}>
      {ALPHABET_INDEX.map((key) => {
        const available = availableKeys.has(key);
        return (
          <Focusable
            key={key}
            focusId={`alphabet:${key}`}
            disabled={!available}
            onSelect={() => onSelect(key)}
            ring={false}
            style={styles.key}
            focusedStyle={styles.keyFocused}
          >
            {({ focused }) => (
              <Text
                style={[
                  styles.label,
                  !available && styles.labelUnavailable,
                  focused && styles.labelFocused,
                ]}
              >
                {key}
              </Text>
            )}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `position: fixed; right: max(.35rem, 1vw); top: 78px; bottom: .8rem`.
   *
   * Absolute rather than fixed, because React Native has no fixed positioning
   * — the parent is the screen, so the effect is the same.
   */
  strip: {
    position: 'absolute',
    right: rem(0.8),
    top: rem(5),
    bottom: rem(1),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
  },
  key: {
    width: rem(1.9),
    height: rem(1.5),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.small,
  },
  keyFocused: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  label: {
    color: colour.textDim,
    fontSize: type.small,
    fontWeight: font.weightMedium,
  },
  labelFocused: {
    color: colour.text,
  },
  /**
   * Dimmed rather than hidden: the strip keeps a stable height and the letters
   * stay where the viewer expects them, which is the point of an index.
   */
  labelUnavailable: {
    color: colour.textFaint,
    opacity: 0.45,
  },
});
