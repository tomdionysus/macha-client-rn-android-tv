import { isAccountSessionLimit, playbackFailureCode, playbackFailureDetail } from '@machafoundation/core';
import { errorText } from '../../text/viewerText';

/**
 * The session-cap sentence, the one failure a viewer can act on. Every other
 * failure is worded by `errorText`, never from its message, which is log text.
 *
 * Core decides which failure this is (`isAccountSessionLimit`,
 * `playbackFailureCode`); the code string is spelled nowhere in this tree.
 */
export const ACCOUNT_SESSION_LIMIT_COPY =
  'Another screen on this account is playing. Stop it there, or wait for it to finish.';

export interface FailureCopy {
  headline: string;
  /** The server's own sentence, via core's `playbackFailureDetail`. Small print, never the headline. */
  detail?: string;
  /** The server's machine code, for the trail and small print; never the headline. */
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
