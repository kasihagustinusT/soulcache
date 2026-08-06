import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryConfig, RetryEvent } from '../../src/retry/types';

/**
 * RetryEngine listener isolation regression suite (BUG-2).
 *
 * BUG-2: `RetryEngine.emit()` invoked each listener without isolation. A
 * throwing listener could:
 *  - corrupt `execute()` results — `retry:success` is emitted INSIDE the
 *    operation `try`, so a throwing `retry:success` listener was caught as if
 *    the operation had failed (success re-classified as failure and possibly
 *    retried);
 *  - escape `execute()` — every other emit site (`retry:attempt`,
 *    `retry:delay`, `retry:exhausted`, `retry:cancelled`) sits outside any
 *    guard, so a throwing listener rejected the `execute()` promise.
 *
 * The fix isolates each listener invocation in `emit()` (mirrors the `EventBus`
 * per-handler isolation), so a listener exception can never change the retry
 * outcome nor escape `execute()`.
 *
 * NOTE on async listeners: listeners are typed `(event) => void` (synchronous)
 * and are invoked synchronously in FIFO order. A synchronously throwing listener
 * is isolated. An `async` listener that REJECTS (rather than throwing
 * synchronously) is NOT isolated — its rejected promise is orphaned (unhandled
 * rejection), exactly as with `EventBus` handlers. Retry state/result are
 * unaffected either way.
 */
describe('RetryEngine listener isolation (BUG-2)', () => {
  let engine: RetryEngine;

  const baseConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 100,
    maxDelay: 1000,
    backoff: 'exponential',
    jitter: false,
  };

  beforeEach(() => {
    engine = new RetryEngine();
  });

  describe('listener exceptions must never corrupt execute()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('A1: throwing retry:success listener — success stays success, no retry', async () => {
      engine.on('retry:success', () => {
        throw new Error('success-listener-boom');
      });
      const fn = vi.fn().mockResolvedValue('data');

      const result = await engine.execute(fn, baseConfig, ['a1']);

      expect(result.success).toBe(true);
      expect(result.data).toBe('data');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('A2: throwing retry:attempt listener — execute() completes, op still retries', async () => {
      engine.on('retry:attempt', () => {
        throw new Error('attempt-listener-boom');
      });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValue('ok');

      const promise = engine.execute(fn, baseConfig, ['a2']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('ok');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('A3: throwing retry:delay listener — execute() completes and succeeds', async () => {
      engine.on('retry:delay', () => {
        throw new Error('delay-listener-boom');
      });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValue('ok');

      const promise = engine.execute(fn, baseConfig, ['a3']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('ok');
    });

    it('A4: throwing retry:exhausted listener — exhausted result returned, no escape', async () => {
      engine.on('retry:exhausted', () => {
        throw new Error('exhausted-listener-boom');
      });
      const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

      const promise = engine.execute(fn, baseConfig, ['a4']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TypeError);
      expect(result.attempts).toBe(4);
    });

    it('A5: throwing retry:cancelled listener (abort during delay) — cancelled result returned', async () => {
      engine.on('retry:cancelled', () => {
        throw new Error('cancelled-listener-boom');
      });
      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

      const promise = engine.execute(
        fn,
        { ...baseConfig, maxRetries: 10 },
        ['a5'],
        controller.signal,
      );
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('AbortError');
    });

    it('A6: throwing retry:cancelled listener (abort before start) — cancelled result returned', async () => {
      engine.on('retry:cancelled', () => {
        throw new Error('cancelled-listener-boom');
      });
      const controller = new AbortController();
      controller.abort();
      const fn = vi.fn().mockResolvedValue('never');

      const result = await engine.execute(fn, baseConfig, ['a6'], controller.signal);

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('AbortError');
      expect(result.attempts).toBe(0);
      expect(fn).not.toHaveBeenCalled();
    });

    it('A15: throwing retry:exhausted listener (timeout path) — exhausted result returned, no escape', async () => {
      engine.on('retry:exhausted', () => {
        throw new Error('timeout-exhausted-listener-boom');
      });
      const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
      const config = { ...baseConfig, maxRetries: 10, timeout: 50 };

      const promise = engine.execute(fn, config, ['a15']);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(TypeError);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('multi-listener dispatch', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('A7: one throwing listener does not stop later listeners for the same event', async () => {
      const calls: string[] = [];
      engine.on('retry:success', () => {
        throw new Error('boom');
      });
      engine.on('retry:success', () => calls.push('second'));

      await engine.execute(vi.fn().mockResolvedValue('ok'), baseConfig, ['a7']);

      expect(calls).toEqual(['second']);
    });

    it('A8: listener unsubscribing itself mid-emit — remaining listeners still fire', async () => {
      const calls: string[] = [];
      const self = { unsub: undefined as (() => void) | undefined };
      engine.on('retry:success', () => {
        throw new Error('boom');
      });
      self.unsub = engine.on('retry:success', () => {
        calls.push('second');
        self.unsub?.();
      });
      engine.on('retry:success', () => calls.push('third'));

      await engine.execute(vi.fn().mockResolvedValue('ok'), baseConfig, ['a8']);

      expect(calls).toEqual(['second', 'third']);
    });

    it('A9: throwing listeners on one event type do not affect other event types', async () => {
      const calls: string[] = [];
      engine.on('retry:attempt', () => {
        throw new Error('boom');
      });
      engine.on('retry:success', () => calls.push('success'));
      engine.on('retry:delay', () => calls.push('delay'));

      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      const promise = engine.execute(fn, baseConfig, ['a9']);
      await vi.runAllTimersAsync();
      await promise;

      expect(calls).toEqual(['delay', 'success']);
    });

    it('A16: listener added during emit is visited at the end of the same pass (live Set semantics, EventBus parity)', async () => {
      const calls: string[] = [];
      const added = { unsub: undefined as (() => void) | undefined };
      engine.on('retry:success', () => {
        calls.push('first');
        added.unsub = engine.on('retry:success', () => calls.push('added'));
      });
      engine.on('retry:success', () => calls.push('third'));

      await engine.execute(vi.fn().mockResolvedValue('ok'), baseConfig, ['a16']);

      // Set-backed dispatch iterates the live set: an entry added during the
      // current pass is appended and still visited this pass (after the entries
      // present at pass start). Identical to the EventBus handler sets.
      expect(calls).toEqual(['first', 'third', 'added']);
      added.unsub?.();
    });

    it('A17: listener throwing a non-Error value is isolated', async () => {
      engine.on('retry:success', () => {
        throw 'boom-string';
      });
      const fn = vi.fn().mockResolvedValue('ok');

      const result = await engine.execute(fn, baseConfig, ['a17']);

      expect(result.success).toBe(true);
      expect(result.data).toBe('ok');
    });
  });

  describe('nested emit / recursion', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('A10: listener that triggers a nested execute() — both complete, bounded', async () => {
      const nestedResults: boolean[] = [];
      engine.on('retry:success', () => {
        if (nestedResults.length === 0) {
          nestedResults.push(
            engine.execute(
              vi.fn().mockResolvedValue('inner'),
              baseConfig,
              ['a10-inner'],
            ).then((r) => r.success),
          );
        }
      });

      const result = await engine.execute(
        vi.fn().mockResolvedValue('outer'),
        baseConfig,
        ['a10-outer'],
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('outer');
      await expect(Promise.all(nestedResults)).resolves.toEqual([true]);
    });

    it('A11: listener retries same key recursively — still bounded and correct', async () => {
      let depth = 0;
      let maxDepth = 0;
      engine.on('retry:success', () => {
        depth++;
        maxDepth = Math.max(maxDepth, depth);
        engine.execute(
          vi.fn().mockResolvedValue('nested'),
          baseConfig,
          ['a11'],
        ).then((r) => {
          expect(r.success).toBe(true);
        });
        depth--;
      });

      const result = await engine.execute(
        vi.fn().mockResolvedValue('root'),
        baseConfig,
        ['a11'],
      );

      expect(result.success).toBe(true);
      expect(maxDepth).toBe(1);
    });
  });

  describe('retry lifecycle interaction', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('A12: retry recovery — throwing attempt listener, later attempt succeeds', async () => {
      engine.on('retry:attempt', () => {
        throw new Error('boom');
      });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValue('recovered');

      const promise = engine.execute(fn, baseConfig, ['a12']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('recovered');
      expect(result.attempts).toBe(3);
    });

    it('A13: cancellation — abort during delay with throwing listeners, cancelled result', async () => {
      engine.on('retry:attempt', () => {
        throw new Error('boom');
      });
      engine.on('retry:delay', () => {
        throw new Error('boom');
      });
      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue(new TypeError('fetch failed'));

      const promise = engine.execute(
        fn,
        { ...baseConfig, maxRetries: 10 },
        ['a13'],
        controller.signal,
      );
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      await vi.advanceTimersByTimeAsync(200);
      const result = await promise;

      expect(result.success).toBe(false);
      expect(result.error?.name).toBe('AbortError');
    });

    it('A14: parallel retries — throwing listeners do not cross-talk between keys', async () => {
      engine.on('retry:attempt', () => {
        throw new Error('boom');
      });
      engine.on('retry:success', () => {
        throw new Error('boom');
      });

      const fns = Array.from({ length: 10 }, (_, i) =>
        vi
          .fn()
          .mockRejectedValueOnce(new TypeError('fail'))
          .mockResolvedValue(`ok-${i}`),
      );

      const promises = fns.map((fn, i) => engine.execute(fn, baseConfig, [`a14-${i}`]));
      await vi.runAllTimersAsync();
      const results = await Promise.all(promises);

      for (let i = 0; i < results.length; i++) {
        expect(results[i].success).toBe(true);
        expect(results[i].data).toBe(`ok-${i}`);
        expect(results[i].attempts).toBe(2);
      }
    });
  });

  describe('event correctness and ordering', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('B1: events carry correct type/key/context and arrive in order', async () => {
      const events: string[] = [];
      const seenKeys = new Set<string>();
      engine.on('retry:attempt', (e: RetryEvent) => {
        events.push('attempt');
        seenKeys.add(JSON.stringify(e.key));
        expect(e.context.error).toBeInstanceOf(TypeError);
        expect(e.context.attempt).toBe(0);
      });
      engine.on('retry:delay', (e: RetryEvent) => {
        events.push('delay');
        expect(e.context.delay).toBeGreaterThan(0);
      });
      engine.on('retry:success', (e: RetryEvent) => {
        events.push('success');
        expect(e.type).toBe('retry:success');
      });

      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      const promise = engine.execute(fn, baseConfig, ['b1']);
      await vi.runAllTimersAsync();
      await promise;

      expect(events).toEqual(['attempt', 'delay', 'success']);
      expect(seenKeys.has(JSON.stringify(['b1']))).toBe(true);
    });

    it('B2: no listeners — execute() behavior unchanged (control)', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      const promise = engine.execute(fn, baseConfig, ['b2']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
      expect(engine.getRetryCount(['b2'])).toBe(0);
    });

    it('B3: unsubscribe — listener no longer invoked and no cross-key delivery', async () => {
      const calls: string[] = [];
      const unsub = engine.on('retry:success', () => calls.push('success'));

      await engine.execute(vi.fn().mockResolvedValue('ok'), baseConfig, ['b3']);
      expect(calls).toEqual(['success']);

      unsub();
      await engine.execute(vi.fn().mockResolvedValue('ok'), baseConfig, ['b3-2']);
      expect(calls).toEqual(['success']);
    });
  });

  describe('cleanup and memory', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it('B4: metadata cleaned after success/exhaust/cancel with throwing listeners', async () => {
      engine.on('retry:attempt', () => {
        throw new Error('boom');
      });
      engine.on('retry:success', () => {
        throw new Error('boom');
      });

      await engine.execute(vi.fn().mockResolvedValue('ok'), baseConfig, ['b4-succ']);
      expect(engine.getRetryCount(['b4-succ'])).toBe(0);

      const failPromise = engine.execute(
        vi.fn().mockRejectedValue(new TypeError('fail')),
        baseConfig,
        ['b4-fail'],
      );
      await vi.runAllTimersAsync();
      await failPromise;
      expect(engine.getRetryCount(['b4-fail'])).toBe(0);

      const controller = new AbortController();
      const cancelPromise = engine.execute(
        vi.fn().mockRejectedValue(new TypeError('fail')),
        { ...baseConfig, maxRetries: 10 },
        ['b4-cancel'],
        controller.signal,
      );
      await vi.advanceTimersByTimeAsync(10);
      controller.abort();
      await vi.advanceTimersByTimeAsync(200);
      await cancelPromise;
      expect(engine.getRetryCount(['b4-cancel'])).toBe(0);
    });

    it('B5: clearMetadata with active throwing listeners — engine still usable', async () => {
      engine.on('retry:attempt', () => {
        throw new Error('boom');
      });
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValue('ok');

      engine.clearMetadata();
      const promise = engine.execute(fn, baseConfig, ['b5']);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(2);
    });
  });

  describe('integration: QueryEngine/QueryClient path', () => {
    it('C1: QueryEngine.executeQuery retry path (no listeners attached) — unchanged, unaffected', async () => {
      const { QueryEngine } = await import('../../src/query/query-engine');

      const queryEngine = new QueryEngine();
      try {
        let attempts = 0;
        const data = await queryEngine.executeQuery({
          queryKey: ['users'],
          queryFn: async () => {
            attempts++;
            if (attempts < 2) throw new TypeError('fetch failed');
            return 'users';
          },
          retry: { maxRetries: 2, baseDelay: 1, maxDelay: 5 },
        });

        expect(data).toBe('users');
        expect(attempts).toBe(2);
      } finally {
        if (!queryEngine.isDestroyed) {
          queryEngine.destroy();
        }
      }
    });
  });
});
