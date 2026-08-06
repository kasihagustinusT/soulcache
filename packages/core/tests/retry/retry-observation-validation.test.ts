import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryConfig, RetryEvent } from '../../src/retry/types';

/**
 * Stage 05 — Observation Validation (O-series).
 *
 * Fresh, independent probes regenerated during Final Certification to
 * re-validate Stage 04 observations F1/F2/F4/F5 against the live tree.
 */
const cfg: RetryConfig = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 1000,
  backoff: 'exponential',
  jitter: false,
};

describe('Observation validation (O-series)', () => {
  let engine: RetryEngine;

  beforeEach(() => {
    engine = new RetryEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('O1 (F1): an async listener rejection never flows into execute() — orphaned, not awaited', async () => {
    const listener = vi.fn().mockReturnValue(Promise.reject(new Error('async-boom')));
    engine.on('retry:success', listener);

    const result = await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['o1']);

    // The rejection is NOT awaited by emit(): execute() resolves successfully
    // and the op try/catch never saw the listener rejection.
    expect(result.success).toBe(true);
    expect(result.data).toBe('ok');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('O2 (F2): shouldRetry is false at retryCount >= maxRetries for every config family', () => {
    const error = new TypeError('net');

    const cases: Array<[string, RetryConfig]> = [
      ['default', cfg],
      ['retryOn', { ...cfg, retryOn: () => true }],
      ['retryableErrors', { ...cfg, retryableErrors: ['network'] }],
      ['nonRetryableErrors', { ...cfg, nonRetryableErrors: ['network'] }],
      ['zero', { ...cfg, maxRetries: 0 }],
    ];

    for (const [name, config] of cases) {
      expect(engine.shouldRetry(error, config.maxRetries, config), name).toBe(false);
      expect(engine.shouldRetry(error, config.maxRetries + 1, config), name).toBe(false);
    }

    // The exhausted branch therefore always fires before the loop can reach
    // the trailing fall-through return (retry-engine.ts:335-342).
  });

  it('O3 (F3): resetCount removes metadata entirely — abortRequested write is dead', () => {
    engine.execute(vi.fn().mockRejectedValue(new TypeError('net')), cfg, ['o3']);

    // incrementAttempt records metadata for the key
    engine.resetCount(['o3']);
    expect(engine.getMetadata(['o3'])).toBeUndefined();
    expect(engine.getRetryCount(['o3'])).toBe(0);
  });

  it('O4 (F4): retry:success event ships a synthetic Error("success") with errorClass "unknown"', async () => {
    let captured: RetryEvent | undefined;
    engine.on('retry:success', (e: RetryEvent) => {
      captured = e;
    });

    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['o4']);

    expect(captured).toBeDefined();
    expect(captured!.context.error).toBeInstanceOf(Error);
    expect(captured!.context.error!.message).toBe('success');
    expect(captured!.context.errorClass).toBe('unknown');
  });

  it('O5 (F5): timeout does NOT abort an in-flight fn() — it only gates between attempts', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 60));
      return 'late';
    });

    const promise = engine.execute(fn, { ...cfg, maxRetries: 0, timeout: 30 }, ['o5']);
    await vi.runAllTimersAsync();
    const result = await promise;

    // fn completed at 60ms > timeout 30ms; the operation still succeeds —
    // proving timeout never aborted the in-flight operation.
    expect(result.success).toBe(true);
    expect(result.data).toBe('late');
    expect(result.elapsed).toBeGreaterThanOrEqual(60);
  });
});
