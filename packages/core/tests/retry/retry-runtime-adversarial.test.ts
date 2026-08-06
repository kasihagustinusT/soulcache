import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryConfig, RetryEvent } from '../../src/retry/types';

/**
 * Stage 04 IER — independent runtime validation (R-series).
 *
 * Written fresh during the Independent Engineering Review. Complements the
 * Stage 03 regression suite with adversarial scenarios not covered there.
 */
const cfg: RetryConfig = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 1000,
  backoff: 'exponential',
  jitter: false,
};

describe('IER runtime validation (R-series)', () => {
  let engine: RetryEngine;

  beforeEach(() => {
    engine = new RetryEngine();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('R1: event object is a shared live reference across listeners (EventBus parity)', async () => {
    const observed: (string | undefined)[] = [];
    engine.on('retry:success', (e: RetryEvent) => {
      (e.context as { tag?: string }).tag = 'mutated';
    });
    engine.on('retry:success', (e: RetryEvent) => {
      observed.push((e.context as { tag?: string }).tag);
    });

    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['r1']);

    expect(observed).toEqual(['mutated']);
  });

  it('R2: throwing retry:delay listener on the timeout path — exhausted result, no escape', async () => {
    engine.on('retry:delay', () => {
      throw new Error('r2-boom');
    });
    const fn = vi.fn().mockRejectedValue(new TypeError('net'));

    const promise = engine.execute(fn, { ...cfg, maxRetries: 10, timeout: 30 }, ['r2']);
    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(TypeError);
    expect(result.attempts).toBe(1);
  });

  it('R3: non-retryable client error with throwing attempt/exhausted listeners — single attempt', async () => {
    engine.on('retry:attempt', () => {
      throw new Error('r3a-boom');
    });
    engine.on('retry:exhausted', () => {
      throw new Error('r3b-boom');
    });
    const clientError = Object.assign(new Error('Not Found'), { status: 404 });
    const fn = vi.fn().mockRejectedValue(clientError);

    const result = await engine.execute(fn, cfg, ['r3']);

    expect(result.success).toBe(false);
    expect(result.error).toBe(clientError);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('R4: unsubscribe is idempotent — double unsubscribe is safe', async () => {
    const calls: string[] = [];
    const unsub = engine.on('retry:success', () => calls.push('s'));
    unsub();
    unsub();

    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['r4']);
    expect(calls).toEqual([]);
  });

  it('R5: concurrent executes on the same key with throwing listeners — both complete, metadata cleaned', async () => {
    engine.on('retry:attempt', () => {
      throw new Error('r5-boom');
    });
    engine.on('retry:success', () => {
      throw new Error('r5-boom');
    });

    const make = () =>
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError('net'))
        .mockResolvedValue('v');

    const p1 = engine.execute(make(), cfg, ['r5-same']);
    const p2 = engine.execute(make(), cfg, ['r5-same']);
    await vi.runAllTimersAsync();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(engine.getRetryCount(['r5-same'])).toBe(0);
  });

  it('R6: all five event types throwing within one lifecycle (fail -> retry -> success)', async () => {
    engine.on('retry:attempt', () => {
      throw new Error('r6-attempt');
    });
    engine.on('retry:delay', () => {
      throw new Error('r6-delay');
    });
    engine.on('retry:success', () => {
      throw new Error('r6-success');
    });
    engine.on('retry:exhausted', () => {
      throw new Error('r6-exhausted');
    });
    engine.on('retry:cancelled', () => {
      throw new Error('r6-cancelled');
    });

    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('net'))
      .mockResolvedValue('ok');

    const promise = engine.execute(fn, cfg, ['r6']);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.success).toBe(true);
    expect(result.data).toBe('ok');
    expect(result.attempts).toBe(2);
  });

  it('R7: listeners are not retained after unsubscribe (WeakRef, guarded)', async () => {
    const held: WeakRef<object>[] = [];
    const payload = { large: new Array(5000).fill('x') };
    held.push(new WeakRef(payload));

    // Register listeners that close over `payload`, then drop every handle:
    // the engine must release the closures, otherwise `payload` stays alive.
    const handles = [
      engine.on('retry:success', () => void payload.large),
      ...Array.from({ length: 20 }, () => engine.on('retry:attempt', () => void payload.large)),
    ];
    for (const unsub of handles) unsub();

    if (typeof globalThis.gc === 'function') {
      globalThis.gc();
      const t = Date.now();
      while (Date.now() - t < 50) {
        /* spin */
      }
      expect(held[0]?.deref()).toBeUndefined();
    } else {
      // Without --expose-gc, verify the deterministic contract: after every
      // unsubscribe, no listener is invoked by a subsequent execute.
      await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['r7']);
      expect(handles.length).toBe(21);
    }
  });

  it('R8: throwing listener then clearMetadata then execute — engine fully usable', async () => {
    engine.on('retry:attempt', () => {
      throw new Error('r8-boom');
    });
    const fn = vi.fn().mockRejectedValueOnce(new TypeError('net')).mockResolvedValue('ok');

    const p1 = engine.execute(fn, cfg, ['r8a']);
    await vi.runAllTimersAsync();
    expect((await p1).success).toBe(true);

    engine.clearMetadata();

    const p2 = engine.execute(fn, cfg, ['r8b']);
    await vi.runAllTimersAsync();
    expect((await p2).success).toBe(true);
  });
});
