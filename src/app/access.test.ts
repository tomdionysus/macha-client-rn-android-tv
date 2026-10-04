import { describe, expect, it } from 'vitest';
import type { SessionMintFailure } from '@machafoundation/core';
import { accessState, lapsedIdentity, stillAdmitted } from './access';

const refused: SessionMintFailure = {
  reason: 'refused',
  status: 403,
  code: 'anonymous_disabled',
  message: 'this cluster requires a username and password',
};
const unreachable: SessionMintFailure = {
  reason: 'unreachable',
  message: 'All configured API endpoints are unreachable.',
};

/** A login wall when nothing answered offers an action that cannot work. */
describe('refused versus unreachable', () => {
  it('offers a sign-in when a node answered and said no', () => {
    expect(accessState(true, refused, undefined)).toEqual({
      kind: 'sign-in',
      code: 'anonymous_disabled',
    });
  });

  it('never offers a sign-in when nothing answered', () => {
    expect(accessState(true, unreachable, undefined)).toEqual({ kind: 'offline' });
  });

  it('treats unreachable as unreachable even when roles are also absent', () => {
    // Both inputs are empty-looking; only the failure reason separates them.
    expect(accessState(true, unreachable, undefined).kind).toBe('offline');
  });

  it('carries the server code through, without inventing one', () => {
    const { code } = accessState(true, { reason: 'refused', message: 'no' }, undefined) as {
      code?: string;
    };
    expect(code).toBeUndefined();
  });
});

/** Core's roles use `undefined` for unknown, distinct from `[]`. */
describe('what the roles say', () => {
  it('locks a session the cluster granted nothing', () => {
    expect(accessState(true, undefined, [])).toEqual({ kind: 'sign-in' });
  });

  it('admits a session that may view media', () => {
    expect(accessState(true, undefined, ['media_viewer'])).toEqual({ kind: 'allowed' });
  });

  it('admits on a role this build does not recognise, because the server granted it', () => {
    expect(accessState(true, undefined, ['some_future_role' as never]).kind).toBe('allowed');
  });

  it('admits while roles are still unknown, rather than guessing', () => {
    expect(accessState(true, undefined, undefined)).toEqual({ kind: 'allowed' });
  });
});

describe('before the question has been answered', () => {
  it('is checking while the session lifecycle has not settled', () => {
    expect(accessState(false, undefined, undefined)).toEqual({ kind: 'checking' });
  });

  it('is checking even if a stale failure is still hanging about', () => {
    // A reason left from a previous attempt must not raise a wall mid-retry.
    expect(accessState(false, refused, []).kind).toBe('checking');
  });
});

describe('precedence', () => {
  it('puts the mint failure above the roles question', () => {
    // A failed mint has no session, so `[]` beside it is not a grant of none.
    expect(accessState(true, unreachable, []).kind).toBe('offline');
  });
});

/**
 * The two cases the latch lets through. Measured on the cluster: a re-mint
 * without credentials returns `username: anonymous` with `roles: []`.
 */
describe('admission ending', () => {
  it('raises the wall when the viewer asked to be signed out', () => {
    expect(accessState(true, undefined, ['media_viewer'], 'signed-out')).toEqual({
      kind: 'sign-in',
      because: 'signed-out',
    });
  });

  it('outranks a lifecycle that has not settled', () => {
    // `signOut` mints no replacement, so `isReady` may be false afterwards.
    expect(accessState(false, undefined, undefined, 'signed-out').kind).toBe('sign-in');
  });

  it('raises the wall when the session stopped belonging to the viewer', () => {
    expect(accessState(true, undefined, [], 'identity-changed')).toEqual({
      kind: 'sign-in',
      because: 'identity-changed',
    });
  });

  it('says nothing new when nothing ended the admission', () => {
    // No reason on the ordinary wall, so the latch cannot take it for a lapse.
    expect(accessState(true, undefined, [])).toEqual({ kind: 'sign-in' });
  });
});

describe('the latch', () => {
  it('admits once allowed, and stays admitted through a later refusal', () => {
    expect(stillAdmitted(false, { kind: 'allowed' })).toBe(true);
    expect(stillAdmitted(true, { kind: 'sign-in' })).toBe(true);
    expect(stillAdmitted(true, { kind: 'offline' })).toBe(true);
  });

  it('lets a deliberate sign-out through', () => {
    expect(stillAdmitted(true, { kind: 'sign-in', because: 'signed-out' })).toBe(false);
  });

  it('lets a lapsed identity through', () => {
    expect(stillAdmitted(true, { kind: 'sign-in', because: 'identity-changed' })).toBe(false);
  });

  it('does not admit on anything but an allowed state', () => {
    expect(stillAdmitted(false, { kind: 'checking' })).toBe(false);
    expect(stillAdmitted(false, { kind: 'offline' })).toBe(false);
  });
});

describe('a lapsed identity', () => {
  const changed = { from: 'tvtest', to: 'anonymous', at: 1_790_017_613_383 };

  it('is a change that left the session able to do nothing', () => {
    expect(lapsedIdentity(changed, [])).toBe(true);
  });

  it('is not an ordinary sign-in', () => {
    // anonymous -> tvtest is a change too, and the arriving session has roles.
    expect(lapsedIdentity({ from: 'anonymous', to: 'tvtest', at: 1 }, ['media_viewer'])).toBe(false);
  });

  it('is not an empty role set that nothing changed into', () => {
    // The roles alone already give `sign-in`; the latch was never set.
    expect(lapsedIdentity(undefined, [])).toBe(false);
  });

  it('does not fire while roles are unknown', () => {
    // `undefined` roles are unknown, not empty.
    expect(lapsedIdentity(changed, undefined)).toBe(false);
  });
});
