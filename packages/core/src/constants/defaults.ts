/**
 * Default Stale Time
 *
 * How long data is considered fresh (5 minutes).
 */
export const DEFAULT_STALE_TIME = 5 * 60 * 1000;

/**
 * Default Garbage Collection Time
 *
 * How long unused queries remain in memory (30 minutes).
 */
export const DEFAULT_GC_TIME = 30 * 60 * 1000;

/**
 * Default Retry Count
 *
 * Number of retry attempts for failed queries.
 */
export const DEFAULT_RETRY_COUNT = 3;

/**
 * Default Retry Delay
 *
 * Base delay between retries in milliseconds.
 */
export const DEFAULT_RETRY_DELAY = 1000;

/**
 * Default Retry Backoff Multiplier
 *
 * Multiplier for exponential backoff.
 */
export const DEFAULT_RETRY_BACKOFF = 2;

/**
 * Maximum Query Key Depth
 *
 * Maximum allowed nesting depth for query keys.
 */
export const MAX_QUERY_KEY_DEPTH = 10;

/**
 * Maximum Observer Count
 *
 * Maximum number of observers per query.
 */
export const MAX_OBSERVER_COUNT = 10000;

/**
 * Minimum Cache Size
 *
 * Minimum number of queries to maintain in cache.
 */
export const MIN_CACHE_SIZE = 100;

/**
 * Maximum Cache Size
 *
 * Maximum number of queries before eviction.
 */
export const MAX_CACHE_SIZE = 100000;

/**
 * Runtime Version
 *
 * Current runtime version.
 */
export const RUNTIME_VERSION = '0.1.0';
