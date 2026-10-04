import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { signInErrorText } from '../text/viewerText';
import { Button } from '../components/Button';
import { TvTextInput } from '../components/TvTextInput';
import { tvFocus } from '../hooks/tvFocus';
import { colour, font, rem, type } from '../styles/theme';

export const LOGIN_SCOPE = 'login';

/**
 * The typed draft, kept across the unmount for Server settings. Memory only:
 * the username clears on a successful sign-in, the password on every attempt.
 */
const draft = { username: '', password: '' };

/**
 * Exchanges the anonymous session for a named account's. With
 * `guestAllowed={false}` the anonymous account lacks `media_viewer`, and this
 * screen stands in front of the application. Wording, the identical treatment
 * of a wrong user and a wrong password, and the guest option are the web
 * client's.
 */
export function LoginScreen({
  onSignIn,
  onSignedIn,
  guestAllowed = true,
  onBrowseAsGuest,
  onOpenSettings,
  notice,
}: {
  /** Exchanges credentials for a session. Rejects on a refusal. */
  onSignIn: (username: string, password: string) => Promise<void>;
  onSignedIn: () => void;
  /** False where the anonymous account has no roles: browsing would bounce straight back. */
  guestAllowed?: boolean;
  onBrowseAsGuest?: () => void;
  /** The only route to the endpoint settings for a set whose node stops granting roles. */
  onOpenSettings?: () => void;
  /**
   * Why the screen is up unexpectedly, replacing the standing blurb. Supplied
   * only where the caller knows: core reports no identity change against a
   * node too old to state a username.
   */
  notice?: string;
}): React.JSX.Element {
  const [username, setUsernameState] = useState(draft.username);
  const [password, setPasswordState] = useState(draft.password);
  const setUsername = (value: string) => {
    draft.username = value;
    setUsernameState(value);
  };
  const setPassword = (value: string) => {
    draft.password = value;
    setPasswordState(value);
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  /** Every focusable here declares this scope, so nothing is reachable without the push. */
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
      draft.username = '';
      onSignedIn();
    } catch (cause) {
      // See `signInErrorText`.
      setError(signInErrorText(cause));
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
        {notice ??
          (guestAllowed
            ? 'Sign in to see your own history and settings.'
            : 'This server requires an account to watch anything.')}
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

        {/*
          * On its own row, the width of the fields, so Down from the password lands
          * here by geometry; the scoring weights stay the web client's.
          */}
        <Button
          label={busy ? 'Signing in…' : 'Sign in'}
          onSelect={submit}
          scope={LOGIN_SCOPE}
          style={styles.primaryAction}
        />
        <View style={styles.actions}>
          {guestAllowed && onBrowseAsGuest ? (
            <Button label="Browse as guest" onSelect={onBrowseAsGuest} scope={LOGIN_SCOPE} />
          ) : null}
          {onOpenSettings ? <Button label="Server settings" onSelect={onOpenSettings} scope={LOGIN_SCOPE} /> : null}
        </View>
      </View>
    </View>
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
  primaryAction: {
    marginTop: rem(0.4),
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: rem(0.6),
    marginTop: rem(0.4),
  },
});
