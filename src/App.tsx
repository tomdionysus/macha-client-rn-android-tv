import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import {
  errorMessage,
  progressFor,
  sessionManager,
  type MediaSummary,
  type PlaybackProgress,
} from '@machafoundation/core';
import { MachaProvider, useMacha } from './app/MachaProvider';
import { usePlaybackRuntime } from './app/usePlaybackRuntime';
import { hydrateStorage } from './state/storage';
import { syncDiagnosticsLevel } from './diagnostics/failureTrailSetting';
import { useTvNavigation } from './hooks/useTvNavigation';
import { tvFocus } from './hooks/tvFocus';
import { isMediaFocusId } from './hooks/useAlphabetIndex';
import { orphanedSessions } from './state/liveSessions';
import { playbackLog } from './diagnostics/playbackLog';
import { androidTvPlatform } from './platform/AndroidTvPlatform';
import { TopBar, type NavItem } from './components/TopBar';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Loading } from './components/Status';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { DetailScreen } from './screens/DetailScreen';
import { SeriesScreen, SeasonScreen } from './screens/SeriesScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SearchScreen } from './screens/SearchScreen';
import { StatusScreen } from './screens/StatusScreen';
import { MusicScreen } from './screens/MusicScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OfflineScreen } from './screens/OfflineScreen';
import { useCurrentSession } from './app/useCurrentSession';
import {
  accessState,
  lapsedIdentity,
  useAccessLatched,
  useSessionFacts,
  type AdmissionEnded,
} from './app/access';
import { colour, screenSize } from './styles/theme';

/**
 * The web client's navigation, less the two that do not belong on a remote.
 *
 * Its list is Home, Movies, TV Shows, Music, Search, Import, Status, Manage.
 * **Import and Manage are out regardless of what the account may do** (Tom,
 * 2026-09-19) — that client already drops Import on a TV build for the reason
 * it states in `App.tsx`: importing wants a keyboard, a file browser and
 * somebody willing to type paths, none of which a remote has. Manage is the
 * same argument, and §3.3 had already ruled a 10-foot UI a poor place to retag
 * a film.
 *
 * Settings is not here and is not missing: it is the cog at the trailing edge,
 * as it is there.
 */
const NAV: NavItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'movies', label: 'Movies' },
  { key: 'shows', label: 'TV Shows' },
  { key: 'music', label: 'Music' },
  { key: 'search', label: 'Search' },
  { key: 'status', label: 'Status' },
];

type Route =
  | { name: 'home' }
  | { name: 'movies' }
  | { name: 'shows' }
  | { name: 'music' }
  | { name: 'search' }
  | { name: 'status' }
  | { name: 'settings' }
  | { name: 'detail'; media: MediaSummary }
  | { name: 'series'; media: MediaSummary }
  | { name: 'season'; media: MediaSummary }
  | { name: 'player'; media: MediaSummary };

const TOP_LEVEL = new Set(['home', 'movies', 'shows', 'music', 'search', 'status', 'settings']);

/**
 * Which screen a catalogue item opens.
 *
 * A show is not playable and a season is not playable — only their descendants
 * are — so opening one drills in rather than offering a Play button that has no
 * media behind it.
 */
function routeForMedia(media: MediaSummary): Route {
  if (media.kind === 'show') return { name: 'series', media };
  if (media.kind === 'season') return { name: 'season', media };
  return { name: 'detail', media };
}

function Shell(): React.JSX.Element {
  const { services, continueWatching, sessionReady } = useMacha();
  // Identity, for display only. The gate below does not consult it: roles now
  // arrive with the token, so there is no whoami race to get wrong.
  const { session, refresh: refreshSession } = useCurrentSession(services.usersApi, sessionReady);
  // Three outcomes, not two: the server said no, nothing answered, or the
  // question is still open. Every input is a fact core states — nothing here
  // infers access from an absent token, which is the mistake that put a login
  // wall in front of a network blip. Latched, so a failed refresh mid-film can
  // never replace the player.
  const { failure, roles, identity } = useSessionFacts();
  /** Set the moment the viewer's sign-out is committed, and cleared by signing in again. */
  const [signedOut, setSignedOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  /**
   * The two things that end an admission the viewer already had.
   *
   * Everything else that looks like a refusal after admission is a transient
   * the latch is there to absorb. These are not: one is the viewer asking, and
   * the other is core stating that the session stopped belonging to them and
   * that what replaced it can do nothing. Without this the second state has no
   * exit at all — the shell stays up, every screen answers
   * `403 requires the 'media_viewer' role`, and there is nothing to press.
   * Tom met exactly that on `.133` on 2026-09-21. See `access.ts`.
   */
  const ended: AdmissionEnded | undefined = signedOut
    ? 'signed-out'
    : lapsedIdentity(identity, roles)
      ? 'identity-changed'
      : undefined;
  const access = useAccessLatched(accessState(sessionReady, failure, roles, ended));
  const [settingsWhileLocked, setSettingsWhileLocked] = useState(false);
  /**
   * A stack, so Back unwinds season → series → library rather than jumping to
   * Home from three levels deep. The last entry is the visible screen.
   */
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1] ?? { name: 'home' };
  const [progress, setProgress] = useState<PlaybackProgress[]>([]);

  /**
   * Where focus was on each screen beneath the top, so Back can put it back.
   *
   * Indexed by stack depth. **Measured on the television 2026-09-21:** Back out
   * of a detail screen re-seeded focus to the screen default, which on a
   * library page is the navigation bar — so a viewer who opened the fourth film
   * of the second row came back to the top of the page, with their place in
   * several hundred titles gone. A remote has no scrollbar and no pointer to
   * get it back with; it is Down, Down, Right, Right, Right.
   *
   * Only what is addressable can be restored: a card registers under
   * `mediaFocusId` when a screen asks for it (`LibraryScreen`), and everything
   * else falls back to the default exactly as before.
   */
  const focusMemory = useRef<(string | undefined)[]>([]);
  const focusToRestore = useRef<string | undefined>(undefined);

  const push = useCallback(
    (next: Route) => {
      // Only a media card is worth remembering: everything else takes a
      // generated id that is a different string next time the screen mounts.
      const selected = tvFocus.selected();
      focusMemory.current[stack.length - 1] = isMediaFocusId(selected) ? selected : undefined;
      setStack((current) => [...current, next]);
    },
    [stack.length],
  );
  const pop = useCallback(() => {
    if (stack.length <= 1) return;
    focusToRestore.current = focusMemory.current[stack.length - 2];
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, [stack.length]);
  const replaceTop = useCallback((next: Route) => {
    focusMemory.current = [];
    focusToRestore.current = undefined;
    setStack([next]);
  }, []);

  /**
   * What the instruction chooser reasons from.
   *
   * The playback facts endpoint, not the catalogue profile: it carries the
   * canonical container, real bit depth, colour transfer and Dolby Vision
   * profile, plus the node's `operations` — what this build will actually mux
   * and copy, which no catalogue profile knows.
   */
  const runtimeOptions = useMemo(
    () => ({
      facts: async (media: MediaSummary) =>
        (await services.playbackFactsApi.facts({ itemId: media.id }))[0],
    }),
    [services.playbackFactsApi],
  );

  const { runtime } = usePlaybackRuntime(androidTvPlatform, services.playbackResolver, runtimeOptions);

  useEffect(() => {
    if (route.name === 'home') setProgress(continueWatching.list());
  }, [continueWatching, route.name]);

  /**
   * Leaving the player writes the resume point, then tears the session down.
   *
   * The stop matters as much as the position: a session left open holds the
   * node's single transcode slot, and the next viewer is refused with a 429.
   */
  const closePlayer = useCallback(() => {
    const snapshot = runtime.getPlaybackSnapshot();
    const media = route.name === 'player' ? route.media : undefined;
    if (media && snapshot?.event && snapshot.event.durationMs > 0) {
      continueWatching.update(
        progressFor(media, snapshot.event.positionMs, snapshot.event.durationMs),
      );
    }
    void runtime.stop();
    pop();
  }, [runtime, route, continueWatching, pop]);

  /**
   * Leave the account, which on a television is a thing a viewer can otherwise
   * not do at all.
   *
   * **Playback is stopped first, and that ordering is core's requirement rather
   * than tidiness.** Nothing connects a playback session to an identity, so
   * once the token changes a session created under the old one can no longer be
   * closed: the node holds its transcode entitlement until `session_idle` —
   * thirty minutes — and on a one-slot node the next viewer gets
   * `429 resource_limit` with nothing pointing at the client that caused it.
   * The stop is awaited for the same reason `closePlayer`'s is not: there,
   * nothing follows that could invalidate it; here, the very next line does.
   *
   * **The revoke's failure is shown rather than swallowed.** Core clears local
   * state first and unconditionally — once the viewer has asked to be signed
   * out, still being signed in is the one outcome that must not happen — and
   * only then revokes, so a throw here means the session is gone from this
   * television but may still be live on a node. That is worth a sentence,
   * because the remedy is somebody else's.
   */
  const signOut = useCallback(async () => {
    setSignOutError(undefined);
    setSigningOut(true);
    try {
      await runtime.stop();
      await sessionManager.signOut();
    } catch (cause) {
      setSignOutError(errorMessage(cause));
    } finally {
      setSigningOut(false);
      // Regardless of the revoke: local state is cleared either way, so this
      // television is signed out and the wall belongs up. Sending the stack
      // home as well, so signing back in does not resume three levels deep in
      // somebody else's library.
      setSignedOut(true);
      setConfirmingSignOut(false);
      setStack([{ name: 'home' }]);
    }
  }, [runtime]);

  const onBack = useCallback((): boolean => {
    if (confirmingSignOut) {
      if (!signingOut) setConfirmingSignOut(false);
      return true;
    }
    if (route.name === 'player') {
      closePlayer();
      return true;
    }
    // Back on a top-level screen is the platform's to handle — that is how a
    // viewer leaves the app, and swallowing it would trap them in it.
    if (stack.length === 1 && TOP_LEVEL.has(route.name)) return false;
    pop();
    return true;
  }, [route.name, stack.length, closePlayer, pop, confirmingSignOut, signingOut]);

  useTvNavigation({
    onBack,
    onPlayPause: () => {
      if (route.name !== 'player') return;
      runtime.setPaused(!(runtime.getPlaybackSnapshot()?.intent.paused ?? false));
    },
    onRewind: () => route.name === 'player' && runtime.seekBy(-10_000),
    onFastForward: () => route.name === 'player' && runtime.seekBy(10_000),
    onStop: () => route.name === 'player' && closePlayer(),
  });

  // Re-seed focus when the screen changes, the job the web client's
  // `hashchange` listener does — except on the way *back*, where the screen
  // being returned to already has a place the viewer left from.
  //
  // A remembered id that no longer registers is not a failure case worth
  // guarding: `TvFocusRegistry.current()` falls through a dangling selection to
  // the screen's default, so a title that has left the library behaves exactly
  // as it did before this existed.
  useEffect(() => {
    const remembered = focusToRestore.current;
    focusToRestore.current = undefined;
    if (!isMediaFocusId(remembered)) {
      tvFocus.focusDefault();
      return;
    }

    // **Seed the default, then arm the restore.** The screen being returned to
    // re-mounts and re-fetches, so its cards are usually not registered yet —
    // measured on the television, where restoring here found nothing and left
    // focus on the navigation bar, which is the fault this exists to fix.
    //
    // So something is highlighted immediately, and the card claims focus when
    // it registers. If the viewer presses anything first the restore is
    // abandoned, and if the card never arrives the default simply stands.
    // No timer, deliberately: a delay long enough to wait out a fetch would be
    // a timing budget with nothing to calibrate it against.
    tvFocus.focusDefault();
    tvFocus.restoreWhenPresent(remembered);
  }, [route.name]);

  const open = useCallback((media: MediaSummary) => push(routeForMedia(media)), [push]);

  /**
   * Playing leaves the item's own detail screen underneath the player.
   *
   * **Tom, 2026-09-20: Back out of a film arrives at the media detail screen.**
   * It already did from the one path that goes through it — press Play on a
   * detail screen and the detail screen is what is beneath — and did not from
   * the two that skip it. Continue Watching dropped the viewer on Home, and an
   * episode played from a season list dropped them on the season, which is the
   * list they came from rather than the thing they were watching.
   *
   * So the route is synthesised here rather than at each caller: whatever a
   * viewer presses Play on, the screen for that item is put under the player
   * unless it is already the screen they are standing on. `routeForMedia`
   * decides which screen that is, so an episode gets its own detail rather
   * than its season's.
   *
   * It is the same stack in both directions — Back walks it, and so does the
   * player's own close — so nothing else has to know this happened.
   */
  const play = useCallback(
    (media: MediaSummary, startPositionMs: number) => {
      setStack((current) => {
        const beneath = current[current.length - 1];
        const detail = routeForMedia(media);
        const alreadyBeneath =
          beneath !== undefined &&
          beneath.name === detail.name &&
          'media' in beneath &&
          beneath.media.id === media.id;
        return alreadyBeneath
          ? [...current, { name: 'player', media }]
          : [...current, detail, { name: 'player', media }];
      });
      void runtime.play({ media, startPositionMs, returnTo: 'detail' });
    },
    [runtime],
  );

  if (route.name === 'player') {
    return <PlayerScreen media={route.media} runtime={runtime} onClose={closePlayer} />;
  }

  const body = !sessionReady ? (
    <Loading label="Connecting…" />
  ) : route.name === 'home' ? (
    <HomeScreen
      api={services.mediaApi}
      continueWatching={progress}
      onOpen={open}
      onResume={(media) => play(media, continueWatching.positionFor(media.id))}
    />
  ) : route.name === 'movies' ? (
    <LibraryScreen api={services.mediaApi} kind="movies" onOpen={open} />
  ) : route.name === 'shows' ? (
    <LibraryScreen api={services.mediaApi} kind="shows" onOpen={open} />
  ) : route.name === 'music' ? (
    <MusicScreen api={services.mediaApi} onOpen={open} />
  ) : route.name === 'search' ? (
    <SearchScreen api={services.mediaApi} onOpen={open} />
  ) : route.name === 'status' ? (
    <StatusScreen api={services.clusterStatusApi} />
  ) : route.name === 'settings' ? (
    <SettingsScreen />
  ) : route.name === 'detail' ? (
    <DetailScreen
      media={route.media}
      resumePositionMs={continueWatching.positionFor(route.media.id)}
      onPlay={(positionMs) => play(route.media, positionMs)}
      onBack={pop}
    />
  ) : route.name === 'series' ? (
    <SeriesScreen api={services.mediaApi} show={route.media} onOpenSeason={open} />
  ) : route.name === 'season' ? (
    <SeasonScreen
      api={services.mediaApi}
      season={route.media}
      onPlayEpisode={(episode) => play(episode, continueWatching.positionFor(episode.id))}
      progressFor={(mediaId) => {
        const entry = progress.find((item) => item.mediaId === mediaId);
        return entry && entry.durationMs > 0 ? entry.positionMs / entry.durationMs : undefined;
      }}
    />
  ) : null;

  /**
   * A session the server granted nothing may not use this client at all.
   *
   * This replaces the shell rather than rendering inside it: leaving the
   * navigation up would offer rows that cannot load and a player that cannot
   * start, which reads as a broken client rather than as a server that
   * requires an account.
   *
   * **Settings stays reachable from behind the wall.** A television has no
   * address bar, so without it a set whose node stops granting roles can
   * neither sign in nor be pointed at a different cluster — bricked, with a
   * reinstall as the only remedy. The web client keeps its connection screen
   * reachable for the same reason, after 0.13.0 shipped exactly that lockout
   * and needed a release to escape.
   */
  /**
   * Nothing answered. **This is not an access problem and must not look like
   * one.** Offering a sign-in here would be a lie — the viewer is away from
   * home, not unauthorised — and it would also be useless, because signing in
   * needs a reachable node as much as watching does.
   *
   * Settings stays reachable, because pointing the set at a different cluster
   * is the one action that can actually help, and a television has no address
   * bar to do it any other way.
   */
  if (access.kind === 'offline') {
    return (
      <View style={styles.shell}>
        {settingsWhileLocked ? (
          <LockedSettings onBack={() => setSettingsWhileLocked(false)} />
        ) : (
          <OfflineScreen onOpenSettings={() => setSettingsWhileLocked(true)} />
        )}
      </View>
    );
  }

  if (access.kind === 'sign-in') {
    return (
      <View style={styles.shell}>
        {settingsWhileLocked ? (
          <LockedSettings onBack={() => setSettingsWhileLocked(false)} />
        ) : (
          <LoginScreen
            guestAllowed={false}
            /*
             * Said only for the case core can actually report, and said as what
             * it is. "Signed out" would be a guess: a 401 does not separate an
             * expiry from a revoke from a role change, and core states no
             * sentence for exactly that reason. What is known is that the
             * session stopped belonging to this account and the one that
             * replaced it may do nothing — which is what the viewer is looking
             * at, and it is not a fault in the television.
             */
            notice={
              access.kind === 'sign-in' && access.because === 'identity-changed'
                ? 'This session stopped belonging to your account. Sign in again to carry on watching.'
                : undefined
            }
            onSignIn={(username, password) => sessionManager.signIn({ username, password })}
            onSignedIn={() => {
              // Clears the wall this screen was raised by. Without it a viewer
              // who signs out and straight back in is held at the login screen
              // by their own earlier decision.
              setSignedOut(false);
              refreshSession();
            }}
            onOpenSettings={() => setSettingsWhileLocked(true)}
          />
        )}
      </View>
    );
  }

  return (
    <View style={styles.shell}>
      <Image
        source={require('../assets/icon.png')}
        style={styles.watermark}
        contentFit="contain"
        pointerEvents="none"
      />
      <TopBar
        items={NAV}
        active={TOP_LEVEL.has(route.name) ? route.name : 'home'}
        onSelect={(key) => replaceTop({ name: key } as Route)}
        username={session?.username}
        // Only where there is an account to leave. An unnamed session is one
        // nobody chose to be, so signing out of it would do nothing a viewer
        // could see — the web client draws the same line, offering a way *in*
        // there rather than an account to manage.
        onSignOut={session?.username ? () => setConfirmingSignOut(true) : undefined}
        settingsActive={route.name === 'settings'}
        onOpenSettings={() => replaceTop({ name: 'settings' })}
      />
      <View style={styles.main}>{body}</View>
      {confirmingSignOut ? (
        <ConfirmDialog
          title="Sign out?"
          /*
           * What sign-out actually does, in the web client's words, because it
           * measured them: `logout` revokes *this* token, and the revocation
           * propagating to every node means this token cannot be used against a
           * different one — not that every session the account holds is ended.
           * That client shipped the stronger sentence once and corrected it;
           * telling somebody their other devices have been signed out when they
           * have not is the kind of wrong that stops them doing the thing they
           * actually needed.
           */
          body={`This signs ${session?.username ?? 'you'} out on this television only — anywhere else stays signed in. Anything playing here will stop.`}
          confirmLabel="Sign out"
          destructive
          busy={signingOut}
          error={signOutError}
          onConfirm={() => void signOut()}
          onCancel={() => setConfirmingSignOut(false)}
        />
      ) : null}
    </View>
  );
}

/**
 * Settings, reached from behind the login wall.
 *
 * Wrapped only to give Back a way home: there is no navigation stack here, so
 * without this the viewer reaches the one screen that can point the set at
 * another cluster and then cannot leave it.
 */
function LockedSettings({ onBack }: { onBack: () => void }): React.JSX.Element {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (tvFocus.suspended) return false;
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  return <SettingsScreen />;
}

export function App(): React.JSX.Element {
  const [ready, setReady] = useState(false);

  // Storage must be hydrated before the host is configured, and the host must
  // be configured before any service is constructed — so nothing renders until
  // the read completes.
  useEffect(() => {
    void hydrateStorage().then(() => {
      // The buffer configured itself at import, before the setting could be
      // read; a set left with Diagnostics on comes up at the level it asked for.
      syncDiagnosticsLevel();

      // Snapshot what a previous run left open, *before* this one records
      // anything — after that the list is a mixture and only the leftovers are
      // candidates to close. Core owes the reconcile that acts on it
      // (`state/liveSessions.ts`); until then this is the only thing that makes
      // an orphan visible from the set, which is worth having on its own: it
      // says a session was abandoned rather than leaving the next viewer's 429
      // looking like a server fault.
      const orphaned = orphanedSessions();
      if (orphaned.length > 0) {
        playbackLog.warn('sessions-orphaned-by-previous-run', { count: orphaned.length });
      }

      setReady(true);
    });
  }, []);

  if (!ready) {
    return (
      <View style={styles.splash}>
        <StatusBar hidden />
        <Image source={require('../assets/icon.png')} style={styles.splashLogo} contentFit="contain" />
      </View>
    );
  }

  return (
    <MachaProvider>
      <StatusBar hidden />
      <Shell />
    </MachaProvider>
  );
}

const WATERMARK = Math.min(Math.max(220, screenSize.width * 0.28), 430);

const styles = StyleSheet.create({
  // `body { background: radial-gradient(circle at 50% -20%, #27272c 0, #0e0e0f 45%) }`
  // flattened to its dominant stop: RN has no CSS gradient without a library,
  // and the top stop is barely separable from the base on a panel.
  shell: {
    flex: 1,
    backgroundColor: colour.background,
  },
  main: {
    flex: 1,
  },
  // `.app-watermark { width: clamp(220px,28vw,430px); opacity: .035 }`
  watermark: {
    position: 'absolute',
    left: '50%',
    top: '53%',
    width: WATERMARK,
    height: WATERMARK,
    transform: [{ translateX: -WATERMARK / 2 }, { translateY: -WATERMARK / 2 }],
    opacity: 0.035,
  },
  // `.splash { inset: 0; display: grid; place-items: center }`
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colour.background,
  },
  splashLogo: {
    width: Math.min(screenSize.width * 0.34, 320),
    height: Math.min(screenSize.width * 0.34, 320),
  },
});
