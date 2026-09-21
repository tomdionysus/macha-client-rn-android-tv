import { describe, expect, it } from 'vitest';
import { ACCOUNT_SESSION_LIMIT_COPY, failureCopy } from './failureCopy';

describe('failureCopy', () => {
  it('shows the message core assembled for an ordinary failure', () => {
    const error = new Error('No media delivered within 19000ms');

    expect(failureCopy(error, () => false)).toEqual({
      headline: 'No media delivered within 19000ms',
      code: undefined,
    });
  });

  it('replaces the headline with the sentence a viewer can act on when core says it is the cap', () => {
    // Core decides. The predicate is injected so this tree never spells the
    // code it is core's job to track.
    const error = new Error('Playback failed');

    expect(failureCopy(error, () => true).headline).toBe(ACCOUNT_SESSION_LIMIT_COPY);
  });

  it('surfaces the server code from down the cause chain without parsing the message', () => {
    // A create refusal reaches fatalError as a bare Error with the code two
    // links down; core's walk finds it, and it goes to the small print.
    const refusal = Object.assign(new Error('node refused'), { code: 'bad_playback_request' });
    const wrapped = new Error('Playback failed', { cause: new Error('endpoint failed', { cause: refusal }) });

    expect(failureCopy(wrapped, () => false)).toEqual({
      headline: 'Playback failed',
      code: 'bad_playback_request',
    });
  });

  it('finds the cap code when a refused failover is the tail of the chain', () => {
    // The failover shape, read from core: the originating error is a
    // PlaybackSourceError carrying `kind` and no `code`, terminalRecoveryError
    // appends the failover's endpoint failure — `kind`, no `code` — and the
    // refusal with the server code sits below that. Outermost-first must
    // still reach it, or a viewer whose failover the cap refused reads the
    // 404 that started it instead of the sentence they can act on.
    const refusal = Object.assign(new Error('account at limit'), { code: 'cap-code-under-test' });
    const endpoint = Object.assign(new Error('endpoint failed'), { kind: 'refused', cause: refusal });
    const originating = Object.assign(new Error('Source error 404'), { kind: 'not-found', cause: endpoint });

    expect(failureCopy(originating, () => false).code).toBe('cap-code-under-test');
  });

  it('never lets the code become the headline', () => {
    const refusal = Object.assign(new Error('refused'), { code: 'some_code' });

    expect(failureCopy(refusal, () => false).headline).toBe('refused');
  });
});
