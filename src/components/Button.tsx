import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { Focusable } from './Focusable';
import { colour, font, radius, rem, type } from '../styles/theme';

/**
 * The client's one text button, from `.primary-button` / `.settings button` in
 * base.css. Use it rather than a styled `Focusable`.
 */
export function Button({
  label,
  onSelect,
  scope,
  defaultFocus,
  disabled,
  onFocusChange,
  destructive,
  style,
}: {
  label: string;
  onSelect: () => void;
  scope?: string;
  defaultFocus?: boolean;
  disabled?: boolean;
  /** For a screen that scrolls its focused row into view. */
  onFocusChange?: (focused: boolean) => void;
  /** `.modal-danger-action`'s fill without its red border, which here would read as focus. */
  destructive?: boolean;
  /** Placement only, never colour. */
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <Focusable
      scope={scope}
      defaultFocus={defaultFocus}
      disabled={disabled}
      onSelect={onSelect}
      onFocusChange={onFocusChange}
      style={[styles.button, destructive && styles.destructive, style]}
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
  /** `.modal-danger-action { background: #39080e }`. */
  destructive: {
    backgroundColor: colour.dangerSurface,
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
