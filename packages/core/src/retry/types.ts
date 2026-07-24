import type { QueryKey } from '../types/query.types';

/**
 * Backoff Strategy
 *
 * Determines how retry delay scales with each attempt.
 */
export type BackoffStrategy = 'exponential' | 'linear' | 'constant';

/**
 * Error Classification
 *
 * Categorizes errors for retry decision-making.
 */
export type ErrorClass = 'network' | 'timeout' | 'server' | 'client' | 'abort' | 'unknown';

/**
 * Retry Configuration
 *
 * Controls retry behavior for a query or mutation.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (0 = no retry) */
  readonly maxRetries: number;

  /** Base delay in milliseconds */
  readonly baseDelay: number;

  /** Maximum delay cap in milliseconds */
  readonly maxDelay: number;

  /** Backoff strategy */
  readonly backoff: BackoffStrategy;

  /** Error classes that should be retried (default: all except abort) */
  readonly retryableErrors?: readonly ErrorClass[];

  /** Error classes that should NOT be retried (overrides retryableErrors) */
  readonly nonRetryableErrors?: readonly ErrorClass[];

  /** Whether to add jitter to delay calculations */
  readonly jitter: boolean;

  /** Custom retry predicate — overrides built-in classification */
  readonly retryOn?: (error: Error, attempt: number) => boolean;

  /** Retry timeout in ms — total time budget for all retries (0 = no limit) */
  readonly timeout?: number;
}

/**
 * Retry Context
 *
 * Passed to retry callbacks and event handlers.
 */
export interface RetryContext {
  /** Current attempt number (0-indexed: 0 = first attempt) */
  readonly attempt: number;

  /** Maximum attempts (including initial) */
  readonly maxAttempts: number;

  /** The error that triggered the retry */
  readonly error: Error;

  /** Classification of the error */
  readonly errorClass: ErrorClass;

  /** Calculated delay before next retry (ms) */
  readonly delay: number;

  /** Query key being retried */
  readonly key: QueryKey;

  /** Total elapsed time since first attempt (ms) */
  readonly elapsed: number;

  /** Timestamp when first attempt started */
  readonly startedAt: number;
}

/**
 * Retry Result
 *
 * Returned after a retry sequence completes.
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  readonly success: boolean;

  /** The result value if successful */
  readonly data?: T;

  /** The final error if all retries exhausted */
  readonly error?: Error;

  /** Total number of attempts made (including initial) */
  readonly attempts: number;

  /** Total time elapsed (ms) */
  readonly elapsed: number;
}

/**
 * Retry Metadata
 *
 * Per-key retry state tracked internally.
 */
export interface RetryMetadata {
  /** Current retry attempt count */
  count: number;

  /** Timestamp of last attempt */
  lastAttemptAt: number;

  /** Timestamp of first attempt in current sequence */
  sequenceStartedAt: number;

  /** Last error encountered */
  lastError: Error | null;

  /** Last error class */
  lastErrorClass: ErrorClass;

  /** Whether an abort was requested */
  abortRequested: boolean;
}

/**
 * Retry Event Types
 */
export type RetryEventType =
  | 'retry:attempt'
  | 'retry:delay'
  | 'retry:success'
  | 'retry:exhausted'
  | 'retry:cancelled';

/**
 * Retry Event
 *
 * Emitted during retry lifecycle.
 */
export interface RetryEvent {
  /** Event type */
  readonly type: RetryEventType;

  /** Key being retried */
  readonly key: QueryKey;

  /** Retry context at time of event */
  readonly context: RetryContext;

  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Default Retry Configuration
 */
export const DEFAULT_RETRY_CONFIG: Readonly<RetryConfig> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30_000,
  backoff: 'exponential',
  jitter: true,
} as const;
