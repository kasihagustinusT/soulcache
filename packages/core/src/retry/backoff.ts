import type { BackoffStrategy } from './types';

/**
 * Calculate Retry Delay
 *
 * Computes the delay before the next retry attempt.
 *
 * @param retryCount - Current retry count (0 = first retry)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @param backoff - Backoff strategy
 * @param jitter - Whether to add jitter
 * @returns Delay in milliseconds
 *
 * @remarks
 * - Exponential: baseDelay * 2^retryCount
 * - Linear: baseDelay * (retryCount + 1)
 * - Constant: baseDelay
 * - Jitter adds random value between 0-50% of calculated delay
 */
export function calculateDelay(
  retryCount: number,
  baseDelay: number,
  maxDelay: number,
  backoff: BackoffStrategy,
  jitter: boolean,
): number {
  let delay: number;

  switch (backoff) {
    case 'exponential':
      delay = calculateExponentialDelay(retryCount, baseDelay, maxDelay);
      break;
    case 'linear':
      delay = calculateLinearDelay(retryCount, baseDelay, maxDelay);
      break;
    case 'constant':
      delay = Math.min(baseDelay, maxDelay);
      break;
  }

  if (jitter) {
    delay = addJitter(delay);
  }

  return Math.max(0, Math.min(delay, maxDelay));
}

/**
 * Exponential Backoff
 *
 * delay = baseDelay * 2^retryCount, capped at maxDelay.
 */
function calculateExponentialDelay(
  retryCount: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const exponent = Math.min(retryCount, 30);
  const rawDelay = baseDelay * Math.pow(2, exponent);
  return Math.min(rawDelay, maxDelay);
}

/**
 * Linear Backoff
 *
 * delay = baseDelay * (retryCount + 1), capped at maxDelay.
 */
function calculateLinearDelay(
  retryCount: number,
  baseDelay: number,
  maxDelay: number,
): number {
  const rawDelay = baseDelay * (retryCount + 1);
  return Math.min(rawDelay, maxDelay);
}

/**
 * Add Jitter
 *
 * Adds a random value between 0 and 50% of the delay.
 * Prevents thundering herd when multiple clients retry simultaneously.
 */
function addJitter(delay: number): number {
  const jitterRange = delay * 0.5;
  const jitter = Math.random() * jitterRange;
  return delay + jitter;
}

/**
 * Verify Delay
 *
 * Asserts that a delay value is valid (not NaN, not Infinity, not negative).
 * Used in tests and validation.
 */
export function isValidDelay(delay: number): boolean {
  return Number.isFinite(delay) && delay >= 0;
}
