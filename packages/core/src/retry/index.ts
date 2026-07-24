/**
 * Retry Engine Module
 *
 * Provides configurable retry logic with exponential/linear/constant backoff,
 * error classification, jitter, and per-key attempt tracking.
 *
 * @module retry
 */

export { RetryEngine } from './retry-engine';
export { calculateDelay, isValidDelay } from './backoff';
export { classifyError, isRetryableByDefault, isInClassSet } from './error-classifier';
export type {
  RetryConfig,
  RetryContext,
  RetryResult,
  RetryMetadata,
  RetryEvent,
  RetryEventType,
  BackoffStrategy,
  ErrorClass,
} from './types';
export { DEFAULT_RETRY_CONFIG } from './types';
