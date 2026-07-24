import { useSyncExternalStore, useCallback } from 'react';
import { useSoulCacheContext } from './context';

/**
 * useIsFetching
 *
 * Hook that returns the number of currently fetching queries.
 * Polls the cache engine for entries with fetchStatus === 'fetching'.
 *
 * @example
 * ```tsx
 * function GlobalSpinner() {
 *   const isFetching = useIsFetching();
 *   return isFetching ? <Spinner /> : null;
 * }
 * ```
 */
export function useIsFetching(): number {
  const client = useSoulCacheContext();

  const subscribe = useCallback(
    (listener: () => void) => {
      // Poll for changes since the core event bus doesn't expose
      // a fine-grained subscription for all fetch state changes.
      // 100ms interval is sufficient for UI loading indicators.
      const interval = setInterval(listener, 100);
      return () => clearInterval(interval);
    },
    [],
  );

  const getSnapshot = useCallback(() => {
    const cache = client.getCache();
    let count = 0;
    for (const entry of cache.entries()) {
      if (entry.fetchStatus === 'fetching') {
        count++;
      }
    }
    return count;
  }, [client]);

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
