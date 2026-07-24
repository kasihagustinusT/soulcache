/**
 * @soulcache/react
 *
 * Thin React adapter for the SoulCache Core Runtime.
 * All business logic lives in @soulcache/core.
 * This package only bridges Core Runtime to React via useSyncExternalStore.
 *
 * @module @soulcache/react
 */

// Re-export core types for consumer convenience
export type { QueryStatus, FetchStatus, MutationStatus } from '@soulcache/core';

// Provider
export { SoulCacheProvider } from './context';

// Hooks
export { useQuery, type QueryResult, type UseQueryOptions } from './use-query';
export { useMutation, type MutationResult, type UseMutationOptions } from './use-mutation';
export { useInfiniteQuery, type InfiniteQueryResult, type UseInfiniteQueryOptions, type InfiniteDataPage } from './use-infinite-query';
export { useQueryClient } from './use-query-client';
export { usePrefetchQuery } from './use-prefetch-query';
export { useIsFetching } from './use-is-fetching';
export { useIsMutating } from './use-is-mutating';

// Components
export { HydrationBoundary } from './hydration-boundary';
