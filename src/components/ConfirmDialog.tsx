import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, rem, screenSize, type, vh } from '../styles/theme';

export const CONFIRM_SCOPE = 'confirm';

/**
 * Confirmation before an action the viewer cannot undo: the web client's
 * `ConfirmModal` (`components/Modal.tsx`). Cancel comes first and holds the
 * focus, so an accidental second OK is harmless.
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
  /** What the action does, in the viewer's terms. */
  body: string;
  confirmLabel: string;
  destructive?: boolean;
  /** The commit is in flight; both controls are disabled. */
  busy?: boolean;
  /** A failure belonging to the dialogue as a whole. */
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
}): React.JSX.Element {
  // The active scope is what makes this modal: only its controls are focus candidates.
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
          {/* Cancel takes the focus: the safe choice is the default. */}
          <Button label="Cancel" onSelect={onCancel} scope={CONFIRM_SCOPE} defaultFocus disabled={busy} />
          <Button
            label={busy ? 'Working…' : confirmLabel}
            onSelect={onConfirm}
            scope={CONFIRM_SCOPE}
            disabled={busy}
            destructive={destructive}
          />
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
   * background: #171719f7; box-shadow: 0 22px 70px #000d }`, without the
   * shadow: Android's `elevation` cannot reproduce it.
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
});
