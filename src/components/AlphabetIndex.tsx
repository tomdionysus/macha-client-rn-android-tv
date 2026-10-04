import { StyleSheet, Text, View } from 'react-native';
import { ALPHABET_INDEX, type AlphabetIndexKey } from '@machafoundation/core';
import { Focusable } from './Focusable';
import { colour, font, radius, rem, type } from '../styles/theme';
import { alphabetKeyLabel } from '../text/viewerText';

/**
 * Jump-to-letter strip, from `.alphabet-index` in base.css. Letters with no
 * titles are dimmed and not focusable, so the D-pad skips them.
 */

/** Width a grid beside the strip must reserve. */
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
            rail
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
                {alphabetKeyLabel(key)}
              </Text>
            )}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // `.alphabet-index { position: fixed; right: max(.35rem, 1vw); top: 78px; bottom: .8rem }`
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
  // Dimmed, not hidden, so the letters keep their positions.
  labelUnavailable: {
    color: colour.textFaint,
    opacity: 0.45,
  },
});
