import { useSyncExternalStore, useCallback, useRef, useEffect } from 'react';
import type { QueryKey, QueryStatus, FetchStatus } from '@soulcache/core';
import { useSoulCacheContext } from './context';

/**
 * Result of the useQuery hook.
 */
export interface QueryResult<T> {
  /** Current query data */
  readonly data: T | undefined;
  /** Current error if any */
  readonly error: Error | null;
  /** Query status */
  readonly status: QueryStatus;
  /** Fetch status (idle, fetching, paused) */
  readonly fetchStatus: FetchStatus;
  /** Whether the query is currently loading (initial fetch) */
  readonly isLoading: boolean;
  /** Whether the query is currently fetching (any fetch including background) */
  readonly isFetching: boolean;
  /** Whether the query has error state */
  readonly isError: boolean;
  /** Whether the query has succeeded */
  readonly isSuccess: boolean;
  /** Whether the query has no data yet */
  readonly isIdle: boolean;
  /** Timestamp of last successful update */
  readonly dataUpdatedAt: number;
}

/**
 * Options for the useQuery hook.
 */
export interface UseQueryOptions<T> {
  /** Query key for cache identification */
  readonly queryKey: QueryKey;
  /** Fetch function that returns the data */
  readonly queryFn: () => Promise<T>;
  /** Whether the query is enabled (default: true) */
  readonly enabled?: boolean;
  /** Whether the query should suspend (default: false) */
  readonly suspense?: boolean;
  /** Whether the query should throw on error (default: false) */
  readonly throwOnError?: boolean;
  /** Callback when query succeeds */
  readonly onSuccess?: (data: T) => void;
  /** Callback when query errors */
  readonly onError?: (error: Error) => void;
}

/**
 * useQuery
 *
 * Hook for reading and subscribing to query data.
 * Uses useSyncExternalStore for React 18+ concurrent mode compatibility.
 *
 * @example
 * ```tsx
 * function UserProfile({ userId }: { userId: string }) {
 *   const { data, isLoading, error } = useQuery({
 *     queryKey: ['user', userId],
 *     queryFn: () => fetchUser(userId),
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (error) return <ErrorMessage error={error} />;
 *   return <div>{data?.name}</div>;
 * }
 * ```
 */
export function useQuery<T>(options: UseQueryOptions<T>): QueryResult<T> {
  const client = useSoulCacheContext();
  const { queryKey, queryFn, enabled = true } = options;

  // Subscribe to query changes via useSyncExternalStore
  const subscribe = useCallback(
    (listener: () => void) => client.subscribeToQuery(queryKey, listener),
    [client, queryKey],
  );

  const getSnapshot = useCallback(() => {
    return client.getQuerySnapshot<T>(queryKey);
  }, [client, queryKey]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  // Fetch on mount and when enabled
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    if (!enabledRef.current) return;

    const current = client.getQuerySnapshot<T>(queryKey);
    if (!current || current.status === 'idle') {
      client.fetchQuery({ queryKey, queryFn }).catch(() => {
        // Error handled via snapshot
      });
    }
  }, [client, queryKey, queryFn]);

  // Handle callbacks
  const dataRef = useRef<T | undefined>(undefined);
  const errorRef = useRef<Error | null>(null);

  useEffect(() => {
    if (!snapshot) return;

    if (snapshot.status === 'success' && snapshot.data !== dataRef.current) {
      dataRef.current = snapshot.data;
      options.onSuccess?.(snapshot.data as T);
    }

    if (snapshot.status === 'error' && snapshot.error !== errorRef.current) {
      errorRef.current = snapshot.error;
      options.onError?.(snapshot.error as Error);
    }
  }, [snapshot, options]);

  const isLoading = snapshot?.status === 'loading' && !snapshot?.data;
  const isFetching = snapshot?.fetchStatus === 'fetching';
  const isError = snapshot?.status === 'error';
  const isSuccess = snapshot?.status === 'success';
  const isIdle = snapshot?.status === 'idle' || !snapshot;

  // Handle suspense
  if (options.suspense && !snapshot?.data && snapshot?.status === 'loading') {
    throw client.fetchQuery({ queryKey, queryFn });
  }

  // Handle throwOnError
  if (options.throwOnError && snapshot?.error) {
    throw snapshot.error;
  }

  return {
    data: snapshot?.data as T | undefined,
    error: snapshot?.error ?? null,
    status: snapshot?.status ?? 'idle',
    fetchStatus: snapshot?.fetchStatus ?? 'idle',
    isLoading,
    isFetching,
    isError,
    isSuccess,
    isIdle,
    dataUpdatedAt: snapshot?.updatedAt ?? 0,
  };
}
