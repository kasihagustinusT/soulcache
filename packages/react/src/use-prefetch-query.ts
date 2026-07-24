import { useCallback } from 'react';
import type { QueryKey } from '@soulcache/core';
import { useSoulCacheContext } from './context';

/**
 * usePrefetchQuery
 *
 * Hook to prefetch query data without rendering the result.
 * Useful for preloading data on hover or navigation.
 *
 * @example
 * ```tsx
 * function UserLink({ userId }: { userId: string }) {
 *   const prefetch = usePrefetchQuery({
 *     queryKey: ['user', userId],
 *     queryFn: () => fetchUser(userId),
 *   });
 *
 *   return (
 *     <Link to={`/users/${userId}`} onMouseEnter={prefetch}>
 *       View User
 *     </Link>
 *   );
 * }
 * ```
 */
export function usePrefetchQuery<T>(options: {
  readonly queryKey: QueryKey;
  readonly queryFn: () => Promise<T>;
}): () => void {
  const client = useSoulCacheContext();

  const prefetch = useCallback(() => {
    const snapshot = client.getQuerySnapshot<T>(options.queryKey);
    if (!snapshot || snapshot.status === 'idle') {
      client.fetchQuery({
        queryKey: options.queryKey,
        queryFn: options.queryFn,
      }).catch(() => {
        // Prefetch errors are silently ignored
      });
    }
  }, [client, options.queryKey, options.queryFn]);

  return prefetch;
}
