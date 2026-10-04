import { useCallback, useEffect, useState } from 'react';
import { type CurrentSession, type UsersApi } from '@machafoundation/core';

/**
 * Who the viewer is and what the server granted, for display only; access
 * decisions are in `access.ts`. Ported from
 * `macha-client/src/app/useCurrentSession.ts`.
 */

export interface CurrentSessionState {
  /** `undefined` while loading or when the node cannot say; test `known`, not this. */
  session?: CurrentSession;
  /**
   * Whether the cluster answered. If so its roles are authoritative: an
   * unnamed capability is one this session lacks. False is unknown, not
   * unprivileged.
   */
  known: boolean;
  refresh: () => void;
}

export function useCurrentSession(api: UsersApi, enabled: boolean): CurrentSessionState {
  const [state, setState] = useState<{ session?: CurrentSession; known: boolean }>({ known: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      // Only when there is something to clear: a fresh object every run
      // re-triggers this effect for a caller whose `api` identity is unstable.
      setState((current) => (current.known || current.session ? { known: false } : current));
      return undefined;
    }
    const controller = new AbortController();
    api.currentSession(controller.signal).then(
      async (session) => {
        if (controller.signal.aborted) return;
        setState({ session, known: true });
        // A 0.37.x node names no user on the session; the account record does.
        if (session.username) return;
        try {
          const account = await api.me(controller.signal);
          if (!controller.signal.aborted && account.username) {
            setState({
              session: { ...session, username: account.username, user_id: account.id },
              known: true,
            });
          }
        } catch {
          // Left unnamed rather than guessed at.
        }
      },
      () => {
        // Any failure means roles are unknown; nothing may be hidden on that basis.
        if (!controller.signal.aborted) setState({ known: false });
      },
    );
    return () => controller.abort();
  }, [api, enabled, attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, refresh };
}
