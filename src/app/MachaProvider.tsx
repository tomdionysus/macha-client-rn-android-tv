import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  bootstrapEndpoints,
  configureMachaHost,
  createMachaServices,
  EndpointHealthMonitor,
  EndpointRegistry,
  memoryStorage,
  sessionManager,
  ContinueWatchingStore,
  PlaybackQueueStore,
  VolumeStore,
  type MachaServices,
} from '@macha/core';
import {
  clientConfiguration,
  getBootstrapEndpoints,
  getClientId,
  getDiscoveredEndpoints,
} from '../state/client';
import { nativeStorage } from '../state/storage';

/**
 * Brings up the core once, in the order it requires.
 *
 * `configureMachaHost` must run **before any service is constructed**. Several
 * module-level singletons — `sessionManager` among them — read the host lazily
 * on first use and keep whatever they found. On the web the auto-detected
 * default happens to be the right object and getting this wrong is invisible;
 * on React Native it means a session cached into a throwaway map and re-minted
 * on every start.
 */
export interface Macha {
  services: MachaServices;
  registry: EndpointRegistry;
  continueWatching: ContinueWatchingStore;
  queue: PlaybackQueueStore;
  volume: VolumeStore;
  /** False only while a cold-start token mint is genuinely in flight. */
  sessionReady: boolean;
}

const MachaContext = createContext<Macha | undefined>(undefined);

export function useMacha(): Macha {
  const macha = useContext(MachaContext);
  if (!macha) throw new Error('useMacha called outside MachaProvider');
  return macha;
}

/**
 * Configure the host at module scope, not in an effect.
 *
 * An effect runs after the first render, and the first render already
 * constructs services. Storage is hydrated before this module is imported —
 * see the await in `App`.
 */
let hostConfigured = false;
export function configureHost(): void {
  if (hostConfigured) return;
  hostConfigured = true;
  configureMachaHost({
    storage: nativeStorage,
    // Only has to survive one run, and persisting it would defeat its purpose.
    ephemeralStorage: memoryStorage(),
    origin: clientConfiguration.serverUrl(),
  });
}

export function MachaProvider({ children }: { children: ReactNode }): React.JSX.Element {
  configureHost();

  const registry = useMemo(
    () => new EndpointRegistry(bootstrapEndpoints([...getBootstrapEndpoints(), ...getDiscoveredEndpoints()])),
    [],
  );

  // Memoized on the registry and the auth singleton and nothing else.
  // Rebuilding services mid-playback orphans the active generation's node
  // ownership, and a token refresh is never a reason to rebuild: every service
  // authenticates through `auth` at request time.
  const services = useMemo(
    () => createMachaServices({ endpointRegistry: registry, auth: sessionManager }),
    [registry],
  );

  // Every store is scoped to the client id, so two televisions on one cluster
  // keep separate Continue Watching and queues.
  const stores = useMemo(() => {
    const clientId = getClientId();
    return {
      continueWatching: new ContinueWatchingStore(clientId),
      queue: new PlaybackQueueStore(clientId),
      volume: new VolumeStore(clientId),
    };
  }, []);

  const [sessionReady, setSessionReady] = useState(sessionManager.isReady);

  useEffect(() => sessionManager.subscribe(() => setSessionReady(sessionManager.isReady)), []);

  useEffect(() => {
    sessionManager.start(registry);
    return () => sessionManager.stop();
  }, [registry]);

  useEffect(() => {
    const health = new EndpointHealthMonitor({
      registry,
      clusterStatusApi: services.clusterStatusApi,
      auth: sessionManager,
      configuration: clientConfiguration,
    });
    health.start();
    return () => health.stop();
  }, [registry, services]);

  /**
   * Stop discovery while the app is not foreground.
   *
   * A television app that is backgrounded is not playing and not being looked
   * at; continuing to poll the cluster from behind the launcher costs the nodes
   * requests for nobody's benefit.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') sessionManager.start(registry);
    });
    return () => subscription.remove();
  }, [registry]);

  const value = useMemo<Macha>(
    () => ({ services, registry, ...stores, sessionReady }),
    [services, registry, stores, sessionReady],
  );

  return <MachaContext.Provider value={value}>{children}</MachaContext.Provider>;
}
