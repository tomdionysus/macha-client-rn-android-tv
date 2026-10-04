import { useEffect, useRef, useState } from 'react';
import {
  sessionLockedOut,
  sessionManager,
  type SessionIdentityChange,
  type SessionMintFailure,
  type UserRole,
} from '@machafoundation/core';

/**
 * Whether this client may be used and, if not, why. A refusal from a node may
 * be resolved by a sign-in; an unreachable cluster cannot, so it must never
 * present as one. Every input is a fact core states.
 */
/**
 * What ended an admission the viewer already had; the only two things the
 * latch lets through.
 * - `signed-out`: the viewer asked. `signOut` mints no replacement, so
 *   `isReady` is commonly false afterwards.
 * - `identity-changed`: core reports the change (`lastIdentityChange`) and the
 *   capability (`roles`) separately; `lapsedIdentity` reads them together.
 */
export type AdmissionEnded = 'signed-out' | 'identity-changed';

export type AccessState =
  /** Still asking. Show what is already there and nothing new. */
  | { kind: 'checking' }
  | { kind: 'allowed' }
  /**
   * A node answered and said no. `because` is set only when an existing
   * admission ended; absent, the wall was there from the start.
   */
  | { kind: 'sign-in'; code?: string; because?: AdmissionEnded }
  /** Nothing answered. Not an access problem and must never present as one. */
  | { kind: 'offline' };

/**
 * Order matters: a failed mint has no session whose roles could mean anything.
 * `roles` is core's: `undefined` is unknown and permits everything, `[]` is
 * granted nothing.
 */
export function accessState(
  ready: boolean,
  failure: SessionMintFailure | undefined,
  roles: readonly UserRole[] | undefined,
  ended?: AdmissionEnded,
): AccessState {
  // Above `ready`: after `signOut` the lifecycle may not have settled.
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
 * The session facts the gate needs. Roles arrive with the token on every path,
 * so there is no fetch to fail.
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
 * Whether the identity changed and what replaced it can do nothing. Both
 * halves are required: a sign-in is also an identity change. Measured on the
 * cluster: a re-mint without credentials returns `anonymous` with `roles: []`,
 * and the catalogue then answers 403.
 */
export function lapsedIdentity(
  identity: SessionIdentityChange | undefined,
  roles: readonly UserRole[] | undefined,
): boolean {
  return identity !== undefined && sessionLockedOut(roles);
}

/**
 * The gate, applied only until the client is first admitted. After that a
 * session failure is a transient (`lastMintFailure` also changes on a failed
 * refresh) and must not replace the player with a wall. Only a state carrying
 * `because` gets through.
 *
 * Limitation: a node too old to state `username` reports no identity change,
 * so that demotion does not lock the viewer out until restart.
 */
export function useAccessLatched(state: AccessState): AccessState {
  const admitted = useRef(false);
  admitted.current = stillAdmitted(admitted.current, state);
  return admitted.current ? { kind: 'allowed' } : state;
}

/** The latch's rule as a value, testable without a renderer. */
export function stillAdmitted(admitted: boolean, state: AccessState): boolean {
  if (state.kind === 'sign-in' && state.because) return false;
  return admitted || state.kind === 'allowed';
}
