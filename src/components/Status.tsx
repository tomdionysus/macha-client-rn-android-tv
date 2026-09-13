import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { colour, font, pageGutter, rem, type } from '../styles/theme';

/** `.status { padding: 5rem 0; font-size: 1.2rem; color: var(--text-dim) }` */
export function Loading({ label = 'Loading…' }: { label?: string }): React.JSX.Element {
  return (
    <View style={styles.status}>
      <ActivityIndicator color={colour.focus} size="large" />
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

/** `.error { color: #ffb4b4 }` */
export function ErrorMessage({ error }: { error: Error }): React.JSX.Element {
  return (
    <View style={styles.status}>
      <Text style={[styles.statusText, styles.error]}>{error.message}</Text>
    </View>
  );
}

/**
 * A refresh failure over content that is still on screen.
 *
 * `.media-refresh-error` in the web client: the stale posters remain, and the
 * failure is reported above them rather than replacing them.
 */
export function RefreshError({ error }: { error: Error }): React.JSX.Element {
  return <Text style={styles.refreshError}>Refresh failed: {error.message}</Text>;
}

/** `h1 { font-size: clamp(2rem,4vw,4rem); margin: 1.4rem 0 1.2rem }` */
export function PageTitle({ children }: { children: string }): React.JSX.Element {
  return <Text style={styles.h1}>{children}</Text>;
}

const styles = StyleSheet.create({
  status: {
    paddingVertical: rem(5),
    alignItems: 'center',
    gap: rem(1),
  },
  statusText: {
    fontSize: type.subtitle,
    color: colour.textDim,
  },
  error: {
    color: colour.error,
  },
  refreshError: {
    marginBottom: rem(1),
    paddingHorizontal: pageGutter,
    color: colour.error,
  },
  h1: {
    // The web client's `main` supplies the 3vw gutter; here the rails manage
    // their own horizontal padding so a focused card can reach the screen
    // edge, which leaves the page furniture to apply it individually.
    paddingHorizontal: pageGutter,
    fontSize: type.h1,
    lineHeight: type.h1 * 1.02,
    letterSpacing: -type.h1 * 0.025,
    marginTop: rem(1.4),
    marginBottom: rem(1.2),
    color: colour.heading,
    fontWeight: font.weightMedium,
  },
});
