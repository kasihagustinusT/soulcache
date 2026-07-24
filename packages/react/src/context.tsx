import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { QueryClient } from '@soulcache/core';

/**
 * React Context for the QueryClient instance.
 * Never exported publicly — use useQueryClient() instead.
 */
const SoulCacheContext = createContext<QueryClient | null>(null);

/**
 * SoulCacheProvider
 *
 * Provides the QueryClient instance to the component tree via React Context.
 * Must wrap any component using SoulCache hooks.
 *
 * @example
 * ```tsx
 * import { SoulCacheProvider } from '@soulcache/react';
 *
 * const queryClient = new QueryClient();
 *
 * function App() {
 *   return (
 *     <SoulCacheProvider client={queryClient}>
 *       <MyPage />
 *     </SoulCacheProvider>
 *   );
 * }
 * ```
 */
export function SoulCacheProvider({
  client,
  children,
}: {
  readonly client: QueryClient;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <SoulCacheContext.Provider value={client}>
      {children}
    </SoulCacheContext.Provider>
  );
}

/**
 * Internal hook to access the QueryClient from context.
 * Throws if used outside of a SoulCacheProvider.
 */
export function useSoulCacheContext(): QueryClient {
  const client = useContext(SoulCacheContext);
  if (!client) {
    throw new Error(
      'useSoulCacheContext: No QueryClient found. ' +
      'Wrap your component tree with <SoulCacheProvider>.',
    );
  }
  return client;
}
