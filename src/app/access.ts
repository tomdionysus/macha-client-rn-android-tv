import { useEffect, useRef, useState } from 'react';
import {
  sessionLockedOut,
  sessionManager,
  type SessionIdentityChange,
  type SessionMintFailure,
  type UserRole,
} from '@machafoundation/core';

/**
 * Whether this client may be used, and if not, which of the several reasons.
 *
 * The distinction that matters: **"the server told us we may not" is not "we
 * could not ask".** The first is a policy a cluster stated and a sign-in may
 * resolve it. The second means the viewer is away from home, and offering them
 * a login is both a lie and useless, since signing in needs a reachable node as
 * much as watching does.
 *
 * Every input here is a fact core states, not something inferred locally.
 */
/**
 * What ended an admission the viewer already had.
 *
 * Only two things do, and they are the only two the latch below lets through.
 * Everything else that looks like a refusal after admission is a transient,
 * which is what the latch is for.
 *
 * - `signed-out` — the viewer asked. Nothing outranks that, including a
 *   lifecycle that has not settled: `signOut` deliberately does not mint a
 *   replacement, so `isReady` is commonly false straight afterwards.
 * - `identity-changed` — core says the session stopped belonging to the
 *   account it belonged to, and what replaced it can do nothing. Core reports
 *   the change (`lastIdentityChange`) and the capability (`roles`) separately
 *   and states no sentence about either, because a 401 does not distinguish an
 *   expiry from a revoke from a `credential_generation` bump. Reading them
 *   together is the host's job, and it is this line.
 */
export type AdmissionEnded = 'signed-out' | 'identity-changed';

export type AccessState =
  /** Still asking. Show what is already there and nothing new. */
  | { kind: 'checking' }
  | { kind: 'allowed' }
  /**
   * A node answered and said no. A sign-in is honest here.
   *
   * `because` is set only when the viewer had already been admitted and
   * something ended it. Its absence means the wall was there from the start,
   * which is what keeps the latch from mistaking a first-run refusal for a
   * session that lapsed under somebody.
   */
  | { kind: 'sign-in'; code?: string; because?: AdmissionEnded }
  /** Nothing answered. Not an access problem and must never present as one. */
  | { kind: 'offline' };

/**
 * Decide from the three facts, none of which can answer alone.
 *
 * Order matters. A mint failure outranks the roles question, because when the
 * mint failed there is no session whose roles could mean anything.
 *
 * `roles` is core's: `undefined` means nothing has said yet and permits
 * everything, `[]` means the cluster granted this session nothing, so an
 * unknown answer cannot be mistaken for an empty one.
 */
export function accessState(
  ready: boolean,
  failure: SessionMintFailure | undefined,
  roles: readonly UserRole[] | undefined,
  ended?: AdmissionEnded,
): AccessState {
  // Above `ready`, deliberately. Both of these are answers, not open questions,
  // and a viewer who asked to be signed out must not be shown "Connecting…".
  if (ended) return { kind: 'sign-in', because: ended };
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
 * to fail here and nothing to retry.
 */
export function useSessionFacts(): {
  failure: SessionMintFailure | undefined;
  roles: readonly UserRole[] | undefined;
  identity: SessionIdentityChange | undefined;
} {
  const read = () => ({
    failure: sessionManager.lastMintFailure,
    roles: sessionManager.roles,
    identity: sessionManager.lastIdentityChange,
  });
  const [facts, setFacts] = useState(read);
  useEffect(() => sessionManager.subscribe(() => setFacts(read())), []);
  return facts;
}

/**
 * Whether the session stopped belonging to the viewer *and* what replaced it
 * can do nothing.
 *
 * **Both halves are required, and that is the whole point.** An identity change
 * on its own is ordinary — signing in is one, anonymous to named — so treating
 * it as a lapse would throw a viewer out at the moment they arrived. An empty
 * role set on its own is already handled by `sessionLockedOut` in
 * `accessState`; what the change adds is that this lockout is *new*, which is
 * the only thing that can justify getting past the latch.
 *
 * Measured on the cluster: a re-mint presents no credentials and comes back
 * `username: anonymous`, `roles: []`, and `/catalogue/items` then answers
 * `403 requires the 'media_viewer' role`. So any re-mint under a signed-in
 * viewer leaves a session that can do nothing, and every screen fails while the
 * latch holds the shell up.
 */
export function lapsedIdentity(
  identity: SessionIdentityChange | undefined,
  roles: readonly UserRole[] | undefined,
): boolean {
  return identity !== undefined && sessionLockedOut(roles);
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
 * Failover is meant to be invisible, and a transient must never become a
 * visible, permanent-looking state.
 *
 * **Two states are not transients and must get through**, both carried as
 * `because` on the state rather than inferred here: a viewer who asked to be
 * signed out, and a session core says stopped belonging to them and cannot do
 * anything (`lapsedIdentity`). Neither is a blip to be ridden out, and holding
 * the shell up over them leaves a viewer where every screen fails with no way
 * out.
 *
 * **Known deferral:** a demotion that core *cannot* report — a node
 * too old to state `username`, so there is nothing to compare and no change is
 * reported — still will not lock a viewer out until the app restarts. Requests
 * begin failing, which is degraded rather than an access hole, and tearing down
 * playback on a guess is the worse trade.
 */
export function useAccessLatched(state: AccessState): AccessState {
  const admitted = useRef(false);
  admitted.current = stillAdmitted(admitted.current, state);
  return admitted.current ? { kind: 'allowed' } : state;
}

/**
 * The latch's rule, as a value.
 *
 * Separated from the hook so it can be tested without a renderer; this client
 * has no React test harness.
 */
export function stillAdmitted(admitted: boolean, state: AccessState): boolean {
  if (state.kind === 'sign-in' && state.because) return false;
  return admitted || state.kind === 'allowed';
}
