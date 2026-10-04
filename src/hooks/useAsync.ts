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
 * Ported from the web client's `useAsync`. Aborts with no reason:
 * `DOMException` is not global in React Native, and the default is already an
 * `AbortError`.
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
      // No reason argument: the default is the AbortError core checks for.
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns the dependency list.
  }, dependencies);

  return state;
}

/** `useAsync` that can be re-run: a refresh keeps the previous value and reports `refreshing`. */
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
      // No reason argument: the default is the AbortError core checks for.
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller owns the dependency list.
  }, [...dependencies, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  return { ...state, refreshing, refresh };
}
