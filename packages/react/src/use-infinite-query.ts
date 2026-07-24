import { useSyncExternalStore, useCallback, useRef, useEffect } from 'react';
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
  /** Maximum number of pages to keep in memory */
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
  const queryRef = useRef<InfiniteQuery<TData, TPageParam> | null>(null);

  // Create InfiniteQuery instance (lifecycle managed by effect)
  useEffect(() => {
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
    const query = new InfiniteQuery<TData, TPageParam>(queryConfig);

    queryRef.current = query;

    // Initial fetch
    if (options.enabled !== false) {
      query.fetch().catch(() => {
        // Error handled via state
      });
    }

    return () => {
      query.destroy();
      queryRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.queryKey]);

  // Subscribe to infinite query state changes
  const subscribe = useCallback(
    (listener: () => void) => {
      const query = queryRef.current;
      if (!query) return () => {};
      return query.subscribe(listener);
    },
    [],
  );

  const getSnapshot = useCallback(() => {
    const query = queryRef.current;
    if (!query) return null;
    return query.state;
  }, []);

  const state = useSyncExternalStore(subscribe, getSnapshot, () => null);

  const fetchNextPage = useCallback(async (): Promise<boolean> => {
    const query = queryRef.current;
    if (!query) return false;
    return query.fetchNextPage();
  }, []);

  const fetchPreviousPage = useCallback(async (): Promise<boolean> => {
    const query = queryRef.current;
    if (!query) return false;
    return query.fetchPreviousPage();
  }, []);

  const query = queryRef.current;
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
    status: state?.pages?.length ? 'success' : 'loading',
    fetchStatus: (query?.isFetchingNextPage || query?.isFetchingPreviousPage) ? 'fetching' : 'idle',
    hasNextPage: query?.hasNextPage ?? false,
    hasPreviousPage: query?.hasPreviousPage ?? false,
    isFetchingNextPage: query?.isFetchingNextPage ?? false,
    isFetchingPreviousPage: query?.isFetchingPreviousPage ?? false,
    isFetching: (query?.isFetchingNextPage || query?.isFetchingPreviousPage) ?? false,
    pageCount: pages.length,
    fetchNextPage,
    fetchPreviousPage,
  };
}
