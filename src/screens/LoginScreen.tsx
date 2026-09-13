import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { errorMessage } from '@macha/core';
import { Focusable } from '../components/Focusable';
import { TvTextInput } from '../components/TvTextInput';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, radius, rem, type } from '../styles/theme';

export const LOGIN_SCOPE = 'login';

/**
 * Sign in as somebody.
 *
 * Usually there is nothing to "enter" here in the sense of gaining access — a
 * viewer already has a session, because every session belongs to a user and
 * empty credentials authenticate the anonymous one. This exchanges that session
 * for one belonging to a named account.
 *
 * `guestAllowed={false}` is the deployment this client currently cares about:
 * strip `media_viewer` from the anonymous account and an unauthenticated viewer
 * genuinely may do nothing, so this screen stands *in front of* the application
 * rather than beside it. **What the server permits decides which it is**, not a
 * build flag — the same screen, positioned by what the roles say.
 *
 * The wording, the identical treatment of a wrong user and a wrong password,
 * and the guest affordance are all the web client's; only the input method
 * differs, because typing here goes through the television's own keyboard.
 */
export function LoginScreen({
  onSignIn,
  onSignedIn,
  guestAllowed = true,
  onBrowseAsGuest,
  onOpenSettings,
}: {
  /** Exchanges credentials for a session. Rejects on a refusal, which is the whole point. */
  onSignIn: (username: string, password: string) => Promise<void>;
  /** Re-read who the session belongs to once it changes. */
  onSignedIn: () => void;
  /**
   * Whether there is anything to browse without signing in.
   *
   * False where the server grants the anonymous account no roles, which makes
   * this screen a wall rather than a doorway. Offering "Browse as guest" there
   * would be a button that navigates home and is bounced straight back, so the
   * choice is removed rather than left to fail.
   */
  guestAllowed?: boolean;
  onBrowseAsGuest?: () => void;
  /**
   * The way out.
   *
   * A television has no address bar. Without a route to the endpoint settings,
   * a set whose node stops granting roles can neither sign in nor be pointed
   * anywhere else — it is simply bricked, and the only remedy is a reinstall.
   * The web client keeps its connection screen reachable behind the same wall
   * for the same reason, after 0.13.0 shipped exactly that lockout.
   */
  onOpenSettings?: () => void;
}): React.JSX.Element {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  /**
   * Claim the focus scope while this screen is up.
   *
   * Not optional bookkeeping: the registry only offers candidates matching the
   * active scope, and every focusable here declares one — so without this push
   * nothing on the screen is reachable and the D-pad does nothing at all. It
   * also keeps anything still mounted behind the wall out of reach.
   */
  useEffect(() => {
    tvFocus.pushScope(LOGIN_SCOPE);
    return () => tvFocus.popScope(LOGIN_SCOPE);
  }, []);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSignIn(username.trim(), password);
      setPassword('');
      onSignedIn();
    } catch (cause) {
      // Deliberately shown as the server worded it. The server answers an
      // unknown user and a wrong password identically and in the same time, and
      // rewording it here would risk reintroducing the difference.
      setError(errorMessage(cause));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <Image source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Sign in to Macha</Text>
      <Text style={styles.blurb}>
        {guestAllowed
          ? 'Sign in to see your own history and settings.'
          : 'This server requires an account to watch anything.'}
      </Text>

      <View style={styles.form}>
        <TvTextInput
          label="Username"
          value={username}
          onChangeText={setUsername}
          scope={LOGIN_SCOPE}
          defaultFocus
          focusId="login:username"
        />
        <TvTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          onSubmit={submit}
          secure
          scope={LOGIN_SCOPE}
          focusId="login:password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Action label={busy ? 'Signing in…' : 'Sign in'} onSelect={submit} primary />
          {guestAllowed && onBrowseAsGuest ? (
            <Action label="Browse as guest" onSelect={onBrowseAsGuest} />
          ) : null}
          {onOpenSettings ? <Action label="Server settings" onSelect={onOpenSettings} /> : null}
        </View>
      </View>
    </View>
  );
}

function Action({
  label,
  onSelect,
  primary,
}: {
  label: string;
  onSelect: () => void;
  primary?: boolean;
}): React.JSX.Element {
  return (
    <Focusable
      ring={false}
      scope={LOGIN_SCOPE}
      onSelect={onSelect}
      style={[styles.action, primary && styles.actionPrimary]}
      focusedStyle={styles.actionFocused}
    >
      {() => <Text style={styles.actionLabel}>{label}</Text>}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colour.background,
    paddingHorizontal: rem(3),
  },
  logo: {
    width: rem(4),
    height: rem(4),
    marginBottom: rem(1),
  },
  title: {
    color: colour.text,
    fontSize: type.h2,
    fontWeight: font.weightSemibold,
  },
  blurb: {
    color: colour.textDim,
    fontSize: type.body,
    marginTop: rem(0.3),
    marginBottom: rem(1.5),
    textAlign: 'center',
  },
  form: {
    minWidth: rem(22),
  },
  error: {
    color: colour.text,
    fontSize: type.small,
    marginBottom: rem(0.8),
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rem(0.6),
    marginTop: rem(0.4),
  },
  action: {
    paddingHorizontal: rem(1),
    paddingVertical: rem(0.55),
    borderRadius: radius.control,
    backgroundColor: colour.surface2,
  },
  actionPrimary: {
    backgroundColor: colour.accent,
  },
  actionFocused: {
    backgroundColor: colour.surface3,
  },
  actionLabel: {
    color: colour.text,
    fontSize: type.body,
  },
});
