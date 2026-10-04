import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import {
  configureMachaHost,
  seedEndpoints,
  createMachaServices,
  EndpointHealthMonitor,
  EndpointRegistry,
  sessionManager,
  ContinueWatchingStore,
  PlaybackQueueStore,
  type MachaServices,
} from '@machafoundation/core';
import {
  clientConfiguration,
  getBootstrapEndpoints,
  getClientId,
  getDiscoveredEndpoints,
} from '../state/client';
import { nativeStorage } from '../state/storage';
import { VolumeStore } from '../state/volumeStore';

/**
 * Core, brought up once. `configureMachaHost` must run before any service is
 * constructed: singletons such as `sessionManager` read the host on first use
 * and keep what they found.
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
 * Called at module scope, not in an effect: the first render already
 * constructs services. Storage is hydrated first (the await in `App`).
 */
let hostConfigured = false;
export function configureHost(): void {
  if (hostConfigured) return;
  hostConfigured = true;
  configureMachaHost({
    storage: nativeStorage,
    // No `secureStorage`: the session token lives in app-private AsyncStorage,
    // not the Android Keystore.
    origin: clientConfiguration.serverUrl(),
  });
}

export function MachaProvider({ children }: { children: ReactNode }): React.JSX.Element {
  configureHost();

  const registry = useMemo(
    () => new EndpointRegistry(seedEndpoints({ configured: getBootstrapEndpoints(), remembered: getDiscoveredEndpoints() })),
    [],
  );

  // Never rebuilt mid-playback: that orphans the active generation's node
  // ownership. Services authenticate through `auth` at request time.
  const services = useMemo(
    () => createMachaServices({ endpointRegistry: registry, auth: sessionManager }),
    [registry],
  );

  // Scoped to the client id, so two sets on one cluster keep separate state.
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
