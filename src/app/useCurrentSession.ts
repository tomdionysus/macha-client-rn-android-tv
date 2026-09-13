import { useCallback, useEffect, useState } from 'react';
import type { CurrentSession, UsersApi } from '@macha/core';

/**
 * Who the viewer is and what the server granted them.
 *
 * Ported from `macha-client/src/app/useCurrentSession.ts` rather than shared:
 * it is a React hook, and core's scope stops at everything a client does that
 * is not presentation. `sessionLockedOut` below is the exception worth
 * noticing — it is a policy predicate with no React in it, and it is
 * duplicated in both clients. If the rule ever changes, it changes twice.
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
        // Identity is not guaranteed on the session. A deployed 0.37.x node
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

/**
 * Whether this session may use the client at all.
 *
 * The deployment this exists for is the one where only registered users see
 * media: take `media_viewer` off the `anonymous` account and an
 * unauthenticated viewer's session arrives holding an empty role list. An empty
 * list is the server being explicit — it granted nothing — and the only honest
 * response is to stop asking and put a login in front of them.
 *
 * **`known` is load-bearing and not a formality.** An unanswered whoami is not
 * an answer of "none": there is a window after the cold-start mint where roles
 * have simply not arrived. Treating that as no-roles would flash the login wall
 * on every start before the real answer lands, and would put one in front of a
 * viewer whose only problem was an unreachable node — which on this client is
 * the normal operating condition rather than an edge case, given how the link
 * to the set behaves.
 */
export function sessionLockedOut(session: CurrentSession | undefined, known: boolean): boolean {
  return known && (session?.roles?.length ?? 0) === 0;
}
