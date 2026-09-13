import { useEffect, useRef, useState } from 'react';
import {
  sessionLockedOut,
  sessionManager,
  type SessionMintFailure,
  type UserRole,
} from '@macha/core';

/**
 * Whether this client may be used, and if not, which of the several reasons.
 *
 * The distinction that matters, and the one this client got wrong once: **"the
 * server told us we may not" is not "we could not ask".** The first is a policy
 * a cluster stated and a sign-in may resolve it. The second means the viewer is
 * away from home, and offering them a login is both a lie and useless, since
 * signing in needs a reachable node as much as watching does.
 *
 * Every input here is now a fact core states rather than something inferred
 * locally. The earlier version of this file derived the answer from an empty
 * token, could not tell the two apart, and would have raised a login wall on a
 * network blip.
 */
export type AccessState =
  /** Still asking. Show what is already there and nothing new. */
  | { kind: 'checking' }
  | { kind: 'allowed' }
  /** A node answered and said no. A sign-in is honest here. */
  | { kind: 'sign-in'; code?: string }
  /** Nothing answered. Not an access problem and must never present as one. */
  | { kind: 'offline' };

/**
 * Decide from the three facts, none of which can answer alone.
 *
 * Order matters. A mint failure outranks the roles question, because when the
 * mint failed there is no session whose roles could mean anything.
 *
 * `roles` is core's: `undefined` means nothing has said yet and permits
 * everything, `[]` means the cluster granted this session nothing. That shape
 * is deliberate — an unknown answer cannot be mistaken for an empty one by a
 * caller who forgot to check a separate flag, which is exactly the mistake the
 * previous two-argument version invited.
 */
export function accessState(
  ready: boolean,
  failure: SessionMintFailure | undefined,
  roles: readonly UserRole[] | undefined,
): AccessState {
  if (!ready) return { kind: 'checking' };
  if (failure?.reason === 'unreachable') return { kind: 'offline' };
  if (failure?.reason === 'refused') {
    return failure.code ? { kind: 'sign-in', code: failure.code } : { kind: 'sign-in' };
  }
  if (sessionLockedOut(roles)) return { kind: 'sign-in' };
  return { kind: 'allowed' };
}

/**
 * The session facts the gate needs, tracked through core's own notifications.
 *
 * Roles arrive with the token on every path — the mint response states them and
 * validating a cached token returns the session record — so there is no fetch
 * to fail here and nothing to retry. That is why this replaced a whoami call
 * that had to distinguish "unanswered" from "empty".
 */
export function useSessionFacts(): {
  failure: SessionMintFailure | undefined;
  roles: readonly UserRole[] | undefined;
} {
  const read = () => ({ failure: sessionManager.lastMintFailure, roles: sessionManager.roles });
  const [facts, setFacts] = useState(read);
  useEffect(() => sessionManager.subscribe(() => setFacts(read())), []);
  return facts;
}

/**
 * The gate, applied **only before the client has ever been admitted**.
 *
 * Once a viewer is in, a later session failure is a connectivity problem and
 * belongs on screen as a notice over what they already have — never as a wall
 * replacing it. This matters concretely: `lastMintFailure` changes on a failed
 * *refresh* too, so without the latch a blip mid-film would tear down the
 * player and present a login screen to someone who was watching something.
 *
 * That is the inverse of what this project is for. Failover is meant to be
 * invisible, and a transient must never become a visible, permanent-looking
 * state.
 *
 * **Known deferral:** a genuine demotion mid-session will therefore not lock a
 * viewer out until the app restarts. Core invalidates the session so requests
 * begin failing, which is degraded rather than an access hole, and tearing down
 * playback to enforce it is the worse trade.
 */
export function useAccessLatched(state: AccessState): AccessState {
  const admitted = useRef(false);
  if (state.kind === 'allowed') admitted.current = true;
  return admitted.current ? { kind: 'allowed' } : state;
}
