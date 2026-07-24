import type { QueryKey, QueryStatus, FetchStatus } from './query.types';

/**
 * Query Options
 *
 * Configuration for a query operation.
 */
export interface QueryOptions<T> {
  /** Unique identity of cached data */
  readonly queryKey: QueryKey;

  /** Function responsible for fetching data */
  readonly queryFn: () => Promise<T>;

  /** Enable or disable automatic execution */
  readonly enabled?: boolean;

  /** Freshness duration in milliseconds */
  readonly staleTime?: number;

  /** Cache garbage collection duration in milliseconds */
  readonly gcTime?: number;

  /** Retry configuration */
  readonly retry?: number | RetryConfig;
}

/**
 * Retry Configuration
 *
 * Detailed retry behavior configuration.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  readonly maxRetries: number;

  /** Base delay between retries in milliseconds */
  readonly retryDelay: number;

  /** Backoff multiplier */
  readonly backoffMultiplier?: number;
}

/**
 * Query Result
 *
 * The result of a query operation.
 */
export interface QueryResult<T> {
  /** The query data */
  readonly data: T | undefined;

  /** The error if query failed */
  readonly error: Error | null;

  /** Current query status */
  readonly status: QueryStatus;

  /** Current fetch status */
  readonly fetchStatus: FetchStatus;

  /** Whether query is in initial loading state */
  readonly isLoading: boolean;

  /** Whether query is currently fetching */
  readonly isFetching: boolean;

  /** Whether query encountered an error */
  readonly isError: boolean;

  /** Whether query completed successfully */
  readonly isSuccess: boolean;

  /** Refetch the query */
  readonly refetch: () => Promise<void>;
}
