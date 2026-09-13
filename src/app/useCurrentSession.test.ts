import { describe, expect, it } from 'vitest';
import type { CurrentSession } from '@macha/core';
import { sessionLockedOut } from './useCurrentSession';

function session(roles: CurrentSession['roles']): CurrentSession {
  return { roles, expires_unix_ms: Date.now() + 60_000 } as CurrentSession;
}

/**
 * The deployment this exists for: take `media_viewer` off the `anonymous`
 * account and an unauthenticated viewer's session arrives holding an empty role
 * list. An empty list is the server being explicit — it granted nothing.
 */
describe('when the client is locked out', () => {
  it('locks a session the server granted nothing', () => {
    expect(sessionLockedOut(session([]), true)).toBe(true);
  });

  it('does not lock a session that may view media', () => {
    expect(sessionLockedOut(session(['media_viewer']), true)).toBe(false);
  });

  it('does not lock on a role this build does not recognise', () => {
    // The server named what it granted. A role we cannot interpret is still a
    // grant, and locking on it would put a wall in front of a viewer whose
    // server is simply newer than this client.
    expect(sessionLockedOut(session(['some_future_role' as never]), true)).toBe(false);
  });
});

/**
 * `known` is load-bearing and not a formality. An unanswered whoami is not an
 * answer of "none": there is a window after the cold-start mint where roles
 * have not arrived, and on this client an unreachable node is the normal
 * operating condition rather than an edge case.
 */
describe('when the answer has not arrived', () => {
  it('does not lock before the cluster has answered', () => {
    // Treating this as no-roles would flash the login wall on every start,
    // before the real answer lands.
    expect(sessionLockedOut(undefined, false)).toBe(false);
  });

  it('does not lock when the node is too old to answer at all', () => {
    // A node that cannot serve the whoami enforces no roles either, so falling
    // back to letting the viewer through costs nothing. The hook reports that
    // as `known: false` — a rejection never sets `known`.
    expect(sessionLockedOut(undefined, false)).toBe(false);
  });

  it('would lock on a session-less "known", which the hook never produces', () => {
    // Documented rather than asserted as intent. `known: true` only ever
    // arrives alongside a session object, because the hook sets `known: false`
    // on any rejection — so this combination is unreachable through it. Stated
    // here so a future caller that builds the pair by hand knows the predicate
    // reads a missing session as an empty grant rather than as an unknown one.
    expect(sessionLockedOut(undefined, true)).toBe(true);
  });

  it('locks only when the server itself said "nothing"', () => {
    // The whole distinction in one pair: same empty roles, different `known`.
    expect(sessionLockedOut(session([]), false)).toBe(false);
    expect(sessionLockedOut(session([]), true)).toBe(true);
  });
});
