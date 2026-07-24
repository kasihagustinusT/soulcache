import type { ErrorCode } from './error-codes';

/**
 * SoulCache Error Options
 */
interface SoulCacheErrorOptions {
  code: ErrorCode;
  message: string;
  cause?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * SoulCache Error
 *
 * Base error class for all SoulCache runtime errors.
 *
 * @example
 * ```ts
 * throw new SoulCacheError({
 *   code: ErrorCode.INVALID_QUERY_KEY,
 *   message: 'Query key must be an array',
 * });
 * ```
 */
export class SoulCacheError extends Error {
  /**
   * Error code for programmatic handling
   */
  readonly code: ErrorCode;

  /**
   * Original error cause
   */
  readonly cause: Error | undefined;

  /**
   * Additional error metadata
   */
  readonly metadata: Record<string, unknown> | undefined;

  constructor(options: SoulCacheErrorOptions) {
    super(options.message);
    this.name = 'SoulCacheError';
    this.code = options.code;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
    if (options.metadata !== undefined) {
      this.metadata = options.metadata;
    }

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Configuration Error Options
 */
interface ConfigurationErrorOptions {
  message: string;
  cause?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Configuration Error
 *
 * Thrown when invalid configuration is provided.
 */
export class ConfigurationError extends SoulCacheError {
  constructor(options: ConfigurationErrorOptions) {
    const superOptions: SoulCacheErrorOptions = {
      code: 'SC_INVALID_CONFIGURATION',
      message: options.message,
    };
    if (options.cause !== undefined) {
      superOptions.cause = options.cause;
    }
    if (options.metadata !== undefined) {
      superOptions.metadata = options.metadata;
    }
    super(superOptions);
    this.name = 'ConfigurationError';
  }
}

/**
 * Query Error Options
 */
interface QueryErrorOptions {
  message: string;
  code?: ErrorCode;
  cause?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Query Error
 *
 * Thrown when query execution fails.
 */
export class QueryError extends SoulCacheError {
  constructor(options: QueryErrorOptions) {
    const superOptions: SoulCacheErrorOptions = {
      code: options.code ?? 'SC_FETCH_FAILED',
      message: options.message,
    };
    if (options.cause !== undefined) {
      superOptions.cause = options.cause;
    }
    if (options.metadata !== undefined) {
      superOptions.metadata = options.metadata;
    }
    super(superOptions);
    this.name = 'QueryError';
  }
}

/**
 * Cache Error Options
 */
interface CacheErrorOptions {
  message: string;
  cause?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Cache Error
 *
 * Thrown when cache operations fail.
 */
export class CacheError extends SoulCacheError {
  constructor(options: CacheErrorOptions) {
    const superOptions: SoulCacheErrorOptions = {
      code: 'SC_CACHE_ERROR',
      message: options.message,
    };
    if (options.cause !== undefined) {
      superOptions.cause = options.cause;
    }
    if (options.metadata !== undefined) {
      superOptions.metadata = options.metadata;
    }
    super(superOptions);
    this.name = 'CacheError';
  }
}

/**
 * Runtime Error Options
 */
interface RuntimeErrorOptions {
  message: string;
  code?: ErrorCode;
  cause?: Error;
  metadata?: Record<string, unknown>;
}

/**
 * Runtime Error
 *
 * Thrown when internal runtime errors occur.
 */
export class RuntimeError extends SoulCacheError {
  constructor(options: RuntimeErrorOptions) {
    const superOptions: SoulCacheErrorOptions = {
      code: options.code ?? 'SC_INTERNAL_ERROR',
      message: options.message,
    };
    if (options.cause !== undefined) {
      superOptions.cause = options.cause;
    }
    if (options.metadata !== undefined) {
      superOptions.metadata = options.metadata;
    }
    super(superOptions);
    this.name = 'RuntimeError';
  }
}
