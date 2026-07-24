import type { QueryKey } from './query.types';

/**
 * Query Client Configuration
 *
 * Configuration for creating a QueryClient instance.
 */
export interface QueryClientConfig {
  /** Default query options */
  readonly defaultOptions?: DefaultQueryOptions;

  /** Custom logger */
  readonly logger?: Logger;
}

/**
 * Default Query Options
 *
 * Default options applied to all queries.
 */
export interface DefaultQueryOptions {
  /** Default stale time in milliseconds */
  readonly staleTime?: number;

  /** Default garbage collection time in milliseconds */
  readonly gcTime?: number;

  /** Default retry count */
  readonly retry?: number;
}

/**
 * Logger Interface
 *
 * Structured logging interface for runtime events.
 */
export interface Logger {
  /** Log informational messages */
  readonly info: (message: string, ...args: unknown[]) => void;

  /** Log warning messages */
  readonly warn: (message: string, ...args: unknown[]) => void;

  /** Log error messages */
  readonly error: (message: string, ...args: unknown[]) => void;

  /** Log debug messages */
  readonly debug: (message: string, ...args: unknown[]) => void;
}

/**
 * Query Client Interface
 *
 * The public interface for the QueryClient.
 */
export interface QueryClientInstance {
  /** Fetch data and manage cache lifecycle */
  readonly fetchQuery: <T>(options: { queryKey: QueryKey; queryFn: () => Promise<T> }) => Promise<T>;

  /** Read cached data */
  readonly getQueryData: <T>(queryKey: QueryKey) => T | undefined;

  /** Update cached data manually */
  readonly setQueryData: <T>(queryKey: QueryKey, updater: T | ((prev: T | undefined) => T)) => void;

  /** Mark cached queries invalid */
  readonly invalidateQueries: (queryKey: QueryKey) => Promise<void>;

  /** Remove cached query */
  readonly removeQuery: (queryKey: QueryKey) => void;

  /** Clear entire cache */
  readonly clear: () => void;

  /** Release all runtime resources */
  readonly destroy: () => void;
}
