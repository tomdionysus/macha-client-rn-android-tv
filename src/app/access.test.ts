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

/**
 * The distinction this whole file exists for, and the one this client got wrong
 * once: **"the server told us we may not" is not "we could not ask".**
 *
 * An earlier gate derived access from an absent token, could not tell them
 * apart, and would have raised a login wall on a network blip — telling the
 * viewer to sign in, which also cannot work with no reachable node.
 */
describe('refused versus unreachable', () => {
  it('offers a sign-in when a node answered and said no', () => {
    expect(accessState(true, refused, undefined)).toEqual({
      kind: 'sign-in',
      code: 'anonymous_disabled',
    });
  });

  it('never offers a sign-in when nothing answered', () => {
    // The away-from-home case. A login here claims a policy no cluster stated
    // and offers an action that cannot succeed.
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

/**
 * Roles come from core and use `undefined` for unknown, so a caller cannot
 * mistake "not said yet" for "granted nothing" by forgetting a separate flag.
 */
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
    // `isReady === false` means the question is open; a reason from a previous
    // attempt must not put a wall up while a retry is in flight.
    expect(accessState(false, refused, []).kind).toBe('checking');
  });
});

describe('precedence', () => {
  it('puts the mint failure above the roles question', () => {
    // When the mint failed there is no session whose roles could mean anything,
    // so an empty list alongside a failure must not be read as a grant of none.
    expect(accessState(true, unreachable, []).kind).toBe('offline');
  });
});

/**
 * A wall raised *after* the viewer was admitted, which the latch exists to
 * prevent — and the two cases where preventing it is wrong.
 *
 * Measured on the cluster 2026-09-21, and it is the reason this exists: a
 * re-mint presenting no credentials returns `username: anonymous` with
 * `roles: []`, and `/catalogue/items` then answers
 * `403 requires the 'media_viewer' role`. The same account minted with the
 * nested credentials envelope comes back `media_viewer, view_status`. So the
 * degraded session is not a blip to be ridden out; it is a session that can do
 * nothing, and the latch was holding the viewer inside a shell where every
 * screen failed with no way to sign out.
 */
describe('admission ending', () => {
  it('raises the wall when the viewer asked to be signed out', () => {
    expect(accessState(true, undefined, ['media_viewer'], 'signed-out')).toEqual({
      kind: 'sign-in',
      because: 'signed-out',
    });
  });

  it('outranks a lifecycle that has not settled', () => {
    // `signOut` does not mint a replacement, so `isReady` may well be false
    // afterwards. Answering `checking` there would leave a viewer who asked to
    // leave staring at "Connecting…" instead of at a login form.
    expect(accessState(false, undefined, undefined, 'signed-out').kind).toBe('sign-in');
  });

  it('raises the wall when the session stopped belonging to the viewer', () => {
    expect(accessState(true, undefined, [], 'identity-changed')).toEqual({
      kind: 'sign-in',
      because: 'identity-changed',
    });
  });

  it('says nothing new when nothing ended the admission', () => {
    // The ordinary wall carries no reason, so the latch cannot mistake a
    // first-run refusal for a session that lapsed under a viewer.
    expect(accessState(true, undefined, [])).toEqual({ kind: 'sign-in' });
  });
});

/**
 * The latch itself, as a value rather than through a renderer.
 *
 * Its purpose is unchanged: a failed *refresh* must never replace a player
 * mid-film with a login screen. What is new is that two states are not that,
 * and must get through it.
 */
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
    // The known deferral this file recorded — "a genuine demotion mid-session
    // will not lock a viewer out until the app restarts" — closed for the one
    // case core can actually report.
    expect(stillAdmitted(true, { kind: 'sign-in', because: 'identity-changed' })).toBe(false);
  });

  it('does not admit on anything but an allowed state', () => {
    expect(stillAdmitted(false, { kind: 'checking' })).toBe(false);
    expect(stillAdmitted(false, { kind: 'offline' })).toBe(false);
  });
});

/**
 * Reading core's two halves together, which is the host's job and nobody
 * else's — core reports the change and the capability separately and states no
 * sentence about either.
 */
describe('a lapsed identity', () => {
  const changed = { from: 'tvtest', to: 'anonymous', at: 1_790_017_613_383 };

  it('is a change that left the session able to do nothing', () => {
    expect(lapsedIdentity(changed, [])).toBe(true);
  });

  it('is not an ordinary sign-in', () => {
    // anonymous -> tvtest is a change too, and the arriving session can do
    // things. Treating the change alone as a lapse would throw a viewer out at
    // the moment they signed in.
    expect(lapsedIdentity({ from: 'anonymous', to: 'tvtest', at: 1 }, ['media_viewer'])).toBe(false);
  });

  it('is not an empty role set that nothing changed into', () => {
    // Already `sign-in` from the roles alone, and the latch was never set. What
    // the change adds is that the lockout is new.
    expect(lapsedIdentity(undefined, [])).toBe(false);
  });

  it('does not fire while roles are unknown', () => {
    // `undefined` is core's "nothing has said yet" and permits everything. A
    // change observed before the roles arrive must not be read as a lapse.
    expect(lapsedIdentity(changed, undefined)).toBe(false);
  });
});
