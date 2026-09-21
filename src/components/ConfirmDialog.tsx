import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Focusable } from './Focusable';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, radius, rem, screenSize, type, vh } from '../styles/theme';

export const CONFIRM_SCOPE = 'confirm';

/**
 * Asking before doing something the viewer cannot undo from here.
 *
 * The web client's `ConfirmModal` (`components/Modal.tsx`), re-laid for a
 * remote. Same shape and the same ordering rule — **Cancel first and the commit
 * second** — because that client's single idiom for a mutation is a dialogue
 * where the safe choice is the one already under the pointer. Here the safe
 * choice is the one already under the *focus*, which is the same argument with
 * a D-pad's stakes: a viewer who pressed OK by accident presses it again.
 *
 * **Not a general modal**, deliberately. The web client's `Modal` also backs a
 * `FormModal` that this client has no use for yet, and the focus-trap work it
 * does with `Tab` has no analogue here — the registry's scopes do that job
 * outright. When music needs `Modal` and `OverflowMenu` (`TODO/ACTIVE.md`
 * §4.6), this is the piece to generalise rather than to copy.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  /** What the action will actually do, in the viewer's terms. */
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  /** The commit is in flight. Both controls stop answering, as they do on the web. */
  busy?: boolean;
  /** A failure belonging to the dialogue as a whole. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  /**
   * Claim the focus scope while this is up.
   *
   * Not bookkeeping: the registry only offers candidates matching the active
   * scope, so this is both how the dialogue's own controls become reachable and
   * how the top bar underneath stops being — which is the whole of "modal" on
   * this platform. `LoginScreen` does the same thing for the same reason.
   */
  useEffect(() => {
    tvFocus.pushScope(CONFIRM_SCOPE);
    return () => tvFocus.popScope(CONFIRM_SCOPE);
  }, []);

  return (
    <View style={styles.backdrop}>
      <View style={styles.panel}>
        {/* `.modal-panel h2 { margin: 0 0 .8rem }`. */}
        <Text style={styles.title}>{title}</Text>
        {/* `.modal-content { color: var(--text-dim); line-height: 1.5 }`. */}
        <Text style={styles.body}>{body}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* `.modal-actions { justify-content: flex-end; gap: .55rem; margin-top: 1.1rem }`. */}
        <View style={styles.actions}>
          {/*
            * Cancel takes the focus, and on a remote that is not a nicety.
            * Reaching this dialogue at all costs one press on a control the
            * viewer walks past on the way to everything else, and the cost of
            * getting it wrong here is a password typed back in with a D-pad.
            */}
          <Focusable
            ring={false}
            defaultFocus
            scope={CONFIRM_SCOPE}
            disabled={busy}
            onSelect={onCancel}
            style={styles.button}
            focusedStyle={styles.buttonFocused}
          >
            {({ focused }) => (
              <Text style={[styles.buttonLabel, focused && styles.buttonLabelFocused]}>Cancel</Text>
            )}
          </Focusable>
          <Focusable
            ring={false}
            scope={CONFIRM_SCOPE}
            disabled={busy}
            onSelect={onConfirm}
            style={[styles.button, destructive && styles.buttonDanger]}
            focusedStyle={styles.buttonFocused}
          >
            {({ focused }) => (
              <Text style={[styles.buttonLabel, focused && styles.buttonLabelFocused]}>
                {busy ? 'Working…' : confirmLabel}
              </Text>
            )}
          </Focusable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * `.modal-backdrop { position: fixed; inset: 0; z-index: 100; display: grid;
   * place-items: center; padding: 1.25rem; background: #000b }`.
   */
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: rem(1.25),
    backgroundColor: colour.scrim,
  },
  /**
   * `.modal-panel { width: min(31rem, 100%); max-height: min(85vh, 48rem);
   * padding: 1.2rem; border: 1px solid #ffffff1a; border-radius: .8rem;
   * background: #171719f7; box-shadow: 0 22px 70px #000d }`.
   *
   * The shadow is dropped rather than approximated: `elevation` on Android
   * draws a different shape at a different opacity, and at ten feet the scrim
   * is what does this job anyway.
   */
  panel: {
    width: Math.min(rem(31), screenSize.width),
    maxHeight: Math.min(vh(85), rem(48)),
    padding: rem(1.2),
    borderWidth: 1,
    borderColor: colour.hairline,
    borderRadius: rem(0.8),
    backgroundColor: colour.modalSurface,
  },
  title: {
    marginBottom: rem(0.8),
    color: colour.heading,
    fontSize: type.subtitle,
    fontWeight: font.weightSemibold,
  },
  body: {
    color: colour.textDim,
    fontSize: type.body,
    lineHeight: type.body * 1.5,
  },
  /** `.manage-error` inside a modal, which is `.error { color: #ffb4b4 }`. */
  error: {
    marginTop: rem(0.6),
    color: colour.error,
    fontSize: type.small,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: rem(0.55),
    marginTop: rem(1.1),
  },
  /**
   * `.secondary-button` and `.primary-button` share their geometry; the fill is
   * what separates them, and here the destructive one is the only one filled.
   */
  button: {
    paddingHorizontal: rem(0.9),
    paddingVertical: rem(0.5),
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: colour.inputBorder,
    backgroundColor: colour.optionSurface,
  },
  /** `.modal-danger-action { border-color: #8a303b; background: #39080e }`. */
  buttonDanger: {
    borderColor: colour.dangerBorder,
    backgroundColor: colour.dangerSurface,
  },
  buttonFocused: {
    borderColor: colour.focus,
    backgroundColor: colour.accentSurfaceStrong,
  },
  buttonLabel: {
    color: colour.optionText,
    fontSize: type.body,
  },
  buttonLabelFocused: {
    color: colour.heading,
  },
});
