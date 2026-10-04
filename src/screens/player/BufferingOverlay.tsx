import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colour, px, rem, type } from '../../styles/theme';

/**
 * The player's spinner: the web client's `<Loading delayMs note />` over
 * `.player-page`. Drawn outside the chrome's gate so it does not hide with the
 * transport, and never focusable.
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

/** `.loading-spinner { width: 42px; height: 42px }` */
const SPINNER = px(42);

const styles = StyleSheet.create({
  /** `.loading-overlay { position: fixed; inset: 0; place-items: center; pointer-events: none }` */
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** `.loading-note { margin: .9rem 0 0; color: #9a9aa4; font-size: .82rem; text-align: center }` */
  note: {
    marginTop: rem(0.9),
    color: '#9a9aa4',
    fontSize: type.small,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
