/**
 * SoulCache Error Codes
 *
 * Predictable error codes for all runtime errors.
 */
export const ErrorCode = {
  /** Invalid query key provided */
  INVALID_QUERY_KEY: 'SC_INVALID_QUERY_KEY',

  /** Invalid configuration provided */
  INVALID_CONFIGURATION: 'SC_INVALID_CONFIGURATION',

  /** Fetch operation failed */
  FETCH_FAILED: 'SC_FETCH_FAILED',

  /** Cache operation failed */
  CACHE_ERROR: 'SC_CACHE_ERROR',

  /** Internal runtime error */
  INTERNAL_ERROR: 'SC_INTERNAL_ERROR',

  /** Query already destroyed */
  QUERY_DESTROYED: 'SC_QUERY_DESTROYED',

  /** Invalid lifecycle transition */
  INVALID_TRANSITION: 'SC_INVALID_TRANSITION',

  /** Runtime not initialized */
  NOT_INITIALIZED: 'SC_NOT_INITIALIZED',

  /** Runtime already destroyed */
  ALREADY_DESTROYED: 'SC_ALREADY_DESTROYED',

  /** Operation cancelled */
  CANCELLED: 'SC_CANCELLED',
} as const;

/**
 * Error Code Type
 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
