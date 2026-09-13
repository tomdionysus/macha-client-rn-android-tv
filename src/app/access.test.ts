import { describe, expect, it } from 'vitest';
import type { SessionMintFailure } from '@macha/core';
import { accessState } from './access';

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
