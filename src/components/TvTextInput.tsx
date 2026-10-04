import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Focusable } from './Focusable';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, radius, rem, type } from '../styles/theme';

/**
 * A text field typed into with the Android IME (the leanback keyboard). While
 * the IME is open it owns the D-pad, so focus navigation is suspended
 * (`tvFocus.suspend()`); otherwise selection would move behind the keyboard.
 */
export function TvTextInput({
  label,
  value,
  onChangeText,
  onSubmit,
  placeholder,
  secure,
  defaultFocus,
  focusId,
  scope,
  autoCapitalize = 'none',
  boxStyle,
  boxFocusedStyle,
  inputStyle,
  fieldStyle,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  secure?: boolean;
  defaultFocus?: boolean;
  focusId?: string;
  scope?: string;
  autoCapitalize?: 'none' | 'sentences';
  /** Overrides the field's box, for a row of equal controls (Search's `.search-bar`). */
  boxStyle?: StyleProp<ViewStyle>;
  boxFocusedStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** The outer wrapper, e.g. `flex: 1` to take a row's remaining width. */
  fieldStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const input = useRef<TextInput | null>(null);
  // The live suspension. It must be released exactly once: a leak leaves the
  // client unnavigable, and a double release lifts someone else's.
  const resume = useRef<(() => void) | undefined>(undefined);

  const release = useCallback(() => {
    resume.current?.();
    resume.current = undefined;
  }, []);

  // Release when the keyboard hides: on Android TV the IME closes while the
  // field keeps native focus, so `onBlur` never fires. Blur too, or a later
  // centre press would re-open the keyboard.
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (!resume.current) return;
      input.current?.blur();
      release();
    });
    return () => subscription.remove();
  }, [release]);

  // Release on unmount: a screen can be replaced while the keyboard is up.
  useEffect(() => release, [release]);

  return (
    <View style={[styles.field, fieldStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Focusable
        ring={false}
        focusId={focusId}
        scope={scope}
        defaultFocus={defaultFocus}
        // D-pad centre hands over to the keyboard.
        onSelect={() => input.current?.focus()}
        style={[styles.shell, boxStyle]}
        focusedStyle={[styles.shellFocused, boxFocusedStyle]}
      >
        {() => (
          <TextInput
            ref={input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colour.textFaint}
            secureTextEntry={secure}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            style={[styles.input, inputStyle]}
            // On `onFocus`, not the press handler: the platform can raise the
            // IME by itself.
            onFocus={() => {
              resume.current?.();
              resume.current = tvFocus.suspend();
            }}
            onBlur={release}
            onSubmitEditing={() => {
              release();
              onSubmit?.();
            }}
            returnKeyType={onSubmit ? 'go' : 'done'}
          />
        )}
      </Focusable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: rem(0.9),
  },
  label: {
    color: colour.textDim,
    fontSize: type.eyebrow,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: rem(0.3),
  },
  shell: {
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  shellFocused: {
    borderColor: colour.accent,
  },
  input: {
    color: colour.text,
    fontSize: type.body,
    fontFamily: font.family,
    paddingHorizontal: rem(0.8),
    paddingVertical: rem(0.6),
    minWidth: rem(18),
  },
});
