import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Focusable } from './Focusable';
import { colour, font, radius, rem, type } from '../styles/theme';

/**
 * The client's one text button: `.primary-button` / `.settings button` in
 * base.css, focused the way every button here is — the standard 1px `--focus`
 * ring over the stronger accent fill.
 *
 * Extracted from the Settings screen on Tom's instruction (2026-09-24) that
 * the sign-in buttons "need to be the same as all other buttons". Each screen
 * had drawn its own, and sign-in's replaced the fill with `--surface-3` on
 * focus and drew no ring, so after a move it was not clear which one held
 * focus. Use this rather than a styled `Focusable` for any new text button.
 */
export function Button({
  label,
  onSelect,
  scope,
  defaultFocus,
  disabled,
  onFocusChange,
  style,
}: {
  label: string;
  onSelect: () => void;
  scope?: string;
  defaultFocus?: boolean;
  disabled?: boolean;
  /** For a screen that scrolls its focused row into view. */
  onFocusChange?: (focused: boolean) => void;
  /** Placement only — margins, alignment. Never colour. */
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Focusable
      scope={scope}
      defaultFocus={defaultFocus}
      disabled={disabled}
      onSelect={onSelect}
      onFocusChange={onFocusChange}
      style={[styles.button, style]}
      focusedStyle={styles.buttonFocused}
    >
      <Text style={styles.label}>{label}</Text>
    </Focusable>
  );
}

const styles = StyleSheet.create({
  /** `.primary-button { padding; border-radius: .55rem; background: var(--accent-surface) }` */
  button: {
    paddingVertical: rem(0.5),
    paddingHorizontal: rem(1),
    borderRadius: radius.control,
    backgroundColor: colour.accentSurface,
  },
  buttonFocused: {
    backgroundColor: colour.accentSurfaceStrong,
  },
  label: {
    color: colour.text,
    fontSize: type.body,
    fontWeight: font.weightMedium,
  },
});
