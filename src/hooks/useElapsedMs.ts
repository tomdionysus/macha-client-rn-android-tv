import { useEffect, useState } from 'react';

/**
 * How long `active` has been true, ticking once a second; 0 when it is not.
 * The web client's `hooks/useElapsedMs.ts`, which counts a start here because
 * core says `starting` without saying since when.
 */
export function useElapsedMs(active: boolean, tickMs = 1_000): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    setElapsedMs(0);
    if (!active) return undefined;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedMs(Date.now() - startedAt), Math.max(1, tickMs));
    return () => clearInterval(timer);
  }, [active, tickMs]);

  return elapsedMs;
}
