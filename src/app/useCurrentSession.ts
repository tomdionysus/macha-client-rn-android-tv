import { useCallback, useEffect, useState } from 'react';
import { type CurrentSession, type UsersApi } from '@machafoundation/core';

/**
 * Who the viewer is and what the server granted them.
 *
 * Ported from `macha-client/src/app/useCurrentSession.ts` rather than shared:
 * it is a React hook, and core's scope stops at everything a client does that
 * is not presentation. Access decisions are in `access.ts`; this is identity,
 * for display only.
 */

export interface CurrentSessionState {
  /**
   * Who the viewer is, or `undefined` when that is genuinely not known — still
   * loading, or a node too old to answer.
   *
   * The difference matters at every call site, which is why `known` exists
   * separately rather than callers testing this for truthiness.
   */
  session?: CurrentSession;
  /**
   * Whether the cluster answered.
   *
   * When it did, the roles it returned are **authoritative and literal**: a
   * capability the server did not name is one this session does not have.
   * Every session belongs to a user — empty credentials simply authenticate
   * the `anonymous` one — and its session is read exactly like any other.
   *
   * False means the question went unanswered, which is different from a
   * session with no privileges.
   */
  known: boolean;
  refresh: () => void;
}

export function useCurrentSession(api: UsersApi, enabled: boolean): CurrentSessionState {
  const [state, setState] = useState<{ session?: CurrentSession; known: boolean }>({ known: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) {
      // Only when there is something to clear. Returning a fresh object every
      // run makes this effect its own trigger for any caller whose `api`
      // identity is not stable, and the render loop that follows presents as
      // the process running out of memory rather than as anything to do with
      // sessions.
      setState((current) => (current.known || current.session ? { known: false } : current));
      return undefined;
    }
    const controller = new AbortController();
    api.currentSession(controller.signal).then(
      async (session) => {
        if (controller.signal.aborted) return;
        setState({ session, known: true });
        // Identity is not guaranteed on the session. A 0.37.x node
        // answers this route with roles, an expiry and a policy and names no
        // user at all, so reading the signed-in name from the session alone
        // leaves every account anonymous-looking forever. The account record is
        // the authority on who this is; a refusal simply means the server will
        // not say, which is the same as not knowing.
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
        // Deliberately not distinguishing "no such route" from "could not reach
        // anyone": both mean roles are unknown, and nothing may be hidden on
        // the strength of them.
        if (!controller.signal.aborted) setState({ known: false });
      },
    );
    return () => controller.abort();
  }, [api, enabled, attempt]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  return { ...state, refresh };
}
