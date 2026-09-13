import { useCallback, useRef } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
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

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Focusable
        ring={false}
        focusId={focusId}
        scope={scope}
        defaultFocus={defaultFocus}
        // D-pad centre hands over to the keyboard. Until then this is an
        // ordinary focusable the scorer can move through like any other.
        onSelect={() => input.current?.focus()}
        style={styles.shell}
        focusedStyle={styles.shellFocused}
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
            style={styles.input}
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
