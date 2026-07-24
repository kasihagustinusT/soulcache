/**
 * Internal Query Record
 *
 * Represents a single query instance managed by the runtime.
 * Extends RFC-000 CacheEntry with operational fields.
 * @internal
 */
export interface QueryRecord<T = unknown> {
  /** Unique query identifier */
  readonly queryId: string;

  /** Query key supplied by public API */
  readonly queryKey: readonly unknown[];

  /** Deterministic hash derived from QueryKey (RFC-000: keyHash) */
  readonly keyHash: string;

  /** Current query lifecycle state */
  state: QueryRecordState;

  /** Cache freshness status (RFC-000) */
  status: CacheStatus;

  /** Cached data payload (RFC-000) */
  data: T;

  /** ISO-8601 timestamp when the entry was written (RFC-000) */
  updatedAt: string;

  /** ISO-8601 timestamp when the entry becomes stale, null = never (RFC-000) */
  staleAt: string | null;

  /** ISO-8601 timestamp when the entry is evicted, null = never (RFC-000) */
  expiresAt: string | null;

  /** Version counter for optimistic concurrency (RFC-000) */
  version: number;

  /** Dependencies — other key hashes that should invalidate this entry (RFC-000) */
  dependencies: string[];

  /** Metadata attached by plugins or middleware (RFC-000) */
  meta: Record<string, unknown>;

  /** Current error */
  error: Error | null;

  /** Creation timestamp (internal) */
  readonly createdAt: number;

  /** Latest successful fetch timestamp (internal) */
  lastFetchedAt: number | undefined;

  /** Number of active observers (internal) */
  observerCount: number;

  /** Number of retry attempts (internal) */
  retryCount: number;

  /** Current fetch status (internal) */
  fetchStatus: QueryRecordFetchStatus;
}

/**
 * Cache Entry Status (RFC-000)
 *
 * Represents the freshness lifecycle of a cache entry.
 */
export type CacheStatus = 'fresh' | 'stale' | 'expired' | 'invalidated';

/**
 * Query Record State
 *
 * Internal state representation.
 */
export type QueryRecordState =
  | 'idle'
  | 'pending'
  | 'success'
  | 'error'
  | 'fetching'
  | 'stale'
  | 'invalidated'
  | 'destroyed';

/**
 * Query Record Fetch Status
 */
export type QueryRecordFetchStatus = 'idle' | 'fetching' | 'paused';

/**
 * Query Record Metadata
 *
 * Internal operational metadata (not part of RFC-000 CacheEntry).
 * RFC-000 uses `meta: Record<string, unknown>` for plugin/middleware data.
 */
export interface QueryRecordMetadata {
  /** Whether eligible for garbage collection */
  gcEligible: boolean;

  /** Whether query persists across sessions */
  readonly persistent: boolean;

  /** Whether query was prefetched */
  readonly prefetched: boolean;

  /** Whether query was manually created */
  readonly manual: boolean;
}
