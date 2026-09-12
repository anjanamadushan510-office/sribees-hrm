import { useCallback, useEffect, useRef, useState } from 'react';
import { toMessage } from '../utils/policies';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (value: T) => void;
}

/**
 * Every screen reads through this hook so loading, error and empty states are
 * impossible to forget.
 */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loaderRef.
    current().
    then((result) => {
      if (!cancelled && mounted.current) setData(result);
    }).
    catch((err: unknown) => {
      if (!cancelled && mounted.current) setError(toMessage(err));
    }).
    finally(() => {
      if (!cancelled && mounted.current) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, error, reload, setData };
}

/** Ticks every `ms` so live counters (open shifts, presence) stay accurate. */
export function useTicker(ms = 30000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return tick;
}