import { useCallback, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Focusable } from './Focusable';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, radius, rem, type } from '../styles/theme';

/**
 * A text field a viewer can actually fill in from a sofa.
 *
 * **Typing on a television is the platform's job, not ours.** A React Native
 * `TextInput` raises the Android IME — the leanback keyboard the viewer already
 * knows from every other app on the set, with its own voice input. Drawing our
 * own would be larger, worse and would need re-teaching.
 *
 * The integration point is the awkward half, and it is why
 * `tvFocus.suspend()` exists: while the IME is open it owns the D-pad, but
 * `useTvNavigation` is attached once at the app root and goes on receiving
 * keys. Without standing down, the focus scorer would keep moving selection
 * around *behind* the open keyboard, and the viewer would return from typing to
 * find focus somewhere else entirely.
 *
 * Back needs no handling here: the IME consumes it to dismiss itself, and
 * `useTvNavigation` already yields Back while the registry is suspended.
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
  /**
   * The field's box, for a screen whose row sets one height and shape for
   * every control in it — Search's `.search-bar`. Omitted everywhere else, so
   * Login and Settings keep this component's own look.
   */
  boxStyle?: StyleProp<ViewStyle>;
  boxFocusedStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /** The outer wrapper, e.g. `flex: 1` to take a row's remaining width. */
  fieldStyle?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  const input = useRef<TextInput | null>(null);
  /**
   * The live suspension, held between the field gaining and losing keyboard
   * focus. A ref rather than state because releasing it exactly once matters
   * more than rendering it: a leaked suspension leaves the whole client
   * unnavigable with no visible cause, and a double release would lift someone
   * else's.
   */
  const resume = useRef<(() => void) | undefined>(undefined);

  const release = useCallback(() => {
    resume.current?.();
    resume.current = undefined;
  }, []);

  /**
   * Release when the keyboard actually goes away, **because `onBlur` does not
   * fire on this platform.**
   *
   * This is the bug that shipped in 0.3.0 and made the login screen
   * unnavigable. On Android TV the leanback IME closes as its own window while
   * the `ReactEditText` underneath **keeps native focus** — `mInputShown` goes
   * false, `mServedView` stays pointed at the field. React Native raises
   * `onBlur` from the native focus change, so no focus change means no blur,
   * no release, and a suspension held for the life of the process.
   *
   * The consequence was total: `useTvNavigation` returns early on every key
   * while suspended, so after typing once the D-pad did nothing at all, on a
   * screen whose only other control is a second text field. Nothing on screen
   * said why, and only restarting the app cleared it.
   *
   * Blurring as well as releasing is deliberate. Leaving the field natively
   * focused means Android goes on treating it as the key target, and a later
   * centre press would re-enter the keyboard rather than activating whatever
   * the viewer had moved to.
   */
  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (!resume.current) return;
      input.current?.blur();
      release();
    });
    return () => subscription.remove();
  }, [release]);

  /**
   * Release on unmount, which nothing else can do.
   *
   * A screen can be replaced while the keyboard is still up — a sign-in that
   * succeeds and navigates away is the ordinary case here. The token lives in
   * this component's ref, so once it is gone no other code can ever release
   * it.
   */
  useEffect(() => release, [release]);

  return (
    <View style={[styles.field, fieldStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Focusable
        ring={false}
        focusId={focusId}
        scope={scope}
        defaultFocus={defaultFocus}
        // D-pad centre hands over to the keyboard. Until then this is an
        // ordinary focusable the scorer can move through like any other.
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
            // `onFocus` rather than the press handler: the IME is also raised
            // by the platform itself in ways this component never sees, and
            // suspending anywhere else would miss those.
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
