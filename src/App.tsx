import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import { progressFor, sessionManager, type MediaSummary, type PlaybackProgress } from '@macha/core';
import { MachaProvider, useMacha } from './app/MachaProvider';
import { usePlaybackRuntime } from './app/usePlaybackRuntime';
import { hydrateStorage } from './state/storage';
import { useTvNavigation } from './hooks/useTvNavigation';
import { tvFocus } from './hooks/tvFocus';
import { androidTvPlatform } from './platform/AndroidTvPlatform';
import { TopBar, type NavItem } from './components/TopBar';
import { Loading } from './components/Status';
import { HomeScreen } from './screens/HomeScreen';
import { LibraryScreen } from './screens/LibraryScreen';
import { DetailScreen } from './screens/DetailScreen';
import { SeriesScreen, SeasonScreen } from './screens/SeriesScreen';
import { PlayerScreen } from './screens/PlayerScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { LoginScreen } from './screens/LoginScreen';
import { OfflineScreen } from './screens/OfflineScreen';
import { useCurrentSession } from './app/useCurrentSession';
import { accessState, useAccessLatched, useSessionFacts } from './app/access';
import { colour, screenSize } from './styles/theme';

const NAV: NavItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'movies', label: 'Movies' },
  { key: 'shows', label: 'TV Shows' },
  { key: 'settings', label: 'Settings' },
];

type Route =
  | { name: 'home' }
  | { name: 'movies' }
  | { name: 'shows' }
  | { name: 'settings' }
  | { name: 'detail'; media: MediaSummary }
  | { name: 'series'; media: MediaSummary }
  | { name: 'season'; media: MediaSummary }
  | { name: 'player'; media: MediaSummary };

const TOP_LEVEL = new Set(['home', 'movies', 'shows', 'settings']);

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
  const { refresh: refreshSession } = useCurrentSession(services.usersApi, sessionReady);
  // Three outcomes, not two: the server said no, nothing answered, or the
  // question is still open. Every input is a fact core states — nothing here
  // infers access from an absent token, which is the mistake that put a login
  // wall in front of a network blip. Latched, so a failed refresh mid-film can
  // never replace the player.
  const { failure, roles } = useSessionFacts();
  const access = useAccessLatched(accessState(sessionReady, failure, roles));
  const [settingsWhileLocked, setSettingsWhileLocked] = useState(false);
  /**
   * A stack, so Back unwinds season → series → library rather than jumping to
   * Home from three levels deep. The last entry is the visible screen.
   */
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1] ?? { name: 'home' };
  const [progress, setProgress] = useState<PlaybackProgress[]>([]);

  const push = useCallback((next: Route) => setStack((current) => [...current, next]), []);
  const pop = useCallback(
    () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current)),
    [],
  );
  const replaceTop = useCallback((next: Route) => setStack([next]), []);

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

  const onBack = useCallback((): boolean => {
    if (route.name === 'player') {
      closePlayer();
      return true;
    }
    // Back on a top-level screen is the platform's to handle — that is how a
    // viewer leaves the app, and swallowing it would trap them in it.
    if (stack.length === 1 && TOP_LEVEL.has(route.name)) return false;
    pop();
    return true;
  }, [route.name, stack.length, closePlayer, pop]);

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
  // `hashchange` listener does.
  useEffect(() => {
    tvFocus.focusDefault();
  }, [route.name]);

  const open = useCallback((media: MediaSummary) => push(routeForMedia(media)), [push]);

  const play = useCallback(
    (media: MediaSummary, startPositionMs: number) => {
      push({ name: 'player', media });
      void runtime.play({ media, startPositionMs, returnTo: 'detail' });
    },
    [runtime, push],
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
            onSignIn={(username, password) => sessionManager.signIn({ username, password })}
            onSignedIn={refreshSession}
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
        badge="Android TV"
      />
      <View style={styles.main}>{body}</View>
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
    void hydrateStorage().then(() => setReady(true));
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
