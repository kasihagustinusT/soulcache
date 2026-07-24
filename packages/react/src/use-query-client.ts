import { useSoulCacheContext } from './context';
import type { QueryClient } from '@soulcache/core';

/**
 * useQueryClient
 *
 * Hook to access the QueryClient instance from the SoulCacheProvider context.
 *
 * @example
 * ```tsx
 * function InvalidateButton() {
 *   const queryClient = useQueryClient();
 *
 *   return (
 *     <button onClick={() => queryClient.invalidateQueries(['users'])}>
 *       Refresh Users
 *     </button>
 *   );
 * }
 * ```
 */
export function useQueryClient(): QueryClient {
  return useSoulCacheContext();
}
