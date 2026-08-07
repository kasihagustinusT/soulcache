import { describe, it, expect, vi } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryConfig, RetryEvent, ErrorClass } from '../../src/retry/types';
import { QueryEngine } from '../../src/query/query-engine';

/**
 * Stage 05 adversarial suite — ABORT-1 (BUG_1_5 / PR-E).
 *
 * Regression guard for the defect where a browser/jsdom DOMException AbortError
 * (not `instanceof Error`) is wrapped by `new Error(String(raw))`, destroying
 * its `name`. Name-based classification (error-classifier.ts) then reports
 * 'unknown' which is retryable by default, so cancelled queries get retried and
 * `result.error.name === 'AbortError'` detection breaks downstream.
 *
 * Must pass in BOTH the node (CI default) and jsdom (browser) environments.
 */
const cfg: RetryConfig = {
  maxRetries: 1,
  baseDelay: 1,
  maxDelay: 10,
  backoff: 'linear',
  jitter: false,
};

describe('ABORT-1: abort identity is preserved through execute()', () => {
  let engine: RetryEngine;

  beforeEach(() => {
    engine = new RetryEngine();
  });

  it('DOMException AbortError rejection is not retried and keeps its name', async () => {
    const fn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const result = await engine.execute(fn, cfg, ['abort1']);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(result.error?.name).toBe('AbortError');
  });

  it('DOMException TimeoutError rejection is still retried but keeps its name', async () => {
    const fn = vi.fn().mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));

    const result = await engine.execute(fn, cfg, ['abort1-timeout']);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(2);
    expect(result.error?.name).toBe('TimeoutError');
  });

  it('emits attempt + exhausted (never delay) for an abort, with errorClass abort', async () => {
    const events: Array<{ type: string; errorClass: ErrorClass }> = [];
    engine.on('retry:attempt', (e) =>
      events.push({ type: e.type, errorClass: e.context.errorClass }),
    );
    engine.on('retry:delay', (e) =>
      events.push({ type: e.type, errorClass: e.context.errorClass }),
    );
    engine.on('retry:exhausted', (e) =>
      events.push({ type: e.type, errorClass: e.context.errorClass }),
    );

    const fn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    await engine.execute(fn, cfg, ['abort1-events']);

    expect(events.map((e) => e.type)).toEqual(['retry:attempt', 'retry:exhausted']);
    expect(events[0].errorClass).toBe('abort');
  });

  it('abort is never retried even when a custom retryOn would say yes', async () => {
    const fn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const result = await engine.execute(fn, { ...cfg, retryOn: () => true }, ['abort1-retryon']);

    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('treats an error-like plain object with name AbortError as abort', async () => {
    const fn = vi.fn().mockRejectedValue({ name: 'AbortError', message: 'aborted' });

    const result = await engine.execute(fn, cfg, ['abort1-obj']);

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.error?.name).toBe('AbortError');
  });

  it('treats an error-like plain object with name TimeoutError as retryable timeout', async () => {
    const fn = vi.fn().mockRejectedValue({ name: 'TimeoutError', message: 'timed out' });

    const result = await engine.execute(fn, cfg, ['abort1-obj-timeout']);

    expect(result.attempts).toBe(2);
    expect(result.error?.name).toBe('TimeoutError');
  });

  it('still retries plain string rejections as unknown (behavior preserved)', async () => {
    const fn = vi.fn().mockRejectedValue('boom');

    const result = await engine.execute(fn, { ...cfg, retryableErrors: ['unknown'] }, ['abort1-string']);

    expect(result.attempts).toBe(2);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.name).toBe('Error');
  });

  it('still retries nameless plain object rejections as unknown (behavior preserved)', async () => {
    const fn = vi.fn().mockRejectedValue({ code: 500 });

    const result = await engine.execute(fn, { ...cfg, retryableErrors: ['unknown'] }, ['abort1-nameless']);

    expect(result.attempts).toBe(2);
    expect(result.error).toBeInstanceOf(Error);
  });

  it('does not treat a name-only TypeError object as a network Error (no instanceof leak)', async () => {
    const fn = vi.fn().mockRejectedValue({ name: 'TypeError' });

    const result = await engine.execute(fn, { ...cfg, retryableErrors: ['unknown'] }, ['abort1-typeobj']);

    expect(result.attempts).toBe(2);
  });

  it('still retries real TypeError (instanceof Error) rejections as network', async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const result = await engine.execute(fn, cfg, ['abort1-real-type']);

    expect(result.attempts).toBe(2);
    expect(result.error).toBeInstanceOf(TypeError);
  });

  it('is not retried when the signal is pre-aborted at entry (retry:cancelled path)', async () => {
    const controller = new AbortController();
    controller.abort();

    const events: string[] = [];
    engine.on('retry:cancelled', () => events.push('retry:cancelled'));
    const fn = vi.fn().mockResolvedValue('never');

    const result = await engine.execute(fn, cfg, ['abort1-pre'], controller.signal);

    expect(result.attempts).toBe(0);
    expect(result.error?.name).toBe('AbortError');
    expect(events).toEqual(['retry:cancelled']);
    expect(fn).not.toHaveBeenCalled();
  });

  it('still emits retry:cancelled when abort fires during the retry delay', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

    const events: string[] = [];
    engine.on('retry:cancelled', () => events.push('retry:cancelled'));

    const slow: RetryConfig = { ...cfg, baseDelay: 50 };
    const promise = engine.execute(fn, slow, ['abort1-sleep'], controller.signal);
    setTimeout(() => controller.abort(), 1);

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('AbortError');
    expect(events).toEqual(['retry:cancelled']);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps metadata clean after an abort-exhausted sequence', async () => {
    const fn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    await engine.execute(fn, cfg, ['abort1-meta']);

    expect(engine.getMetadata(['abort1-meta'])).toBeUndefined();
    expect(engine.getRetryCount(['abort1-meta'])).toBe(0);
  });

  it('does not leak metadata across concurrent abort-failures on distinct keys', async () => {
    const fnA = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));
    const fnB = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const [ra, rb] = await Promise.all([
      engine.execute(fnA, cfg, ['k-a']),
      engine.execute(fnB, cfg, ['k-b']),
    ]);

    expect(ra.attempts).toBe(1);
    expect(rb.attempts).toBe(1);
    expect(engine.getRetryCount(['k-a'])).toBe(0);
    expect(engine.getRetryCount(['k-b'])).toBe(0);
  });

  it('survives a listener that throws while handling an abort attempt', async () => {
    engine.on('retry:attempt', () => {
      throw new Error('listener boom');
    });
    const fn = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const result = await engine.execute(fn, cfg, ['abort1-listen']);

    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('AbortError');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('ABORT-1: QueryEngine integration', () => {
  it('does not retry a query whose queryFn rejects with AbortError', async () => {
    const engine = new QueryEngine();
    try {
      const queryFn = vi.fn(async () => {
        throw new DOMException('Aborted', 'AbortError');
      });

      const promise = engine.executeQuery({
        queryKey: ['q-abort'],
        queryFn,
        retry: { maxRetries: 3, baseDelay: 1, jitter: false },
      });

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(engine.getMetrics().totalRetries).toBe(0);
    } finally {
      engine.destroy();
    }
  });

  it('cancelQuery aborts an in-flight query without a follow-up retry', async () => {
    const engine = new QueryEngine();
    try {
      const queryFn = vi.fn(
        (signal: AbortSignal) =>
          new Promise<never>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      );

      const promise = engine.executeQuery({
        queryKey: ['q-cancel'],
        queryFn,
        retry: { maxRetries: 3, baseDelay: 1, jitter: false },
      });

      engine.cancelQuery(['q-cancel']);

      await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
      expect(queryFn).toHaveBeenCalledTimes(1);
      expect(engine.getMetrics().totalCancellations).toBe(1);
    } finally {
      engine.destroy();
    }
  });
});
