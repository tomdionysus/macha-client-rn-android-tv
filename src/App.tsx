import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import {
  sessionManager,
  type Episode,
  type MediaSummary,
  type PlaybackProgress,
  type VersionStep,
} from '@machafoundation/core';
import { MachaProvider, useMacha } from './app/MachaProvider';
import { usePlaybackRuntime } from './app/usePlaybackRuntime';
import { useContinueWatchingWriter } from './app/useContinueWatchingWriter';
import { backAction, TOP_LEVEL } from './app/backAction';
import { exitAfterFlush } from './app/appExit';
import { routeFocus } from './app/routeFocus';
import { flushStorage, hydrateStorage } from './state/storage';
import { EXIT_FLUSH_BUDGET_MS } from './player/timingBudgets';
import { syncDiagnosticsLevel } from './diagnostics/failureTrailSetting';
import { useTvNavigation } from './hooks/useTvNavigation';
import { tvFocus } from './hooks/tvFocus';
import { isMediaFocusId, mediaFocusId } from './hooks/useAlphabetIndex';
import { libraryTrail, type KnownAncestry } from './app/libraryTrail';
import { SIGN_OUT_REVOKE_FAILED } from './text/viewerText';
import { useEpisodeNeighbours } from './app/useEpisodeNeighbours';
import { episodeToPlayOnEnd } from './app/autoAdvance';
import { availableToPlay } from '@machafoundation/core';
import { startPreferences } from './app/startPreferences';
import { attributableProgress } from './app/progressAttribution';
import { orphanedSessions } from './state/liveSessions';
import { playbackLog } from './diagnostics/playbackLog';
import { androidTvPlatform } from './platform/AndroidTvPlatform';
import { deviceQualityCeiling } from './player/qualityCeiling';
import { qualityPreferenceStore } from './state/qualityPreference';
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
 * The web client's navigation less Import and Manage, which want a keyboard.
 * Settings is the cog at the trailing edge, as there.
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


/** A show or season is not playable, so opening one drills in. */
function routeForMedia(media: MediaSummary): Route {
  if (media.kind === 'show') return { name: 'series', media };
  if (media.kind === 'season') return { name: 'season', media };
  return { name: 'detail', media };
}

function Shell(): React.JSX.Element {
  const { services, continueWatching, sessionReady } = useMacha();
  // Identity, for display only; the gate below reads roles from the token.
  const { session, refresh: refreshSession } = useCurrentSession(services.usersApi, sessionReady);
  // Refused, unreachable or still open, from facts core states; an absent
  // token is never read as a refusal. Latched, so a failed refresh mid-film
  // cannot replace the player.
  const { failure, roles, identity } = useSessionFacts();
  /** Set when sign-out is committed; cleared by signing in again. */
  const [signedOut, setSignedOut] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string>();
  /**
   * What ends an admission already held: the viewer signing out, or core
   * stating the session's identity changed to one with no roles. Anything
   * else after admission is a transient the latch absorbs. See `access.ts`.
   */
  const ended: AdmissionEnded | undefined = signedOut
    ? 'signed-out'
    : lapsedIdentity(identity, roles)
      ? 'identity-changed'
      : undefined;
  const access = useAccessLatched(accessState(sessionReady, failure, roles, ended));
  const [settingsWhileLocked, setSettingsWhileLocked] = useState(false);
  /** A stack, so Back unwinds level by level. The last entry is the visible screen. */
  const [stack, setStack] = useState<Route[]>([{ name: 'home' }]);
  const route = stack[stack.length - 1] ?? { name: 'home' };
  const [progress, setProgress] = useState<PlaybackProgress[]>([]);

  /**
   * Focus on each screen beneath the top, by stack depth, so Back restores it.
   * Only media cards (`mediaFocusId`) are restorable; anything else falls back
   * to the screen default.
   */
  const focusMemory = useRef<(string | undefined)[]>([]);
  const focusToRestore = useRef<string | undefined>(undefined);
  /** Set when the top bar chose the next screen, so focus stays on its button (`routeFocus`). */
  const chosenFromNav = useRef(false);

  const push = useCallback(
    (next: Route) => {
      // Only a media card: other focus ids are regenerated at each mount.
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
   * Put a TV item on its library trail (`libraryTrail`) beneath `top`, with
   * focus memory rebuilt so each Back lands on the level it came from.
   * False when the item names no ancestry; the stack is then untouched.
   */
  const placeOnTrail = useCallback((top: Route, media: MediaSummary, known?: KnownAncestry): boolean => {
    const trail = libraryTrail(media, known);
    if (!trail) return false;
    focusMemory.current = trail.map((level) => mediaFocusId(level.returnTo));
    focusToRestore.current = undefined;
    setStack([...trail.map((level) => level.route as Route), top]);
    return true;
  }, []);

  /**
   * The playback facts endpoint rather than the catalogue profile: it carries
   * the node's `operations`. Every file is passed, since core's coordinator
   * chooses among an item's files.
   */
  const runtimeOptions = useMemo(
    () => ({
      facts: async (media: MediaSummary) => {
        const files = await services.playbackFactsApi.facts({ itemId: media.id });
        return files.length > 0 ? files : undefined;
      },
      // Read at each start. Caps automatic play only, not a version the
      // viewer picks.
      qualityCeiling: deviceQualityCeiling,
      // Offer only what this set plays, unless the setting asks for everything.
      offerAll: () => qualityPreferenceStore().get().offerAll ?? false,
    }),
    [services.playbackFactsApi],
  );

  const { runtime } = usePlaybackRuntime(androidTvPlatform, services.playbackResolver, runtimeOptions);

  /**
   * Writes the resume point during playback: `closePlayer` covers only a
   * deliberate exit, and the TCL set has been measured force-stopping the app.
   */
  useContinueWatchingWriter(
    runtime,
    continueWatching,
    route.name === 'player' ? route.media : undefined,
  );

  useEffect(() => {
    if (route.name === 'home') setProgress(continueWatching.list());
  }, [continueWatching, route.name]);

  const recordPlayingProgress = useCallback(() => {
    const media = route.name === 'player' ? route.media : undefined;
    const progress = attributableProgress(runtime.getPlaybackSnapshot(), media);
    if (progress) continueWatching.update(progress);
  }, [runtime, route, continueWatching]);

  /**
   * Leaving the player writes the resume point, then stops the session: one
   * left open holds the node's single transcode slot (429 for the next viewer).
   */
  const closePlayer = useCallback(() => {
    recordPlayingProgress();
    void runtime.stop();
    pop();
  }, [runtime, recordPlayingProgress, pop]);

  /**
   * Playback is stopped, and awaited, before the token changes: afterwards
   * the session cannot be closed and holds the node's transcode slot until
   * `session_idle`. Core clears local state before revoking, so a throw means
   * the session may still be live on a node; that is shown, not swallowed.
   */
  const signOut = useCallback(async () => {
    setSignOutError(undefined);
    setSigningOut(true);
    try {
      await runtime.stop();
      await sessionManager.signOut();
    } catch {
      setSignOutError(SIGN_OUT_REVOKE_FAILED);
    } finally {
      setSigningOut(false);
      // Local state is cleared whether or not the revoke succeeded. The stack
      // goes home so the next sign-in does not resume deep in the library.
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
    // Only Home exits, and only after storage is flushed (`backAction`,
    // `exitAfterFlush`); the press is always consumed.
    const action = backAction(route.name, stack.length);
    if (action === 'exit') void exitAfterFlush(flushStorage, () => BackHandler.exitApp(), EXIT_FLUSH_BUDGET_MS);
    else if (action === 'home') setStack([{ name: 'home' }]);
    else pop();
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
    // Same as the player's episode buttons. `episodeNav` and `switchEpisode`
    // are declared below; these run later, on a key.
    onNext: () => {
      if (route.name === 'player' && episodeNav.next) switchEpisode(episodeNav.next);
    },
    onPrevious: () => {
      if (route.name === 'player' && episodeNav.previous) switchEpisode(episodeNav.previous);
    },
  });

  // Re-seed focus when the screen changes; on the way back, restore the place
  // the viewer left. A remembered id that no longer registers falls through
  // to the default (`TvFocusRegistry.current()`).
  useEffect(() => {
    const remembered = focusToRestore.current;
    focusToRestore.current = undefined;
    const fromNav = chosenFromNav.current;
    chosenFromNav.current = false;
    const action = routeFocus({ fromNav, remembered });
    if (action === 'keep') {
      // Re-selecting makes the selection the viewer's choice, so the new
      // screen's default card cannot take it.
      tvFocus.select(tvFocus.selected());
      return;
    }
    if (action === 'default') {
      tvFocus.focusDefault();
      return;
    }

    // The returned-to screen re-fetches, so its cards are usually not yet
    // registered (measured on the TCL set): seed the default now, and let the
    // card claim focus when it registers. A key press abandons the restore.
    tvFocus.focusDefault();
    tvFocus.restoreWhenPresent(remembered);
  }, [route.name]);

  const open = useCallback(
    (media: MediaSummary) => {
      const next = routeForMedia(media);
      if (!placeOnTrail(next, media)) push(next);
    },
    [push, placeOnTrail],
  );

  /**
   * Puts the item's own detail screen (`routeForMedia`) beneath the player
   * unless the viewer is already on it, so Back from playback lands there.
   */
  const play = useCallback(
    (media: MediaSummary, startPositionMs: number, known?: KnownAncestry, version?: VersionStep) => {
      // The one path every Play control shares: an unavailable title never starts.
      if (!availableToPlay(media)) {
        playbackLog.info('play-refused-unavailable', { mediaId: media.id });
        return;
      }
      // A version the viewer picked is never capped or overridden; without
      // one, core decides.
      const start = () =>
        void runtime.play(
          { media, startPositionMs, returnTo: 'detail' },
          startPreferences(startPositionMs, continueWatching.entryFor(media.id), version),
        );
      // An episode goes on its library trail, so Back arrives at its season.
      if (placeOnTrail({ name: 'player', media }, media, known)) {
        start();
        return;
      }
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
      start();
    },
    [runtime, placeOnTrail, continueWatching],
  );

  const playingMedia = route.name === 'player' ? route.media : undefined;
  const episodeNav = useEpisodeNeighbours(services.mediaApi, playingMedia);

  /**
   * Previous / next from inside the player. Writes the place being left, then
   * plays the neighbour from its own resume point. The player screen stays
   * mounted: remounting would detach the surface mid-handover.
   */
  const switchEpisode = useCallback(
    (episode: Episode) => {
      recordPlayingProgress();
      play(episode, continueWatching.positionFor(episode.id));
    },
    [recordPlayingProgress, play, continueWatching],
  );

  /**
   * When an episode ends, play the next (`episodeToPlayOnEnd`), once per
   * ending: the latch clears when playback is no longer ended.
   */
  const [playbackEnded, setPlaybackEnded] = useState(false);
  useEffect(
    () => runtime.subscribePlayback((snapshot) => setPlaybackEnded(Boolean(snapshot?.event.ended))),
    [runtime],
  );
  const advancedFrom = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!playbackEnded) {
      advancedFrom.current = undefined;
      return;
    }
    const next = episodeToPlayOnEnd(playingMedia, playbackEnded, episodeNav);
    if (!next || !playingMedia || advancedFrom.current === playingMedia.id) return;
    advancedFrom.current = playingMedia.id;
    switchEpisode(next);
  }, [playbackEnded, playingMedia, episodeNav, switchEpisode]);

  // An episode resumed without `playbackContext` goes on its trail once core
  // has looked its ancestry up.
  useEffect(() => {
    if (!playingMedia || playingMedia.kind !== 'episode' || playingMedia.playbackContext) return;
    if (!episodeNav.show || !episodeNav.season) return;
    if (stack[stack.length - 2]?.name === 'season') return;
    placeOnTrail({ name: 'player', media: playingMedia }, playingMedia, {
      show: episodeNav.show,
      season: episodeNav.season,
    });
  }, [playingMedia, episodeNav.show, episodeNav.season, stack, placeOnTrail]);

  if (route.name === 'player') {
    return (
      <PlayerScreen
        media={route.media}
        runtime={runtime}
        onClose={closePlayer}
        episodeNav={episodeNav}
        onPlayEpisode={switchEpisode}
      />
    );
  }

  const body = !sessionReady ? (
    <Loading label="Connecting…" />
  ) : route.name === 'home' ? (
    <HomeScreen
      api={services.mediaApi}
      catalogue={services.catalogueApi}
      continueWatching={progress}
      onOpen={open}
      onResume={(media) => play(media, continueWatching.positionFor(media.id))}
      // The list `clear` returns is the rail's new state.
      onRemoveFromContinueWatching={(media) => setProgress(continueWatching.clear(media.id))}
    />
  ) : route.name === 'movies' ? (
    // Keyed by kind, or React keeps one instance mounted across both lists and
    // a sort chosen on Movies carries over to TV Shows.
    <LibraryScreen key="movies" api={services.mediaApi} kind="movies" onOpen={open} />
  ) : route.name === 'shows' ? (
    <LibraryScreen key="shows" api={services.mediaApi} kind="shows" onOpen={open} />
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
      onPlay={(positionMs, version) => play(route.media, positionMs, undefined, version)}
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
        const entry = progress.find((item) => item.itemId === mediaId);
        return entry && entry.durationMs > 0 ? entry.positionMs / entry.durationMs : undefined;
      }}
    />
  ) : null;

  /**
   * Nothing answered: not an access problem, so no sign-in is offered.
   * Settings stays reachable, since pointing the set at another cluster is
   * the only action that can help.
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

  /**
   * A session granted no roles may not use the client; the wall replaces the
   * shell. Settings stays reachable, or a set whose node stops granting roles
   * could not be pointed at another cluster.
   */
  if (access.kind === 'sign-in') {
    return (
      <View style={styles.shell}>
        {settingsWhileLocked ? (
          <LockedSettings onBack={() => setSettingsWhileLocked(false)} />
        ) : (
          <LoginScreen
            guestAllowed={false}
            /*
             * Said only for the case core reports. A 401 does not separate an
             * expiry from a revoke from a role change, so nothing else is said.
             */
            notice={
              access.kind === 'sign-in' && access.because === 'identity-changed'
                ? 'This session stopped belonging to your account. Sign in again to carry on watching.'
                : undefined
            }
            onSignIn={(username, password) => sessionManager.signIn({ username, password })}
            onSignedIn={() => {
              // Clears the wall; otherwise signing straight back in stays held
              // at the login screen.
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
        // The section the stack is rooted in, not only the screen on top.
        active={TOP_LEVEL.has(route.name) ? route.name : TOP_LEVEL.has(stack[0]?.name ?? '') ? stack[0]!.name : 'home'}
        onSelect={(key) => {
          // Only when the screen changes: otherwise no effect spends the flag
          // and it would hold focus on the bar at the next change.
          if (key !== route.name) chosenFromNav.current = true;
          replaceTop({ name: key } as Route);
        }}
        username={session?.username}
        // Only for a named account; an unnamed session has nothing to leave.
        onSignOut={session?.username ? () => setConfirmingSignOut(true) : undefined}
        settingsActive={route.name === 'settings'}
        onOpenSettings={() => replaceTop({ name: 'settings' })}
      />
      <View style={styles.main}>{body}</View>
      {confirmingSignOut ? (
        <ConfirmDialog
          title="Sign out?"
          /*
           * Sign-out revokes this token only; other devices stay signed in,
           * and the wording must not claim otherwise.
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
 * Settings from behind the login wall. There is no navigation stack here, so
 * Back is handled locally.
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

  // Order: hydrate storage, then configure the host, then construct services.
  // Nothing renders until the read completes.
  useEffect(() => {
    void hydrateStorage().then(() => {
      // The buffer configured itself at import, before the setting was readable.
      syncDiagnosticsLevel();

      // Snapshot what a previous run left open before this one records
      // anything. The reconcile belongs in core (`state/liveSessions.ts`);
      // meanwhile this puts an abandoned session on the trail.
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
  // flattened to its dominant stop: RN has no CSS gradient.
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
