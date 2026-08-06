import { useSyncExternalStore, useCallback, useRef, useEffect, useState } from 'react';
import type { QueryKey } from '@soulcache/core';
import { InfiniteQuery } from '@soulcache/core';

/**
 * A single page in the infinite query result.
 */
export interface InfiniteDataPage<TData> {
  /** The page data */
  readonly data: TData;
  /** The page parameter used to fetch this page */
  readonly pageParam: number | string;
  /** Zero-based index of this page */
  readonly pageIndex: number;
}

/**
 * Result of the useInfiniteQuery hook.
 */
export interface InfiniteQueryResult<TData> {
  /** All pages of data */
  readonly data: TData[] | undefined;
  /** All page objects with metadata */
  readonly pages: InfiniteDataPage<TData>[];
  /** The page parameters */
  readonly pageParams: (number | string)[];
  /** Current error if any */
  readonly error: Error | null;
  /** Query status */
  readonly status: 'idle' | 'loading' | 'success' | 'error' | 'fetching';
  /** Fetch status */
  readonly fetchStatus: 'idle' | 'fetching' | 'paused';
  /** Whether more pages are available forward */
  readonly hasNextPage: boolean;
  /** Whether more pages are available backward */
  readonly hasPreviousPage: boolean;
  /** Whether currently fetching the next page */
  readonly isFetchingNextPage: boolean;
  /** Whether currently fetching the previous page */
  readonly isFetchingPreviousPage: boolean;
  /** Whether any fetch is in progress */
  readonly isFetching: boolean;
  /** Number of pages loaded */
  readonly pageCount: number;
  /** Fetch the next page */
  readonly fetchNextPage: () => Promise<boolean>;
  /** Fetch the previous page */
  readonly fetchPreviousPage: () => Promise<boolean>;
}

/**
 * Options for the useInfiniteQuery hook.
 */
export interface UseInfiniteQueryOptions<TData, TPageParam = number> {
  /** Query key for cache identification */
  readonly queryKey: QueryKey;
  /** Fetch function receiving page parameters */
  readonly queryFn: (context: { pageParam: TPageParam; signal: AbortSignal }) => Promise<TData>;
  /** Function to determine the next page parameter */
  readonly getNextPageParam: (lastPage: TData, allPages: TData[], lastPageParam: TPageParam, allPageParams: TPageParam[]) => TPageParam | undefined;
  /** Function to determine the previous page parameter */
  readonly getPreviousPageParam?: (firstPage: TData, allPages: TData[], firstPageParam: TPageParam, allPageParams: TPageParam[]) => TPageParam | undefined;
  /** Initial page parameter */
  readonly initialPageParam?: TPageParam;
  /** Maximum number of pages to keep in memory (default: 50; set Infinity to keep all) */
  readonly maxPages?: number;
  /** Whether the query is enabled (default: true) */
  readonly enabled?: boolean;
}

/**
 * useInfiniteQuery
 *
 * Hook for paginated data with infinite scroll support.
 * Uses the InfiniteQuery class from @soulcache/core for page management
 * and useSyncExternalStore for React integration.
 *
 * @example
 * ```tsx
 * function PostList() {
 *   const {
 *     data, pages, hasNextPage, fetchNextPage, isFetchingNextPage
 *   } = useInfiniteQuery({
 *     queryKey: ['posts'],
 *     queryFn: ({ pageParam }) => fetchPosts(pageParam),
 *     getNextPageParam: (lastPage) => lastPage.nextCursor,
 *     initialPageParam: 0,
 *   });
 *
 *   return (
 *     <div>
 *       {pages.map(page => (
 *         <Post key={page.pageIndex} post={page.data} />
 *       ))}
 *       {hasNextPage && (
 *         <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
 *           {isFetchingNextPage ? 'Loading...' : 'Load more'}
 *         </button>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useInfiniteQuery<TData, TPageParam = number>(
  options: UseInfiniteQueryOptions<TData, TPageParam>,
): InfiniteQueryResult<TData> {
  const keyHash = JSON.stringify(options.queryKey);

  // ── Query instance lifecycle ───────────────────────────────────────
  // The InfiniteQuery is created synchronously during render so that
  // useSyncExternalStore's subscribe (called during React's commit phase,
  // before effects) can access it via queryRef.current. This prevents
  // the subscription from being a no-op on initial mount.

  const queryRef = useRef<InfiniteQuery<TData, TPageParam> | null>(null);
  const prevKeyHashRef = useRef(keyHash);

  // On key change, destroy old query before creating a new one
  if (prevKeyHashRef.current !== keyHash) {
    if (queryRef.current) {
      queryRef.current.destroy();
    }
    queryRef.current = null;
    prevKeyHashRef.current = keyHash;
  }

  // Lazy-create query instance if not yet present
  if (queryRef.current === null) {
    const queryConfig = {
      queryKey: options.queryKey,
      queryFn: options.queryFn as (context: { pageParam: TPageParam; signal?: AbortSignal }) => Promise<TData>,
      getNextPageParam: options.getNextPageParam as (lastPage: TData, allPages: TData[], lastPageParam: unknown, allPageParams: unknown[]) => TPageParam | undefined,
      initialPageParam: (options.initialPageParam ?? 0) as TPageParam,
      ...(options.getPreviousPageParam ? {
        getPreviousPageParam: options.getPreviousPageParam as (firstPage: TData, allPages: TData[], firstPageParam: unknown, allPageParams: unknown[]) => TPageParam | undefined,
      } : {}),
      ...(options.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
    };
    queryRef.current = new InfiniteQuery<TData, TPageParam>(queryConfig);
  }

  const query = queryRef.current;

  // ── Subscription ───────────────────────────────────────────────────
  // queryVersion is incremented when the query instance is recreated
  // after effect cleanup (e.g., React StrictMode double-effect), forcing
  // useSyncExternalStore to re-subscribe to the new instance.
  const [queryVersion, setQueryVersion] = useState(0);

  // keyHash and queryVersion are intentional dependencies: they force
  // useSyncExternalStore to re-subscribe when the query instance is
  // recreated (e.g., StrictMode double-effect). The callback itself reads
  // queryRef.current, so the reference points must be named in the body.
  const subscribe = useCallback(
    (listener: () => void) => {
      void keyHash;
      void queryVersion;
      const q = queryRef.current;
      if (!q) return () => {};
      return q.subscribe(listener);
    },
    [keyHash, queryVersion],
  );

  // ── Snapshot memoization ───────────────────────────────────────────
  const lastStateRef = useRef<{
    pages: unknown[];
    pageParams: unknown[];
    error: Error | null;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    isFetchingNextPage: boolean;
    isFetchingPreviousPage: boolean;
    isFetching: boolean;
  } | null>(null);

  const getSnapshot = useCallback(() => {
    const q = queryRef.current;
    if (!q) return null;
    const s = q.state;
    const prev = lastStateRef.current;
    if (
      prev !== null &&
      prev.pages === s.pages &&
      prev.pageParams === s.pageParams &&
      prev.error === s.error &&
      prev.hasNextPage === s.hasNextPage &&
      prev.hasPreviousPage === s.hasPreviousPage &&
      prev.isFetchingNextPage === s.isFetchingNextPage &&
      prev.isFetchingPreviousPage === s.isFetchingPreviousPage &&
      prev.isFetching === s.isFetching
    ) {
      return lastStateRef.current as typeof s;
    }
    lastStateRef.current = s;
    return s;
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, () => null);

  // ── Fetch and lifecycle ────────────────────────────────────────────
  // Effect handles initial fetch and cleanup on key/enable change or unmount.
  // The query itself is created during render (above), not in this effect.
  // `query` is in the dependency array so the effect re-runs when the
  // instance is recreated (key change or StrictMode cleanup/re-create).
  useEffect(() => {
    const q = queryRef.current;
    if (!q || q.isDestroyed) return;

    // Start initial fetch if enabled
    if (options.enabled !== false) {
      q.fetch().catch(() => {
        // Error handled via state
      });
    }

    return () => {
      q.destroy();
      queryRef.current = null;
      // Force useSyncExternalStore to re-subscribe after cleanup.
      // This handles React StrictMode where the effect runs, cleans up,
      // then runs again — the re-subscribe ensures the new query instance
      // is properly connected to the component.
      setQueryVersion((v) => v + 1);
    };
  }, [keyHash, options.enabled, query]);

  // ── Derived values ─────────────────────────────────────────────────
  const fetchNextPage = useCallback(async (): Promise<boolean> => {
    const q = queryRef.current;
    if (!q) return false;
    return q.fetchNextPage();
  }, []);

  const fetchPreviousPage = useCallback(async (): Promise<boolean> => {
    const q = queryRef.current;
    if (!q) return false;
    return q.fetchPreviousPage();
  }, []);

  const pages = (state?.pages ?? []).map((p) => ({
    data: p.data,
    pageParam: p.pageParam as number | string,
    pageIndex: p.pageIndex,
  }));
  const data = pages.map((p) => p.data);
  const pageParams = (state?.pageParams ?? []) as (number | string)[];

  return {
    data: data.length ? data : undefined,
    pages,
    pageParams,
    error: state?.error ?? null,
    status: state?.error ? 'error' : (state?.pages?.length ? 'success' : 'loading'),
    fetchStatus: state?.isFetching ? 'fetching' : 'idle',
    hasNextPage: state?.hasNextPage ?? false,
    hasPreviousPage: state?.hasPreviousPage ?? false,
    isFetchingNextPage: state?.isFetchingNextPage ?? false,
    isFetchingPreviousPage: state?.isFetchingPreviousPage ?? false,
    isFetching: state?.isFetching ?? false,
    pageCount: pages.length,
    fetchNextPage,
    fetchPreviousPage,
  };
}
