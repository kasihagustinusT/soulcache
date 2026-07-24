import type { QueryKey } from './query.types';

/**
 * Infinite Query Page
 *
 * Represents a single page of data in an infinite query.
 */
export interface InfiniteQueryPage<TData = unknown> {
  /** The page data */
  readonly data: TData;

  /** The page param that was used to fetch this page */
  readonly pageParam: unknown;

  /** The page index (0-based) */
  readonly pageIndex: number;
}

/**
 * Infinite Query State
 *
 * The internal state of an infinite query.
 */
export interface InfiniteQueryState<TData = unknown> {
  /** All pages of data */
  readonly pages: InfiniteQueryPage<TData>[];

  /** All page params in order */
  readonly pageParams: unknown[];

  /** Whether more pages can be fetched in the forward direction */
  readonly hasNextPage: boolean;

  /** Whether more pages can be fetched in the backward direction */
  readonly hasPreviousPage: boolean;

  /** Whether a fetch is currently in progress */
  readonly isFetchingNextPage: boolean;

  /** Whether a backward fetch is currently in progress */
  readonly isFetchingPreviousPage: boolean;

  /** The error if fetch failed */
  readonly error: Error | null;
}

/**
 * Infinite Query Options
 *
 * Configuration for an infinite query operation.
 */
export interface InfiniteQueryOptions<TData = unknown, TPageParam = unknown> {
  /** Unique identity of cached data */
  readonly queryKey: QueryKey;

  /**
   * Function responsible for fetching a single page.
   * Receives the page param and should return the page data.
   */
  readonly queryFn: (context: { pageParam: TPageParam; signal?: AbortSignal }) => Promise<TData>;

  /**
   * Returns the page param for the first page.
   * Defaults to `0` if not provided.
   */
  readonly initialPageParam?: TPageParam;

  /**
   * Given the data from the last page and all pages, returns the param
   * for the next page. Return `undefined` to indicate no more pages.
   */
  readonly getNextPageParam: (
    lastPage: TData,
    allPages: TData[],
    lastPageParam: unknown,
    allPageParams: unknown[],
  ) => TPageParam | undefined;

  /**
   * Given the data from the first page and all pages, returns the param
   * for the previous page. Return `undefined` to indicate no more pages.
   */
  readonly getPreviousPageParam?: (
    firstPage: TData,
    allPages: TData[],
    firstPageParam: unknown,
    allPageParams: unknown[],
  ) => TPageParam | undefined;

  /** Enable or disable automatic execution */
  readonly enabled?: boolean;

  /** Freshness duration in milliseconds */
  readonly staleTime?: number;

  /** Cache garbage collection duration in milliseconds */
  readonly gcTime?: number;

  /** Maximum number of pages to keep in cache */
  readonly maxPages?: number;
}

/**
 * Infinite Query Result
 *
 * The result of an infinite query operation.
 */
export interface InfiniteQueryResult<TData = unknown> {
  /** All pages of data flattened */
  readonly data: TData[];

  /** The full state including page metadata */
  readonly state: InfiniteQueryState<TData>;

  /** Whether the query is in initial loading state (no data yet) */
  readonly isLoading: boolean;

  /** Whether any fetch is currently in progress */
  readonly isFetching: boolean;

  /** Whether the next page is being fetched */
  readonly isFetchingNextPage: boolean;

  /** Whether the previous page is being fetched */
  readonly isFetchingPreviousPage: boolean;

  /** Whether more pages can be fetched forward */
  readonly hasNextPage: boolean;

  /** Whether more pages can be fetched backward */
  readonly hasPreviousPage: boolean;

  /** Whether query encountered an error */
  readonly isError: boolean;

  /** The error if query failed */
  readonly error: Error | null;

  /** Whether query completed successfully */
  readonly isSuccess: boolean;

  /** Fetch the next page */
  readonly fetchNextPage: () => Promise<void>;

  /** Fetch the previous page */
  readonly fetchPreviousPage: () => Promise<void>;

  /** Refetch all pages */
  readonly refetch: () => Promise<void>;
}
