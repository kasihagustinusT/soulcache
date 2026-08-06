import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryConfig, RetryEvent } from '../../src/retry/types';

/**
 * Stage 05 — Final Adversarial Analysis (A-series).
 *
 * Additional adversarial scenarios beyond Stages 04, regenerated during Final
 * Certification (listener ordering, self-unsubscribe, mid-delay cancellation,
 * determinism, multiple-type listeners, untested type paths).
 */
const cfg: RetryConfig = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 1000,
  backoff: 'exponential',
  jitter: false,
};

describe('Final adversarial analysis (A-series)', () => {
  let engine: RetryEngine;

  beforeEach(() => {
    engine = new RetryEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('A1: listener dispatch preserves insertion order', async () => {
    const order: string[] = [];
    engine.on('retry:success', () => order.push('l1'));
    engine.on('retry:success', () => order.push('l2'));
    engine.on('retry:success', () => order.push('l3'));

    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['a1']);
    expect(order).toEqual(['l1', 'l2', 'l3']);
  });

  it('A2: a listener that unsubscribes itself mid-emit — it fires this pass, is skipped on later emits; remaining listeners still fire', async () => {
    const calls: string[] = [];
    const self: { unsub: () => void } = { unsub: () => {} };
    engine.on('retry:success', () => calls.push('after'));
    self.unsub = engine.on('retry:success', () => {
      calls.push('self');
      self.unsub();
    });

    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['a2']);
    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['a2']);

    expect(calls).toEqual(['after', 'self', 'after']);
  });

  it('A3: mid-delay abort with a throwing retry:cancelled listener — aborted result, no escape', async () => {
    engine.on('retry:cancelled', () => {
      throw new Error('a3-boom');
    });
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new TypeError('net'));

    const promise = engine.execute(fn, cfg, ['a3'], controller.signal);
    controller.abort();
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(DOMException);
    expect((result.error as DOMException).name).toBe('AbortError');
  });

  it('A4: emits for types with no registered listeners are no-ops', async () => {
    // register only for success; attempt/delay/exhausted/cancelled have no listeners
    const attempts: string[] = [];
    engine.on('retry:attempt', () => attempts.push('a'));

    const fn = vi.fn().mockRejectedValueOnce(new TypeError('net')).mockResolvedValue('ok');
    const promise = engine.execute(fn, cfg, ['a4']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(attempts).toEqual(['a']);
  });

  it('A5: a single listener registered on multiple types receives each matching event', async () => {
    const seen: string[] = [];
    const listener = (e: RetryEvent) => seen.push(e.type);
    engine.on('retry:attempt', listener);
    engine.on('retry:delay', listener);
    engine.on('retry:success', listener);

    const fn = vi.fn().mockRejectedValueOnce(new TypeError('net')).mockResolvedValue('ok');
    const promise = engine.execute(fn, cfg, ['a5']);
    await vi.runAllTimersAsync();
    await promise;

    expect(seen.filter((t) => t === 'retry:attempt')).toHaveLength(1);
    expect(seen.filter((t) => t === 'retry:delay')).toHaveLength(1);
    expect(seen.filter((t) => t === 'retry:success')).toHaveLength(1);
  });

  it('A6: deterministic outcomes — identical runs produce identical results', async () => {
    const makeFn = () =>
      vi.fn().mockRejectedValueOnce(new TypeError('net')).mockResolvedValue('v');

    const p1 = engine.execute(makeFn(), cfg, ['a6a']);
    await vi.runAllTimersAsync();
    const r1 = await p1;

    const p2 = engine.execute(makeFn(), cfg, ['a6b']);
    await vi.runAllTimersAsync();
    const r2 = await p2;

    expect(r1).toEqual(r2);
    expect(r1).toEqual({ success: true, data: 'v', attempts: 2, elapsed: expect.any(Number) });
  });

  it('A7: exhaustion with throwing attempt/delay/exhausted listeners — original error preserved, attempts exact', async () => {
    engine.on('retry:attempt', () => {
      throw new Error('a7-attempt');
    });
    engine.on('retry:delay', () => {
      throw new Error('a7-delay');
    });
    engine.on('retry:exhausted', () => {
      throw new Error('a7-exhausted');
    });

    const net = new TypeError('net');
    const fn = vi.fn().mockRejectedValue(net);

    const promise = engine.execute(fn, cfg, ['a7']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBe(net);
    expect(result.attempts).toBe(4);
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
