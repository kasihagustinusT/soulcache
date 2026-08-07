import type { ErrorClass } from './types';

/**
 * Error with status code
 *
 * Interface for HTTP-like errors that carry a numeric status code.
 */
interface StatusError extends Error {
  readonly status: number;
}

/**
 * Determine if an error has a numeric status property.
 */
function hasStatus(error: Error): error is StatusError {
  return typeof (error as unknown as Record<string, unknown>).status === 'number';
}

/**
 * Classify Error
 *
 * Categorizes an error into an ErrorClass for retry decision-making.
 *
 * Classification rules (per RETRY_SPEC behavior 5 and ADR-008):
 * - TypeError / fetch failures → 'network'
 * - AbortError (name === 'AbortError') → 'abort'
 * - TimeoutError (name includes 'timeout') → 'timeout'
 * - HTTP 5xx → 'server' (retryable)
 * - HTTP 429 → 'server' (rate limited, retryable)
 * - HTTP 4xx (except 408, 429) → 'client' (non-retryable)
 * - HTTP 408 → 'timeout' (request timeout, retryable)
 * - Everything else → 'unknown'
 *
 * @param error - The error to classify
 * @returns The error class
 */
export function classifyError(error: Error): ErrorClass {
  const name = error.name;

  if (name === 'AbortError') {
    return 'abort';
  }

  if (isTimeoutError(error)) {
    return 'timeout';
  }

  if (isNetworkError(error)) {
    return 'network';
  }

  if (hasStatus(error)) {
    return classifyByStatus(error.status);
  }

  return 'unknown';
}

/**
 * Check if error is a network error.
 *
 * Network errors are detected by typed contracts, not message content:
 * - TypeError (fetch's canonical network-failure type)
 * - Errors whose name is in the closed network set (FetchError, NetworkError)
 * - Errors whose cause chain carries a typed network signal
 *
 * Message substrings (e.g. 'fetch', 'network') are deliberately ignored so an
 * application error that merely mentions a network concept is never
 * misclassified as retryable (F-9).
 */
function isNetworkError(error: Error): boolean {
  if (error instanceof TypeError) {
    return true;
  }
  if (error.name === 'FetchError' || error.name === 'NetworkError') {
    return true;
  }
  return hasNetworkCause(error.cause);
}

/**
 * Check if an error's cause chain carries a typed network signal.
 */
function hasNetworkCause(cause: unknown): boolean {
  if (cause instanceof TypeError) {
    return true;
  }
  if (cause instanceof Error) {
    return cause.name === 'FetchError' || cause.name === 'NetworkError';
  }
  return false;
}

/**
 * Check if error is a timeout error.
 *
 * Timeout errors include:
 * - DOMException with name 'TimeoutError'
 * - Errors with 'timeout' in the name
 */
function isTimeoutError(error: Error): boolean {
  const name = error.name;
  if (name === 'TimeoutError') {
    return true;
  }
  return name.toLowerCase().includes('timeout');
}

/**
 * Classify by HTTP status code.
 *
 * Per RETRY_BEHAVIOR.md:
 * - 500, 502, 503, 504 → 'server' (retryable)
 * - 408 → 'timeout' (retryable)
 * - 429 → 'server' (rate limited, retryable)
 * - 400, 401, 403, 404, etc. → 'client' (non-retryable)
 */
function classifyByStatus(status: number): ErrorClass {
  if (status === 429) return 'server';
  if (status === 408) return 'timeout';
  if (status >= 500) return 'server';
  if (status >= 400) return 'client';
  return 'unknown';
}

/**
 * Check if an error class is retryable by default.
 *
 * Per RETRY_SPEC behaviors 6-9 and F-9:
 * - 'abort' is never retried by default
 * - 'client' is not retried (except 408, 429 which map to timeout/server)
 * - 'unknown' is not retried by default — unclassified errors must not
 *   trigger a retry storm; opt in via `retryableErrors` or `retryOn`
 * - 'network', 'timeout', 'server' are retried by default
 */
export function isRetryableByDefault(errorClass: ErrorClass): boolean {
  switch (errorClass) {
    case 'network':
    case 'timeout':
    case 'server':
      return true;
    case 'client':
    case 'abort':
    case 'unknown':
      return false;
  }
}

/**
 * Check if error class is in a given set.
 */
export function isInClassSet(
  errorClass: ErrorClass,
  classSet: readonly ErrorClass[] | undefined,
): boolean {
  if (classSet === undefined) return false;
  return classSet.includes(errorClass);
}
