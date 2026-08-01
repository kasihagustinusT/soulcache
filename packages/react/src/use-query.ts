import { useSyncExternalStore, useCallback, useMemo, useRef, useEffect } from 'react';
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

  // Store queryFn in a ref to avoid unnecessary re-fetches when the parent
  // creates a new function reference on each render.
  const queryFnRef = useRef(queryFn);
  queryFnRef.current = queryFn;

  // Store callbacks in refs so the effect doesn't depend on the options
  // object (which changes every render when parents pass inline objects).
  // The refs always read the latest callbacks.
  const onSuccessRef = useRef(options.onSuccess);
  const onErrorRef = useRef(options.onError);
  onSuccessRef.current = options.onSuccess;
  onErrorRef.current = options.onError;

  // Stabilize subscribe and getSnapshot with a stringified key. Without
  // this, every render creates a new array reference for queryKey, causing
  // useSyncExternalStore to tear down and rebuild subscriptions.
  const keyStr = JSON.stringify(queryKey);
  const queryKeyMemo = useMemo<QueryKey>(() => JSON.parse(keyStr) as QueryKey, [keyStr]);

  const subscribe = useCallback(
    (listener: () => void) => client.subscribeToQuery(queryKeyMemo, listener),
    [client, queryKeyMemo],
  );

  const getSnapshot = useCallback(() => {
    return client.getQuerySnapshot<T>(queryKeyMemo);
  }, [client, queryKeyMemo]);

  const getServerSnapshot = useCallback(() => {
    return client.getQuerySnapshot<T>(queryKeyMemo);
  }, [client, queryKeyMemo]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Track the pending fetch promise for cleanup on unmount and read
  // queryFnRef.current to avoid stale closures and unnecessary re-fetches.
  const pendingFetchRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const current = client.getQuerySnapshot<T>(queryKey);
    if (!current || current.status === 'idle') {
      const promise = client.fetchQuery({ queryKey, queryFn: queryFnRef.current }).catch(() => {
        // Error handled via snapshot
      });
      pendingFetchRef.current = promise;
    }

    return () => {
      pendingFetchRef.current = null;
    };
    // queryFn intentionally excluded from deps — the latest version is always
    // read via queryFnRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, queryKey, enabled]);

  // Track the previous status so callbacks fire only on transitions, not on
  // every matching snapshot change. Reset on key change so the new key
  // starts with a clean slate.
  const prevStatusRef = useRef<QueryStatus | undefined>(undefined);
  const prevKeyStrRef = useRef<string | undefined>(undefined);
  const dataRef = useRef<T | undefined>(undefined);
  const errorRef = useRef<Error | null>(null);

  useEffect(() => {
    if (!snapshot) return;

    // Reset tracking on key change so callbacks fire for the new key
    if (prevKeyStrRef.current !== keyStr) {
      prevKeyStrRef.current = keyStr;
      prevStatusRef.current = undefined;
      dataRef.current = undefined;
      errorRef.current = null;
    }

    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = snapshot.status;

    if (
      prevStatus !== 'success' &&
      snapshot.status === 'success' &&
      snapshot.data !== dataRef.current
    ) {
      dataRef.current = snapshot.data;
      onSuccessRef.current?.(snapshot.data as T);
    }

    if (
      prevStatus !== 'error' &&
      snapshot.status === 'error' &&
      snapshot.error !== errorRef.current
    ) {
      errorRef.current = snapshot.error;
      onErrorRef.current?.(snapshot.error as Error);
    }
  }, [snapshot, keyStr]);

  const isLoading = snapshot?.status === 'loading' && !snapshot?.data;
  const isFetching = snapshot?.fetchStatus === 'fetching';
  const isError = snapshot?.status === 'error';
  const isSuccess = snapshot?.status === 'success';
  const isIdle = snapshot?.status === 'idle' || !snapshot;

  // Handle suspense
  // .catch() prevents an unhandled rejection if the Suspense boundary unmounts
  // before the fetch settles. The error remains observable via snapshot state.
  // A null/undefined snapshot (first-time query with no cache entry) is also
  // treated as loading — the snapshot is undefined when no state machine exists.
  if (options.suspense && !snapshot?.data && (!snapshot || snapshot?.status === 'loading')) {
    throw client.fetchQuery({ queryKey, queryFn }).catch(() => {});
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
