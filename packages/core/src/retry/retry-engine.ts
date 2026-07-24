import type { QueryKey } from '../types/query.types';
import type {
  RetryConfig,
  RetryContext,
  RetryResult,
  RetryMetadata,
  RetryEvent,
  RetryEventType,
  ErrorClass,
} from './types';
import { DEFAULT_RETRY_CONFIG } from './types';
import { calculateDelay, isValidDelay } from './backoff';
import { classifyError, isRetryableByDefault, isInClassSet } from './error-classifier';

/**
 * Retry Engine
 *
 * Manages retry logic for failed queries and mutations.
 * Provides delay calculation, error classification, retry decisions,
 * and per-key attempt tracking.
 *
 * Implements RETRY_SPEC interface and ADR-008 decision.
 *
 * @example
 * ```ts
 * const engine = new RetryEngine();
 *
 * // Check if we should retry
 * const shouldRetry = engine.shouldRetry(error, 2, {
 *   maxRetries: 3,
 *   baseDelay: 1000,
 *   maxDelay: 30_000,
 *   backoff: 'exponential',
 *   jitter: true,
 * });
 *
 * // Calculate delay
 * const delay = engine.calculateDelay(2, config);
 *
 * // Execute with automatic retries
 * const result = await engine.execute(
 *   () => fetch('/api/data'),
 *   config,
 *   ['users', 123],
 *   signal,
 * );
 * ```
 */
export class RetryEngine {
  /** Per-key retry metadata */
  private readonly metadata: Map<string, RetryMetadata> = new Map();

  /** Registered event listeners */
  private readonly listeners: Map<RetryEventType, Set<(event: RetryEvent) => void>> =
    new Map();

  /**
   * Calculate Delay
   *
   * Computes the delay before the next retry attempt.
   *
   * @param retryCount - Current retry count (0-indexed)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   */
  calculateDelay(retryCount: number, config: Readonly<RetryConfig>): number {
    if (config.maxRetries === 0) return 0;

    const delay = calculateDelay(
      retryCount,
      config.baseDelay,
      config.maxDelay,
      config.backoff,
      config.jitter,
    );

    return isValidDelay(delay) ? delay : 0;
  }

  /**
   * Classify Error
   *
   * Categorizes an error into an ErrorClass.
   *
   * @param error - The error to classify
   * @returns Error classification
   */
  classifyError(error: Error): ErrorClass {
    return classifyError(error);
  }

  /**
   * Should Retry
   *
   * Determines whether a failed attempt should be retried.
   *
   * Per RETRY_SPEC behaviors 6-9:
   * - Returns false if attempt >= maxRetries
   * - Returns false if error class is in nonRetryableErrors
   * - Returns false if error is abort
   * - Returns true if error class is in retryableErrors (or default retryable)
   *
   * @param error - The error from the failed attempt
   * @param retryCount - Current retry count (0-indexed)
   * @param config - Retry configuration
   * @returns true if the operation should be retried
   */
  shouldRetry(error: Error, retryCount: number, config: Readonly<RetryConfig>): boolean {
    if (config.maxRetries === 0) return false;
    if (retryCount >= config.maxRetries) return false;

    const errorClass = this.classifyError(error);

    if (errorClass === 'abort') return false;

    if (config.retryOn !== undefined) {
      return config.retryOn(error, retryCount);
    }

    if (isInClassSet(errorClass, config.nonRetryableErrors)) {
      return false;
    }

    if (isInClassSet(errorClass, config.retryableErrors)) {
      return true;
    }

    return isRetryableByDefault(errorClass);
  }

  /**
   * Get Retry Count
   *
   * Returns the current retry count for a given key.
   *
   * @param key - Query or mutation key
   * @returns Current retry count (0 if unknown)
   */
  getRetryCount(key: QueryKey): number {
    const keyHash = this.hashKey(key);
    return this.metadata.get(keyHash)?.count ?? 0;
  }

  /**
   * Reset Count
   *
   * Clears the retry counter for the specified key.
   * Per RETRY_SPEC edge case: resets the counter and marks abort.
   *
   * @param key - Query or mutation key
   */
  resetCount(key: QueryKey): void {
    const keyHash = this.hashKey(key);
    const meta = this.metadata.get(keyHash);
    if (meta !== undefined) {
      meta.abortRequested = true;
      meta.count = 0;
      meta.lastError = null;
      meta.lastErrorClass = 'unknown';
      this.metadata.delete(keyHash);
    }
  }

  /**
   * Get Metadata
   *
   * Returns the full retry metadata for a key.
   *
   * @param key - Query or mutation key
   * @returns Retry metadata or undefined
   */
  getMetadata(key: QueryKey): Readonly<RetryMetadata> | undefined {
    const keyHash = this.hashKey(key);
    return this.metadata.get(keyHash);
  }

  /**
   * Increment Attempt
   *
   * Records a new attempt for the given key.
   * Used internally during execute().
   *
   * @param key - Query or mutation key
   * @param error - The error from the attempt
   * @param errorClass - The classified error
   */
  private incrementAttempt(key: QueryKey, error: Error, errorClass: ErrorClass): void {
    const keyHash = this.hashKey(key);
    let meta = this.metadata.get(keyHash);

    if (meta === undefined) {
      meta = {
        count: 0,
        lastAttemptAt: Date.now(),
        sequenceStartedAt: Date.now(),
        lastError: null,
        lastErrorClass: 'unknown',
        abortRequested: false,
      };
      this.metadata.set(keyHash, meta);
    }

    meta.count++;
    meta.lastAttemptAt = Date.now();
    meta.lastError = error;
    meta.lastErrorClass = errorClass;
    meta.abortRequested = false;
  }

  /**
   * Execute
   *
   * Runs an operation with automatic retry logic.
   * Handles delay, cancellation via AbortSignal, and timeout.
   *
   * @param fn - The operation to execute (receives attempt number)
   * @param config - Retry configuration
   * @param key - Query or mutation key for tracking
   * @param signal - Optional AbortSignal for cancellation
   * @returns Retry result with success/error/status
   */
  async execute<T>(
    fn: (attempt: number, signal: AbortSignal) => Promise<T>,
    config: Readonly<RetryConfig>,
    key: QueryKey,
    signal?: AbortSignal,
  ): Promise<RetryResult<T>> {
    const startedAt = Date.now();
    const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | undefined;
    const totalAttempts = mergedConfig.maxRetries + 1;

    for (let attempt = 0; attempt < totalAttempts; attempt++) {
      if (signal?.aborted) {
        const abortError = new DOMException('Aborted', 'AbortError');
        this.emit('retry:cancelled', key, this.buildContext(
          attempt, totalAttempts, abortError, 'abort', 0, startedAt,
        ));
        return {
          success: false,
          error: abortError,
          attempts: attempt,
          elapsed: Date.now() - startedAt,
        };
      }

      const controller = new AbortController();

      if (signal !== undefined) {
        if (signal.aborted) {
          controller.abort();
        } else {
          signal.addEventListener('abort', () => controller.abort(), { once: true });
        }
      }

      try {
        const data = await fn(attempt, controller.signal);
        this.resetCount(key);
        this.emit('retry:success', key, this.buildContext(
          attempt, totalAttempts, new Error('success'), 'unknown', 0, startedAt,
        ));
        return {
          success: true,
          data,
          attempts: attempt + 1,
          elapsed: Date.now() - startedAt,
        };
      } catch (rawError) {
        controller.abort();
        const error = rawError instanceof Error ? rawError : new Error(String(rawError));
        const errorClass = this.classifyError(error);
        lastError = error;

        this.incrementAttempt(key, error, errorClass);

        const context = this.buildContext(
          attempt, totalAttempts, error, errorClass, 0, startedAt,
        );
        this.emit('retry:attempt', key, context);

        if (!this.shouldRetry(error, attempt, mergedConfig)) {
          this.emit('retry:exhausted', key, context);
          return {
            success: false,
            error,
            attempts: attempt + 1,
            elapsed: Date.now() - startedAt,
          };
        }

        const delay = this.calculateDelay(attempt + 1, mergedConfig);
        const delayContext = this.buildContext(
          attempt + 1, totalAttempts, error, errorClass, delay, startedAt,
        );
        this.emit('retry:delay', key, delayContext);

        if (mergedConfig.timeout !== undefined && mergedConfig.timeout > 0) {
          const elapsed = Date.now() - startedAt;
          if (elapsed + delay > mergedConfig.timeout) {
            this.emit('retry:exhausted', key, delayContext);
            return {
              success: false,
              error,
              attempts: attempt + 1,
              elapsed,
            };
          }
        }

        if (delay > 0) {
          await sleep(delay);
          if (signal?.aborted) {
            const abortError = new DOMException('Aborted', 'AbortError');
            this.emit('retry:cancelled', key, this.buildContext(
              attempt + 1, totalAttempts, abortError, 'abort', 0, startedAt,
            ));
            return {
              success: false,
              error: abortError,
              attempts: attempt + 1,
              elapsed: Date.now() - startedAt,
            };
          }
        }
      }
    }

    return {
      success: false,
      error: lastError ?? new Error('Retry exhausted'),
      attempts: totalAttempts,
      elapsed: Date.now() - startedAt,
    };
  }

  /**
   * On Event
   *
   * Registers a listener for retry events.
   *
   * @param type - Event type to listen for
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  on(type: RetryEventType, listener: (event: RetryEvent) => void): () => void {
    let listeners = this.listeners.get(type);
    if (listeners === undefined) {
      listeners = new Set();
      this.listeners.set(type, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners?.delete(listener);
    };
  }

  /**
   * Clear Metadata
   *
   * Removes all per-key retry metadata. Used for cleanup.
   */
  clearMetadata(): void {
    this.metadata.clear();
  }

  /**
   * Emit Event
   */
  private emit(
    type: RetryEventType,
    key: QueryKey,
    context: RetryContext,
  ): void {
    const listeners = this.listeners.get(type);
    if (listeners === undefined || listeners.size === 0) return;

    const event: RetryEvent = {
      type,
      key,
      context,
      timestamp: Date.now(),
    };

    for (const listener of listeners) {
      listener(event);
    }
  }

  /**
   * Build Context
   */
  private buildContext(
    attempt: number,
    maxAttempts: number,
    error: Error,
    errorClass: ErrorClass,
    delay: number,
    startedAt: number,
  ): RetryContext {
    return {
      attempt,
      maxAttempts,
      error,
      errorClass,
      delay,
      key: [],
      elapsed: Date.now() - startedAt,
      startedAt,
    };
  }

  /**
   * Hash Key
   *
   * Creates a stable string hash for a QueryKey.
   */
  private hashKey(key: QueryKey): string {
    return JSON.stringify(key, (_k, v) => {
      if (typeof v === 'function') return `fn:${v.name || 'anon'}`;
      return v;
    });
  }
}

/**
 * Sleep
 *
 * Promise-based delay. No signal handling — abort is checked in the caller's loop.
 */
function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
