import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryEngine } from '../query-engine';

describe('QueryEngine', () => {
  let engine: QueryEngine;

  beforeEach(() => {
    engine = new QueryEngine();
  });

  afterEach(() => {
    if (!engine.isDestroyed) {
      engine.destroy();
    }
  });

  describe('executeQuery', () => {
    it('should execute query and return data', async () => {
      const data = await engine.executeQuery({
        queryKey: ['users'],
        queryFn: async () => ({ name: 'Alice' }),
      });

      expect(data).toEqual({ name: 'Alice' });
    });

    it('should cache results within staleTime', async () => {
      const queryFn = vi.fn(async () => ({ name: 'Alice' }));

      await engine.executeQuery({
        queryKey: ['users'],
        queryFn,
      });

      const data = await engine.executeQuery({
        queryKey: ['users'],
        queryFn,
        staleTime: 1000,
      });

      expect(data).toEqual({ name: 'Alice' });
      expect(queryFn).toHaveBeenCalledTimes(1);
    });

    it('should re-execute when staleTime expires', async () => {
      const queryFn = vi.fn(async () => ({ name: 'Alice' }));

      await engine.executeQuery({
        queryKey: ['users'],
        queryFn,
        staleTime: 50,
      });

      await new Promise((r) => setTimeout(r, 60));

      await engine.executeQuery({
        queryKey: ['users'],
        queryFn,
        staleTime: 50,
      });

      expect(queryFn).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure', async () => {
      let attempts = 0;
      const data = await engine.executeQuery({
        queryKey: ['users'],
        queryFn: async () => {
          attempts++;
          if (attempts < 3) throw new Error('Network error');
          return { name: 'Alice' };
        },
        retry: { maxRetries: 3, baseDelay: 1, maxDelay: 5 },
      });

      expect(data).toEqual({ name: 'Alice' });
      expect(attempts).toBe(3);
    });
  });

  describe('cancelQuery', () => {
    it('should cancel active queries', async () => {
      let rejectFn: ((err: Error) => void) | undefined;
      const promise = engine.executeQuery({
        queryKey: ['users'],
        queryFn: (_signal) =>
          new Promise<never>((_resolve, reject) => {
            rejectFn = reject;
          }),
      });

      engine.cancelQuery(['users']);

      rejectFn?.(new Error('Cancelled'));

      await expect(promise).rejects.toThrow();
    });

    it('should not throw when cancelling non-existent query', () => {
      engine.cancelQuery(['nonexistent']);
    });
  });

  describe('setQueryData / getQueryData', () => {
    it('should set and get data', () => {
      engine.setQueryData(['users'], { name: 'Alice' });
      expect(engine.getQueryData(['users'])).toEqual({ name: 'Alice' });
    });

    it('should update with function', () => {
      engine.setQueryData<{ count: number }>(['counter'], { count: 0 });
      engine.setQueryData<{ count: number }>(['counter'], (prev) => ({
        count: (prev?.count ?? 0) + 1,
      }));
      expect(engine.getQueryData(['counter'])).toEqual({ count: 1 });
    });

    it('should return undefined for non-existent keys', () => {
      expect(engine.getQueryData(['nonexistent'])).toBeUndefined();
    });
  });

  describe('invalidateQueries', () => {
    it('should invalidate queries', async () => {
      engine.setQueryData(['users'], { name: 'Alice' });
      await engine.invalidateQueries(['users']);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to changes', () => {
      const callback = vi.fn();
      const unsub = engine.subscribe(['users'], callback);

      engine.setQueryData(['users'], { name: 'Alice' });

      expect(callback).toHaveBeenCalled();

      unsub();
    });
  });

  describe('metrics', () => {
    it('should track metrics', async () => {
      await engine.executeQuery({
        queryKey: ['users'],
        queryFn: async () => ({ name: 'Alice' }),
      });

      await engine.executeQuery({
        queryKey: ['users'],
        queryFn: async () => ({ name: 'Alice' }),
        staleTime: 1000,
      });

      const metrics = engine.getMetrics();
      expect(metrics.totalExecuted).toBeGreaterThanOrEqual(1);
      expect(metrics.cacheHits).toBeGreaterThanOrEqual(1);
    });

    it('should track cache misses', async () => {
      await engine.executeQuery({
        queryKey: ['users'],
        queryFn: async () => ({ name: 'Alice' }),
      });

      const metrics = engine.getMetrics();
      expect(metrics.cacheMisses).toBe(1);
    });

    it('should track retries', async () => {
      let attempts = 0;
      await engine.executeQuery({
        queryKey: ['users'],
        queryFn: async () => {
          attempts++;
          if (attempts < 2) throw new Error('Network error');
          return { name: 'Alice' };
        },
        retry: { maxRetries: 3, baseDelay: 1, maxDelay: 5 },
      });

      const metrics = engine.getMetrics();
      expect(metrics.totalRetries).toBeGreaterThanOrEqual(1);
    });

    it('should track cancellations', async () => {
      let rejectFn: ((err: Error) => void) | undefined;
      const promise = engine.executeQuery({
        queryKey: ['users'],
        queryFn: (_signal) =>
          new Promise<never>((_resolve, reject) => {
            rejectFn = reject;
          }),
      });

      engine.cancelQuery(['users']);
      rejectFn?.(new Error('Cancelled'));
      await promise.catch(() => {});

      const metrics = engine.getMetrics();
      expect(metrics.totalCancellations).toBe(1);
    });
  });

  describe('destroy', () => {
    it('should destroy engine', () => {
      engine.destroy();
      expect(engine.isDestroyed).toBe(true);
    });

    it('should throw on operations after destroy', async () => {
      engine.destroy();

      await expect(
        engine.executeQuery({
          queryKey: ['users'],
          queryFn: async () => ({ name: 'Alice' }),
        }),
      ).rejects.toThrow('QueryEngine has been destroyed');
    });

    it('should be idempotent', () => {
      engine.destroy();
      engine.destroy();
    });
  });

  describe('background refetch', () => {
    it('should schedule background refetch', async () => {
      vi.useFakeTimers();

      const queryEngine = new QueryEngine({ refetchInterval: 1000 });
      const queryFn = vi.fn(async () => ({ name: 'Alice' }));

      await queryEngine.executeQuery({
        queryKey: ['users'],
        queryFn,
      });

      expect(queryFn).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1100);

      expect(queryFn).toHaveBeenCalledTimes(2);

      queryEngine.destroy();
      vi.useRealTimers();
    });
  });
});
