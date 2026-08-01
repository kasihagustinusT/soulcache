import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';

const key = ['bug-new-90'];
const defaultConfig = {
  maxRetries: 3,
  baseDelay: 10_000,
  maxDelay: 30_000,
  backoff: 'exponential' as const,
  jitter: false,
};

describe('retry metadata cleanup on abort path', () => {
  let engine: RetryEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new RetryEngine();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clean up metadata after abort during sleep delay', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const resultPromise = engine.execute(
      fn,
      { ...defaultConfig, maxRetries: 10 },
      key,
      controller.signal,
    );

    // Let first attempt run and fail, shouldRetry -> true, sleep starts
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.getRetryCount(key)).toBe(1);

    // Abort during sleep
    controller.abort();
    await vi.advanceTimersByTimeAsync(200);
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect((result.error as Error)?.name).toBe('AbortError');

    // Metadata should be deleted
    expect(engine.getRetryCount(key)).toBe(0);
    expect(engine.getMetadata(key)).toBeUndefined();
  });

  it('should not carry over stale retry count to a new retry session after sleep abort', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    // First session: aborted during sleep
    const resultPromise1 = engine.execute(
      fn,
      { ...defaultConfig, maxRetries: 10 },
      key,
      controller.signal,
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.getRetryCount(key)).toBe(1);
    controller.abort();
    await vi.advanceTimersByTimeAsync(200);
    const result1 = await resultPromise1;
    expect(result1.success).toBe(false);

    // Second session: fresh retry, fresh controller
    const controller2 = new AbortController();
    const fn2 = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValue('success');

    const resultPromise2 = engine.execute(fn2, defaultConfig, key, controller2.signal);
    await vi.runAllTimersAsync();
    const result2 = await resultPromise2;

    // Count did not carry over — we got all 4 attempts
    expect(result2.success).toBe(true);
    expect(result2.data).toBe('success');
    expect(result2.attempts).toBe(4);
    expect(fn2).toHaveBeenCalledTimes(4);
  });

  it('should clean up stale metadata when execute() starts with already-aborted signal', async () => {
    // First session leaves orphaned metadata
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const resultPromise1 = engine.execute(
      fn,
      { ...defaultConfig, maxRetries: 10 },
      key,
      controller.signal,
    );
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.getRetryCount(key)).toBe(1);
    controller.abort();
    await vi.advanceTimersByTimeAsync(200);
    await resultPromise1;

    // Without the fix, metadata would still exist at this point.
    // Let's verify the fix in early-abort path:
    const abortedController = new AbortController();
    abortedController.abort(); // already aborted

    const fn2 = vi.fn().mockRejectedValue(new Error('should not run'));

    // With already-aborted signal, early return should clean up metadata
    const result2 = await engine.execute(fn2, defaultConfig, key, abortedController.signal);

    expect(result2.success).toBe(false);
    expect((result2.error as Error)?.name).toBe('AbortError');
    expect(fn2).not.toHaveBeenCalled();

    // Early-abort path should clean up old metadata
    expect(engine.getRetryCount(key)).toBe(0);
    expect(engine.getMetadata(key)).toBeUndefined();
  });

  it('should retain metadata for normal retry lifecycle (abort not involved)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new TypeError('fail')).mockResolvedValue('ok');

    const resultPromise = engine.execute(fn, defaultConfig, key);
    // After first failure, metadata exists with count 1
    await vi.advanceTimersByTimeAsync(10);
    expect(engine.getRetryCount(key)).toBe(1);

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(true);

    // On success, resetCount deletes metadata
    expect(engine.getRetryCount(key)).toBe(0);
    expect(engine.getMetadata(key)).toBeUndefined();
  });

  it('should retain metadata on exhausted retries (abort not involved)', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('fail'));

    const resultPromise = engine.execute(fn, defaultConfig, key);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(4);

    // Exhausted path deletes metadata
    expect(engine.getRetryCount(key)).toBe(0);
    expect(engine.getMetadata(key)).toBeUndefined();
  });
});
