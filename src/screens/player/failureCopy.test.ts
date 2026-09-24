import { describe, expect, it } from 'vitest';
import { ACCOUNT_SESSION_LIMIT_COPY, failureCopy } from './failureCopy';
import { errorText } from '../../text/viewerText';

describe('failureCopy', () => {
  it('words an ordinary failure itself, never with the message', () => {
    // Since core's cut (Tom, 2026-09-24) a message is log text; this one must
    // not reach the screen.
    const error = new Error('No media delivered within 19000ms');
    const copy = failureCopy(error, () => false);

    expect(copy.headline).not.toContain('19000ms');
    expect(copy.headline).toBe(errorText(error));
    expect(copy.detail).toBeUndefined();
  });

  it('replaces the headline with the sentence a viewer can act on when core says it is the cap', () => {
    // Core decides. The predicate is injected so this tree never spells the
    // code it is core's job to track.
    const error = new Error('Playback failed');

    expect(failureCopy(error, () => true).headline).toBe(ACCOUNT_SESSION_LIMIT_COPY);
  });

  it("keeps the server's own sentence as small print, and never core's message", () => {
    // `detail` on an error is the server's words; the message is log text.
    const server = Object.assign(new Error('log text only'), { detail: 'Too many streams on this account.' });

    expect(failureCopy(server, () => true).detail).toBe('Too many streams on this account.');
    expect(failureCopy(new Error('Source error Response code: 404'), () => true).detail).toBeUndefined();
  });

  it('surfaces the server code from down the cause chain without parsing the message', () => {
    // A create refusal reaches fatalError as a bare Error with the code two
    // links down; core's walk finds it, and it goes to the small print.
    const refusal = Object.assign(new Error('node refused'), { code: 'bad_playback_request' });
    const wrapped = new Error('Playback failed', { cause: new Error('endpoint failed', { cause: refusal }) });

    const copy = failureCopy(wrapped, () => false);
    expect(copy.code).toBe('bad_playback_request');
    expect(copy.headline).toBe(errorText(wrapped));
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

  it('never lets the code or the message become the headline', () => {
    const refusal = Object.assign(new Error('refused'), { code: 'some_code' });
    const headline = failureCopy(refusal, () => false).headline;

    expect(headline).not.toBe('some_code');
    expect(headline).not.toBe('refused');
  });
});
