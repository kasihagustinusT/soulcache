import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryEngine } from '../../src/query/query-engine';

describe('executeQuery finally orphanes concurrent controller', () => {
  let engine: QueryEngine;

  beforeEach(() => {
    engine = new QueryEngine();
  });

  afterEach(() => {
    if (!engine.isDestroyed) {
      engine.destroy();
    }
  });

  function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void } {
    let resolve!: (v: T) => void;
    const promise = new Promise<T>((res) => {
      resolve = res;
    });
    return { promise, resolve };
  }

  it('second in-flight fetch not orphaned when first finally fires after abort', async () => {
    const p1Def = deferred<string>();
    const p2Def = deferred<string>();

    // p1 starts, C1 registered, queryFn awaits p1Def
    const p1 = engine.executeQuery({
      queryKey: ['t2', 'key'],
      queryFn: async (signal) => {
        await p1Def.promise;
        if (signal.aborted) throw new Error('aborted');
        return 'first-data';
      },
      retry: { maxRetries: 0 },
    });

    // p2 starts: cancels p1 (aborts C1), C2 registered, queryFn awaits p2Def
    const p2 = engine.executeQuery({
      queryKey: ['t2', 'key'],
      queryFn: async (signal) => {
        await p2Def.promise;
        return 'second-data';
      },
      retry: { maxRetries: 0 },
    });

    // Resolve p1 — fn1 completes, sees aborted signal, throws
    // p1's executeQuery finally fires
    // Without fix: _abortControllers.delete(key) orphans C2
    // With fix: identity check skips delete since C2 !== C1
    p1Def.resolve('first');
    await p1.catch(() => {});

    // p2 should still be in-flight and complete normally
    p2Def.resolve('second');
    const result = await p2;
    expect(result).toBe('second-data');
  });

  it('cancelQuery works on second fetch after first finally fires', async () => {
    const p1Def = deferred<string>();
    const p2Def = deferred<string>();

    const p1 = engine.executeQuery({
      queryKey: ['t2', 'cancel'],
      queryFn: async (signal) => {
        await p1Def.promise;
        if (signal.aborted) throw new Error('aborted');
        return 'first-data';
      },
      retry: { maxRetries: 0 },
    });

    const p2 = engine.executeQuery({
      queryKey: ['t2', 'cancel'],
      queryFn: async (signal) => {
        await p2Def.promise;
        if (signal.aborted) throw new Error('cancelled');
        return 'second-data';
      },
      retry: { maxRetries: 0 },
    });

    // Let p1 finish (aborted) — finally fires
    p1Def.resolve('first');
    await p1.catch(() => {});

    // Cancel p2 — with fix, C2 is still in _abortControllers and gets aborted
    engine.cancelQuery(['t2', 'cancel']);

    // p2's fn checks signal after p2Def resolves — should be aborted
    p2Def.resolve('second');
    await expect(p2).rejects.toThrow('cancelled');
  });

  it('normal single fetch still cleans up controller', async () => {
    const result = await engine.executeQuery({
      queryKey: ['t2', 'normal'],
      queryFn: async (_signal) => ({ ok: true }),
    });
    expect(result).toEqual({ ok: true });
  });
});
