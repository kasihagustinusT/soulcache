import { useEffect, type ReactNode } from 'react';
import { hydrate } from '@soulcache/core';
import type { DehydratedState } from '@soulcache/core';
import { useSoulCacheContext } from './context';

/**
 * HydrationBoundary
 *
 * Component that hydrates dehydrated state into the QueryClient.
 * Used for server-side rendering (SSR) to transfer server-fetched
 * data to the client without refetching.
 *
 * @example
 * ```tsx
 * // Server
 * const state = dehydrate(queryClient);
 *
 * // Client
 * function App({ dehydratedState }) {
 *   return (
 *     <HydrationBoundary state={dehydratedState}>
 *       <MyPage />
 *     </HydrationBoundary>
 *   );
 * }
 * ```
 */
export function HydrationBoundary({
  state,
  options,
  children,
}: {
  /** Dehydrated state to hydrate */
  readonly state: DehydratedState;
  /** Hydration options */
  readonly options?: {
    readonly mergeStrategy?: 'skip' | 'overwrite';
  };
  /** Child components that will have access to the hydrated data */
  readonly children: ReactNode;
}): ReactNode {
  const client = useSoulCacheContext();

  useEffect(() => {
    if (state?.queries?.length) {
      hydrate(client.getCache(), state, options);
    }
  }, [client, state, options]);

  return children;
}
