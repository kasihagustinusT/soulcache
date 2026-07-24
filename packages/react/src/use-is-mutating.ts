import { useSyncExternalStore, useCallback } from 'react';
import { useSoulCacheContext } from './context';

/**
 * useIsMutating
 *
 * Hook that returns the number of currently pending mutations.
 *
 * @example
 * ```tsx
 * function GlobalSpinner() {
 *   const isMutating = useIsMutating();
 *   return isMutating ? <SavingIndicator /> : null;
 * }
 * ```
 */
export function useIsMutating(): number {
  const client = useSoulCacheContext();

  const subscribe = useCallback(
    (listener: () => void) => {
      const mutationCache = client.getMutationCache();
      return mutationCache.subscribe(() => {
        listener();
      });
    },
    [client],
  );

  const getSnapshot = useCallback(() => {
    const mutationCache = client.getMutationCache();
    let count = 0;
    for (const entry of mutationCache.entries()) {
      if (entry.status === 'pending') {
        count++;
      }
    }
    return count;
  }, [client]);

  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
