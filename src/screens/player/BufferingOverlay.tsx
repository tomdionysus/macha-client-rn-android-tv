import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colour, px, rem, type } from '../../styles/theme';

/**
 * The player's spinner: the web client's `<Loading delayMs note />` over its
 * `.player-page`.
 *
 * **Drawn outside the chrome's gate**, which is the point of it here: the
 * transport hides after four seconds, and a spinner inside it would vanish
 * with it, leaving a stalled picture unexplained to anyone not holding the
 * remote. `pointerEvents="none"` and no `Focusable`, so it never takes the
 * D-pad.
 *
 * The web ring is a bordered circle with a focus-coloured top; Android's own
 * indeterminate spinner in the focus colour is the platform's equivalent, the
 * same one `Status.tsx`'s `Loading` already uses.
 */
export function BufferingOverlay({ delayMs, note }: { delayMs: number; note?: string }): React.JSX.Element | null {
  const [visible, setVisible] = useState(delayMs <= 0);

  useEffect(() => {
    if (delayMs <= 0) {
      setVisible(true);
      return undefined;
    }
    setVisible(false);
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!visible) return null;
  return (
    <View style={styles.overlay} pointerEvents="none">
      <ActivityIndicator color={colour.focus} size={SPINNER} />
      {note ? <Text style={styles.note}>{note}</Text> : null}
    </View>
  );
}

/** `.loading-spinner { width: 42px; height: 42px }`. */
const SPINNER = px(42);

const styles = StyleSheet.create({
  /** `.loading-overlay { position: fixed; inset: 0; place-items: center; pointer-events: none }`. */
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.loading-note { margin: .9rem 0 0; color: #9a9aa4; font-size: .82rem; text-align: center }`. */
  note: {
    marginTop: rem(0.9),
    color: '#9a9aa4',
    fontSize: type.small,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
