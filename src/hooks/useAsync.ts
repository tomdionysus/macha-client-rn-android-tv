import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  value?: T;
  error?: Error;
  loading: boolean;
}

export interface RefreshableAsyncState<T> extends AsyncState<T> {
  refreshing: boolean;
  refresh: () => void;
}

/**
 * Ported from the web client's `useAsync`.
 *
 * The web version aborts with an explicit `DOMException` reason. `DOMException`
 * is not on `globalThis` in React Native — the same trap core hit, where a
 * `signal.reason ?? new DOMException(...)` fallback raised `ReferenceError`
 * here and never on the web — so this aborts with no reason and relies on the
 * spec default, which is already an `AbortError`.
 */
export function useAsync<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ loading: true });

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ loading: true });
    factory(controller.signal)
      .then((value) => {
        if (active) setState({ value, loading: false });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({ error: error instanceof Error ? error : new Error(String(error)), loading: false });
      });
    return () => {
      active = false;
      // No reason argument: React Native's AbortController types it as
      // zero-argument, and the spec default is already an AbortError, which is
      // what core's own abort handling checks for.
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns the dependency list.
  }, dependencies);

  return state;
}

/**
 * `useAsync` that can be re-run without clearing what it already has.
 *
 * The distinction matters on a television: dropping a screenful of posters back
 * to a spinner because a background refresh started is a visible flinch, so a
 * refresh keeps the previous value and only reports `refreshing`.
 */
export function useRefreshableAsync<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
): RefreshableAsyncState<T> {
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<AsyncState<T>>({ loading: true });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState((previous) => (previous.value === undefined ? { loading: true } : previous));
    if (nonce > 0) setRefreshing(true);

    factory(controller.signal)
      .then((value) => {
        if (!active) return;
        setState({ value, loading: false });
        setRefreshing(false);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState((previous) => ({
          ...previous,
          error: error instanceof Error ? error : new Error(String(error)),
          loading: false,
        }));
        setRefreshing(false);
      });

    return () => {
      active = false;
      // No reason argument: React Native's AbortController types it as
      // zero-argument, and the spec default is already an AbortError, which is
      // what core's own abort handling checks for.
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns the dependency list.
  }, [...dependencies, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, refreshing, refresh };
}
