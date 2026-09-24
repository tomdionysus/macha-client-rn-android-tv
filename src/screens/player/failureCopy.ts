import { isAccountSessionLimit, playbackFailureCode, playbackFailureDetail } from '@machafoundation/core';
import { errorText } from '../../text/viewerText';

/**
 * What the failure overlay says, and the one failure it says something
 * different for.
 *
 * **The account's own session cap is the only failure a viewer can act on
 * from a sofa.** Every other terminal failure is worded by `errorText` from
 * its class, status and code — never its message, which since core's cut is
 * log text (Tom, 2026-09-24: core writes no viewer text). A cap refusal names
 * *another screen on the same account*, and "Playback failed:
 * account_session_limit" tells a viewer with a remote and no address bar
 * nothing they can do about it. The sentence below does: the other screen is
 * where the fix is.
 *
 * **Core decides which failure this is; this file never does.** By the time
 * a create refusal reaches `fatalError` it is a bare `Error` with the
 * server's code two or three links down its `cause` chain, and a host that
 * walked that chain itself or matched on the code string would be one server
 * rewording away from silence. `isAccountSessionLimit` and
 * `playbackFailureCode` are core `0.17.0`'s answer to exactly that question,
 * asked from this client on 2026-09-21; the code string is spelled nowhere in
 * this tree, deliberately.
 *
 * The predicate is a parameter so the sentence can be tested without this
 * tree naming the code either — core owns the code, core tests the match.
 */
export const ACCOUNT_SESSION_LIMIT_COPY =
  'Another screen on this account is playing. Stop it there, or wait for it to finish.';

export interface FailureCopy {
  /** The line the viewer reads. */
  headline: string;
  /**
   * The server's own sentence about the failure, when it gave one — small
   * print beneath the headline, never the headline. Read through core's
   * `playbackFailureDetail`, which carries the server's words and nothing
   * core composed.
   */
  detail?: string;
  /** The server's machine code, for the trail and the small print — never the headline. */
  code?: string;
}

export function failureCopy(
  error: Error,
  isCap: (error: unknown) => boolean = isAccountSessionLimit,
): FailureCopy {
  const cap = isCap(error);
  return {
    headline: cap ? ACCOUNT_SESSION_LIMIT_COPY : errorText(error),
    detail: playbackFailureDetail(error),
    code: playbackFailureCode(error),
  };
}
