import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryEngine } from '../retry-engine';
import { calculateDelay, isValidDelay } from '../backoff';
import {
  classifyError,
  isRetryableByDefault,
  isInClassSet,
} from '../error-classifier';
import type { RetryConfig } from '../types';

describe('calculateDelay', () => {
  const baseConfig = {
    baseDelay: 1000,
    maxDelay: 30_000,
  };

  describe('exponential backoff', () => {
    it('should double delay each attempt', () => {
      expect(calculateDelay(0, 1000, 30_000, 'exponential', false)).toBe(1000);
      expect(calculateDelay(1, 1000, 30_000, 'exponential', false)).toBe(2000);
      expect(calculateDelay(2, 1000, 30_000, 'exponential', false)).toBe(4000);
      expect(calculateDelay(3, 1000, 30_000, 'exponential', false)).toBe(8000);
    });

    it('should cap at maxDelay', () => {
      expect(calculateDelay(20, 1000, 30_000, 'exponential', false)).toBe(30_000);
      expect(calculateDelay(5, 1000, 5000, 'exponential', false)).toBe(5000);
    });

    it('should handle overflow without producing Infinity', () => {
      const delay = calculateDelay(100, 1000, 30_000, 'exponential', false);
      expect(isValidDelay(delay)).toBe(true);
      expect(delay).toBe(30_000);
    });
  });

  describe('linear backoff', () => {
    it('should increase delay linearly', () => {
      expect(calculateDelay(0, 1000, 30_000, 'linear', false)).toBe(1000);
      expect(calculateDelay(1, 1000, 30_000, 'linear', false)).toBe(2000);
      expect(calculateDelay(2, 1000, 30_000, 'linear', false)).toBe(3000);
      expect(calculateDelay(3, 1000, 30_000, 'linear', false)).toBe(4000);
    });

    it('should cap at maxDelay', () => {
      expect(calculateDelay(30, 1000, 5000, 'linear', false)).toBe(5000);
    });
  });

  describe('constant backoff', () => {
    it('should return baseDelay every time', () => {
      expect(calculateDelay(0, 1000, 30_000, 'constant', false)).toBe(1000);
      expect(calculateDelay(5, 1000, 30_000, 'constant', false)).toBe(1000);
      expect(calculateDelay(50, 1000, 30_000, 'constant', false)).toBe(1000);
    });

    it('should cap at maxDelay', () => {
      expect(calculateDelay(0, 50_000, 30_000, 'constant', false)).toBe(30_000);
    });
  });

  describe('jitter', () => {
    it('should add random value to delay', () => {
      const delays = new Set<number>();
      for (let i = 0; i < 100; i++) {
        delays.add(calculateDelay(0, 1000, 30_000, 'exponential', true));
      }
      // With jitter, we should get multiple different values
      expect(delays.size).toBeGreaterThan(1);
    });

    it('should keep delay within bounds (base to base + 50%)', () => {
      for (let i = 0; i < 200; i++) {
        const delay = calculateDelay(0, 1000, 30_000, 'exponential', true);
        expect(delay).toBeGreaterThanOrEqual(1000);
        expect(delay).toBeLessThanOrEqual(1500);
      }
    });

    it('should not produce negative delays', () => {
      for (let i = 0; i < 100; i++) {
        const delay = calculateDelay(0, 1000, 30_000, 'exponential', true);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle baseDelay of 0', () => {
      expect(calculateDelay(0, 0, 30_000, 'exponential', false)).toBe(0);
      expect(calculateDelay(5, 0, 30_000, 'linear', false)).toBe(0);
    });

    it('should handle maxDelay of 0', () => {
      expect(calculateDelay(0, 1000, 0, 'exponential', false)).toBe(0);
    });
  });
});

describe('isValidDelay', () => {
  it('should return true for valid delays', () => {
    expect(isValidDelay(0)).toBe(true);
    expect(isValidDelay(1000)).toBe(true);
    expect(isValidDelay(30_000)).toBe(true);
  });

  it('should return false for invalid delays', () => {
    expect(isValidDelay(NaN)).toBe(false);
    expect(isValidDelay(Infinity)).toBe(false);
    expect(isValidDelay(-Infinity)).toBe(false);
    expect(isValidDelay(-1)).toBe(false);
  });
});

describe('classifyError', () => {
  it('should classify network errors', () => {
    const error = new TypeError('fetch failed');
    expect(classifyError(error)).toBe('network');
  });

  it('should classify abort errors', () => {
    const error = new DOMException('Aborted', 'AbortError');
    expect(classifyError(error)).toBe('abort');
  });

  it('should classify timeout errors', () => {
    const error = new DOMException('Timeout', 'TimeoutError');
    expect(classifyError(error)).toBe('timeout');
  });

  it('should classify timeout by name', () => {
    const error = new Error('Request timed out');
    error.name = 'TimeoutError';
    expect(classifyError(error)).toBe('timeout');
  });

  it('should classify 5xx as server', () => {
    const error = Object.assign(new Error('Server Error'), { status: 500 });
    expect(classifyError(error)).toBe('server');

    const error2 = Object.assign(new Error('Bad Gateway'), { status: 502 });
    expect(classifyError(error2)).toBe('server');

    const error3 = Object.assign(new Error('Unavailable'), { status: 503 });
    expect(classifyError(error3)).toBe('server');
  });

  it('should classify 429 as server (rate limited)', () => {
    const error = Object.assign(new Error('Too Many Requests'), { status: 429 });
    expect(classifyError(error)).toBe('server');
  });

  it('should classify 408 as timeout', () => {
    const error = Object.assign(new Error('Request Timeout'), { status: 408 });
    expect(classifyError(error)).toBe('timeout');
  });

  it('should classify 4xx as client', () => {
    const error = Object.assign(new Error('Bad Request'), { status: 400 });
    expect(classifyError(error)).toBe('client');

    const error2 = Object.assign(new Error('Unauthorized'), { status: 401 });
    expect(classifyError(error2)).toBe('client');

    const error3 = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(classifyError(error3)).toBe('client');

    const error4 = Object.assign(new Error('Not Found'), { status: 404 });
    expect(classifyError(error4)).toBe('client');
  });

  it('should classify unknown errors', () => {
    const error = new Error('Something weird happened');
    expect(classifyError(error)).toBe('unknown');
  });

  it('should classify errors with network in message', () => {
    const error = new Error('network connection lost');
    expect(classifyError(error)).toBe('network');
  });
});

describe('isRetryableByDefault', () => {
  it('should retry network errors', () => {
    expect(isRetryableByDefault('network')).toBe(true);
  });

  it('should retry timeout errors', () => {
    expect(isRetryableByDefault('timeout')).toBe(true);
  });

  it('should retry server errors', () => {
    expect(isRetryableByDefault('server')).toBe(true);
  });

  it('should retry unknown errors', () => {
    expect(isRetryableByDefault('unknown')).toBe(true);
  });

  it('should NOT retry client errors', () => {
    expect(isRetryableByDefault('client')).toBe(false);
  });

  it('should NOT retry abort errors', () => {
    expect(isRetryableByDefault('abort')).toBe(false);
  });
});

describe('isInClassSet', () => {
  it('should return true if class is in set', () => {
    expect(isInClassSet('server', ['network', 'server'])).toBe(true);
  });

  it('should return false if class is not in set', () => {
    expect(isInClassSet('client', ['network', 'server'])).toBe(false);
  });

  it('should return false for undefined set', () => {
    expect(isInClassSet('server', undefined)).toBe(false);
  });
});

describe('RetryEngine', () => {
  let engine: RetryEngine;

  beforeEach(() => {
    engine = new RetryEngine();
  });

  const defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 100, // Fast for tests
    maxDelay: 1000,
    backoff: 'exponential',
    jitter: false,
  };

  describe('calculateDelay', () => {
    it('should return 0 when maxRetries is 0', () => {
      expect(engine.calculateDelay(0, { ...defaultConfig, maxRetries: 0 })).toBe(0);
    });

    it('should calculate exponential backoff', () => {
      expect(engine.calculateDelay(0, defaultConfig)).toBe(100);
      expect(engine.calculateDelay(1, defaultConfig)).toBe(200);
      expect(engine.calculateDelay(2, defaultConfig)).toBe(400);
    });

    it('should cap at maxDelay', () => {
      expect(engine.calculateDelay(10, defaultConfig)).toBe(1000);
    });
  });

  describe('classifyError', () => {
    it('should classify errors', () => {
      expect(engine.classifyError(new TypeError('fetch failed'))).toBe('network');
      expect(engine.classifyError(new DOMException('Aborted', 'AbortError'))).toBe('abort');
    });
  });

  describe('shouldRetry', () => {
    it('should return false when maxRetries is 0', () => {
      const config = { ...defaultConfig, maxRetries: 0 };
      expect(engine.shouldRetry(new Error('fail'), 0, config)).toBe(false);
    });

    it('should return false when retry count exceeds maxRetries', () => {
      expect(engine.shouldRetry(new Error('fail'), 3, defaultConfig)).toBe(false);
    });

    it('should return false for abort errors', () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      expect(engine.shouldRetry(abortError, 0, defaultConfig)).toBe(false);
    });

    it('should return false for non-retryable error classes', () => {
      const config = {
        ...defaultConfig,
        nonRetryableErrors: ['server'] as const,
      };
      const serverError = Object.assign(new Error('Server Error'), { status: 500 });
      expect(engine.shouldRetry(serverError, 0, config)).toBe(false);
    });

    it('should return true for retryable error classes', () => {
      const config = {
        ...defaultConfig,
        retryableErrors: ['network'] as const,
      };
      const networkError = new TypeError('fetch failed');
      expect(engine.shouldRetry(networkError, 0, config)).toBe(true);
    });

    it('should respect custom retryOn predicate', () => {
      const config = {
        ...defaultConfig,
        retryOn: (_error: Error, attempt: number) => attempt < 2,
      };
      expect(engine.shouldRetry(new Error('fail'), 0, config)).toBe(true);
      expect(engine.shouldRetry(new Error('fail'), 1, config)).toBe(true);
      expect(engine.shouldRetry(new Error('fail'), 2, config)).toBe(false);
    });

    it('should give nonRetryableErrors precedence over retryableErrors', () => {
      const config = {
        ...defaultConfig,
        retryableErrors: ['server'] as const,
        nonRetryableErrors: ['server'] as const,
      };
      const serverError = Object.assign(new Error('Server Error'), { status: 500 });
      expect(engine.shouldRetry(serverError, 0, config)).toBe(false);
    });
  });

  describe('getRetryCount / resetCount', () => {
    it('should return 0 for unknown key', () => {
      expect(engine.getRetryCount(['unknown'])).toBe(0);
    });
  });

  describe('execute', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await engine.execute(fn, defaultConfig, ['test']);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry and succeed after failures', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValue('success');

      const resultPromise = engine.execute(fn, defaultConfig, ['test']);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should exhaust all retries and return error', async () => {
      const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

      const resultPromise = engine.execute(fn, defaultConfig, ['test']);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TypeError);
      expect(result.attempts).toBe(4); // 1 initial + 3 retries
      expect(fn).toHaveBeenCalledTimes(4);
    });

    it('should not retry when maxRetries is 0', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      const config = { ...defaultConfig, maxRetries: 0 };

      const result = await engine.execute(fn, config, ['test']);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry client errors by default', async () => {
      const clientError = Object.assign(new Error('Not Found'), { status: 404 });
      const fn = vi.fn().mockRejectedValue(clientError);

      const result = await engine.execute(fn, defaultConfig, ['test']);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should not retry abort errors', async () => {
      const abortError = new DOMException('Aborted', 'AbortError');
      const fn = vi.fn().mockRejectedValue(abortError);

      const result = await engine.execute(fn, defaultConfig, ['test']);

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
    });

    it('should respect AbortSignal cancellation', async () => {
      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue(new TypeError('fail'));

      const resultPromise = engine.execute(
        fn,
        { ...defaultConfig, maxRetries: 10 },
        ['test'],
        controller.signal,
      );

      // Let first attempt run, then cancel
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      // Advance past the sleep delay so the loop checks abort
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('AbortError');
    });

    it('should respect total timeout', async () => {
      const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
      const config = {
        ...defaultConfig,
        maxRetries: 10,
        timeout: 50,
      };

      const resultPromise = engine.execute(fn, config, ['test']);
      await vi.advanceTimersByTimeAsync(100);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBeLessThan(11);
    });
  });

  describe('events', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should emit retry:attempt on each retry', async () => {
      const events: string[] = [];
      engine.on('retry:attempt', () => events.push('attempt'));

      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      const resultPromise = engine.execute(fn, defaultConfig, ['test']);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(events).toEqual(['attempt']);
    });

    it('should emit retry:exhausted when all retries fail', async () => {
      const events: string[] = [];
      engine.on('retry:exhausted', () => events.push('exhausted'));

      const fn = vi.fn().mockRejectedValue(new TypeError('fail'));

      const resultPromise = engine.execute(fn, defaultConfig, ['test']);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(events).toEqual(['exhausted']);
    });

    it('should emit retry:cancelled on abort', async () => {
      const events: string[] = [];
      engine.on('retry:cancelled', () => events.push('cancelled'));

      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue(new TypeError('fail'));

      const resultPromise = engine.execute(
        fn,
        { ...defaultConfig, maxRetries: 10 },
        ['test'],
        controller.signal,
      );

      // Let first attempt run, then cancel
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      // Advance past the sleep delay so the loop checks abort
      await vi.advanceTimersByTimeAsync(200);
      await resultPromise;

      expect(events).toEqual(['cancelled']);
    });

    it('should emit retry:success on success', async () => {
      const events: string[] = [];
      engine.on('retry:success', () => events.push('success'));

      const fn = vi.fn().mockResolvedValue('ok');
      await engine.execute(fn, defaultConfig, ['test']);

      expect(events).toEqual(['success']);
    });

    it('should unsubscribe listeners', async () => {
      const events: string[] = [];
      const unsub = engine.on('retry:attempt', () => events.push('attempt'));

      const fn = vi.fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      const resultPromise = engine.execute(fn, defaultConfig, ['test']);
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(events).toEqual(['attempt']);

      unsub();

      const fn2 = vi.fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      const resultPromise2 = engine.execute(fn2, defaultConfig, ['test2']);
      await vi.runAllTimersAsync();
      await resultPromise2;

      expect(events).toEqual(['attempt']);
    });
  });

  describe('clearMetadata', () => {
    it('should reset all per-key tracking', () => {
      engine.clearMetadata();
      expect(engine.getRetryCount(['test'])).toBe(0);
    });
  });
});
