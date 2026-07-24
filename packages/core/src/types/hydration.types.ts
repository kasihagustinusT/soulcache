import type { QueryKey } from '../types/query.types';

/**
 * Dehydrated Query
 *
 * A serialized representation of a query entry for transport.
 */
export interface DehydratedQuery {
  /** The query key */
  readonly queryKey: QueryKey;

  /** The key hash (RFC-000) */
  readonly keyHash: string;

  /** The serialized query data */
  readonly data: unknown;

  /** The query state */
  readonly state: 'idle' | 'pending' | 'success' | 'error';

  /** The serialized error if any */
  readonly error?: {
    readonly message: string;
    readonly name: string;
    readonly stack?: string;
  };

  /** When the data was last updated */
  readonly updatedAt: number;

  /** When the data was last fetched */
  readonly lastFetchedAt?: number;

  /** When the data becomes stale */
  readonly staleAt?: number;
}

/**
 * Dehydrated State
 *
 * The complete serialized state of the query cache.
 */
export interface DehydratedState {
  /** Version of the dehydration format */
  readonly version: number;

  /** Timestamp when state was dehydrated */
  readonly timestamp: number;

  /** All dehydrated queries */
  readonly queries: DehydratedQuery[];
}

/**
 * Hydration Options
 */
export interface HydrationOptions {
  /** Maximum number of queries to hydrate */
  readonly maxQueries?: number;

  /**
   * Filter which queries to hydrate.
   * Return true to include the query, false to skip.
   */
  readonly filter?: (query: DehydratedQuery) => boolean;

  /**
   * Override behavior for existing queries.
   * - 'skip': Don't hydrate if query already exists
   * - 'overwrite': Replace existing query data
   * - 'merge': Merge with existing data (requires custom merge function)
   */
  readonly mergeStrategy?: 'skip' | 'overwrite' | 'merge';
}

/**
 * Dehydration Options
 */
export interface DehydrationOptions {
  /** Maximum number of queries to dehydrate */
  readonly maxQueries?: number;

  /**
   * Filter which queries to dehydrate.
   * Return true to include the query, false to skip.
   */
  readonly filter?: (query: DehydratedQuery) => boolean;

  /**
   * Whether to include query errors in dehydration.
   * Defaults to true.
   */
  readonly includeErrors?: boolean;

  /**
   * Whether to include stale/expired queries.
   * Defaults to false.
   */
  readonly includeStale?: boolean;
}
