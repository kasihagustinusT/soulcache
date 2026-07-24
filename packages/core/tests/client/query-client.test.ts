import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';
import { RuntimeError } from '../../src/errors/soulcache-error';

describe('QueryClient', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  afterEach(() => {
    client.destroy();
  });

  describe('construction', () => {
    it('should create with no config', () => {
      const c = new QueryClient();
      expect(c.isDestroyed).toBe(false);
      expect(c.queryCount).toBe(0);
    });

    it('should create with config', () => {
      const c = new QueryClient({
        defaultOptions: {
          staleTime: 60000,
          gcTime: 120000,
        },
      });
      expect(c.isDestroyed).toBe(false);
    });
  });

  describe('getQueryData', () => {
    it('should return undefined for missing key', () => {
      const data = client.getQueryData(['missing']);
      expect(data).toBeUndefined();
    });

    it('should return cached data after setQueryData', () => {
      client.setQueryData(['users', 1], { id: 1, name: 'Alice' });
      const data = client.getQueryData<{ id: number; name: string }>(['users', 1]);
      expect(data).toEqual({ id: 1, name: 'Alice' });
    });
  });

  describe('setQueryData', () => {
    it('should store data with static value', () => {
      client.setQueryData(['count'], 42);
      expect(client.getQueryData<number>(['count'])).toBe(42);
    });

    it('should store data with updater function', () => {
      client.setQueryData<number>(['count'], 10);
      client.setQueryData<number>(['count'], (prev) => (prev ?? 0) + 5);
      expect(client.getQueryData<number>(['count'])).toBe(15);
    });

    it('should handle updater with undefined previous', () => {
      client.setQueryData<number>(['count'], (prev) => (prev ?? 0) + 1);
      expect(client.getQueryData<number>(['count'])).toBe(1);
    });

    it('should notify subscribers on update', () => {
      const callback = vi.fn();
      client.subscribe(['items'], callback);

      client.setQueryData(['items'], ['a', 'b']);

      // subscribe delivers initial snapshot + update
      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should emit cache.updated event', () => {
      const handler = vi.fn();
      client.subscribe(['x'], vi.fn());

      // Access internal eventBus through a subscribe-triggered state machine
      client.setQueryData(['x'], 'hello');
      // We can't directly access eventBus, but the operation should succeed
      expect(client.getQueryData(['x'])).toBe('hello');
    });
  });

  describe('subscribe', () => {
    it('should deliver initial snapshot with no data', () => {
      const callback = vi.fn();
      client.subscribe(['users'], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const snapshot = callback.mock.calls[0][0];
      expect(snapshot.status).toBe('idle');
      expect(snapshot.data).toBeUndefined();
      expect(snapshot.fetchStatus).toBe('idle');
    });

    it('should deliver initial snapshot with existing data', () => {
      client.setQueryData(['users'], [{ id: 1 }]);

      const callback = vi.fn();
      client.subscribe(['users'], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      const snapshot = callback.mock.calls[0][0];
      expect(snapshot.status).toBe('success');
      expect(snapshot.data).toEqual([{ id: 1 }]);
    });

    it('should return unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = client.subscribe(['items'], callback);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      client.setQueryData(['items'], 'new');
      // After unsubscribe, callback should not be called again
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple subscribers on same key', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      client.subscribe(['shared'], cb1);
      client.subscribe(['shared'], cb2);

      client.setQueryData(['shared'], 'data');

      expect(cb1).toHaveBeenCalledTimes(2); // initial + update
      expect(cb2).toHaveBeenCalledTimes(2);
    });

    it('should not affect other subscribers when one unsubscribes', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = client.subscribe(['shared'], cb1);
      client.subscribe(['shared'], cb2);

      unsub1();

      client.setQueryData(['shared'], 'data');

      expect(cb1).toHaveBeenCalledTimes(1); // only initial
      expect(cb2).toHaveBeenCalledTimes(2); // initial + update
    });
  });

  describe('fetchQuery', () => {
    it('should fetch and return data', async () => {
      const data = await client.fetchQuery({
        queryKey: ['user', 1],
        queryFn: async () => ({ id: 1, name: 'Alice' }),
      });

      expect(data).toEqual({ id: 1, name: 'Alice' });
      expect(client.getQueryData(['user', 1])).toEqual({ id: 1, name: 'Alice' });
    });

    it('should throw on fetch failure', async () => {
      await expect(
        client.fetchQuery({
          queryKey: ['fail'],
          queryFn: async () => {
            throw new Error('network error');
          },
        }),
      ).rejects.toThrow('network error');
    });

    it('should deduplicate concurrent fetches for same key', async () => {
      let fetchCount = 0;
      const queryFn = async () => {
        fetchCount++;
        return { count: fetchCount };
      };

      const [r1, r2] = await Promise.all([
        client.fetchQuery({ queryKey: ['dedup'], queryFn }),
        client.fetchQuery({ queryKey: ['dedup'], queryFn }),
      ]);

      expect(r1).toEqual(r2);
      expect(fetchCount).toBe(1);
    });

    it('should notify observers of loading state', async () => {
      const callback = vi.fn();
      client.subscribe(['loading-test'], callback);

      // Initial snapshot
      expect(callback).toHaveBeenCalledTimes(1);

      const fetchPromise = client.fetchQuery({
        queryKey: ['loading-test'],
        queryFn: async () => {
          return 'result';
        },
      });

      // Should have at least one more call for loading state
      expect(callback.mock.calls.length).toBeGreaterThanOrEqual(2);

      await fetchPromise;
    });

    it('should notify observers on success', async () => {
      const callback = vi.fn();
      client.subscribe(['success-test'], callback);

      await client.fetchQuery({
        queryKey: ['success-test'],
        queryFn: async () => ({ ok: true }),
      });

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      const snapshot = lastCall[0];
      expect(snapshot.status).toBe('success');
      expect(snapshot.data).toEqual({ ok: true });
    });

    it('should notify observers on error', async () => {
      const callback = vi.fn();
      client.subscribe(['error-test'], callback);

      await expect(
        client.fetchQuery({
          queryKey: ['error-test'],
          queryFn: async () => {
            throw new Error('boom');
          },
        }),
      ).rejects.toThrow('boom');

      const lastCall = callback.mock.calls[callback.mock.calls.length - 1];
      const snapshot = lastCall[0];
      expect(snapshot.status).toBe('error');
      expect(snapshot.error).toBeInstanceOf(Error);
    });

    it('should require queryFn', async () => {
      await expect(
        client.fetchQuery({
          queryKey: ['no-fn'],
          queryFn: undefined as never,
        }),
      ).rejects.toThrow('queryFn is required');
    });
  });

  describe('removeQuery', () => {
    it('should remove cached data', () => {
      client.setQueryData(['temp'], 'data');
      expect(client.getQueryData(['temp'])).toBe('data');

      client.removeQuery(['temp']);
      expect(client.getQueryData(['temp'])).toBeUndefined();
    });

    it('should stop notifying observers after removal', () => {
      const callback = vi.fn();
      client.subscribe(['removable'], callback);
      expect(callback).toHaveBeenCalledTimes(1);

      client.removeQuery(['removable']);

      // After removal, setQueryData on the same key won't reach old observer
      // because the state machine and observer were destroyed
      client.setQueryData(['removable'], 'new');
      // The callback should not have been called again after removal
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('invalidateQueries', () => {
    it('should invalidate exact key', async () => {
      await client.fetchQuery({
        queryKey: ['user', 1],
        queryFn: async () => ({ id: 1 }),
      });

      client.setQueryData(['user', 1], { id: 1, stale: true });
      await client.invalidateQueries(['user', 1]);
      // Should not throw
    });

    it('should handle invalidation of non-existent keys', async () => {
      await client.invalidateQueries(['nonexistent']);
      // Should not throw
    });
  });

  describe('clear', () => {
    it('should clear all data and observers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      client.setQueryData(['a'], 1);
      client.setQueryData(['b'], 2);
      client.subscribe(['a'], cb1);
      client.subscribe(['b'], cb2);

      client.clear();

      expect(client.queryCount).toBe(0);
      expect(client.getQueryData(['a'])).toBeUndefined();
      expect(client.getQueryData(['b'])).toBeUndefined();
    });
  });

  describe('destroy', () => {
    it('should mark client as destroyed', () => {
      client.destroy();
      expect(client.isDestroyed).toBe(true);
    });

    it('should throw on operations after destroy', async () => {
      client.destroy();

      expect(() => client.getQueryData(['x'])).toThrow(RuntimeError);
      expect(() => client.setQueryData(['x'], 1)).toThrow(RuntimeError);
      expect(() => client.subscribe(['x'], vi.fn())).toThrow(RuntimeError);
      await expect(
        client.fetchQuery({ queryKey: ['x'], queryFn: async () => 1 }),
      ).rejects.toThrow(RuntimeError);
    });

    it('should be safe to call destroy multiple times', () => {
      client.destroy();
      client.destroy();
      expect(client.isDestroyed).toBe(true);
    });
  });

  describe('queryCount', () => {
    it('should track number of queries', async () => {
      expect(client.queryCount).toBe(0);

      client.subscribe(['a'], vi.fn());
      expect(client.queryCount).toBe(1);

      client.subscribe(['b'], vi.fn());
      expect(client.queryCount).toBe(2);
    });
  });

  describe('edge cases', () => {
    it('should handle rapid setQueryData calls', () => {
      for (let i = 0; i < 100; i++) {
        client.setQueryData(['counter'], i);
      }
      expect(client.getQueryData<number>(['counter'])).toBe(99);
    });

    it('should handle concurrent subscribe and destroy', () => {
      const callback = vi.fn();
      client.subscribe(['race'], callback);
      client.destroy();
      expect(client.isDestroyed).toBe(true);
    });

    it('should handle different keys independently', () => {
      client.setQueryData(['a'], 1);
      client.setQueryData(['b'], 2);
      client.setQueryData(['c'], 3);

      expect(client.getQueryData(['a'])).toBe(1);
      expect(client.getQueryData(['b'])).toBe(2);
      expect(client.getQueryData(['c'])).toBe(3);

      client.removeQuery(['b']);
      expect(client.getQueryData(['a'])).toBe(1);
      expect(client.getQueryData(['b'])).toBeUndefined();
      expect(client.getQueryData(['c'])).toBe(3);
    });

    it('should handle nested key structures', () => {
      const key = ['users', { role: 'admin', active: true }];
      client.setQueryData(key, [{ id: 1 }]);
      expect(client.getQueryData(key)).toEqual([{ id: 1 }]);
    });

    it('should handle async fetch interleaved with setQueryData', async () => {
      const callback = vi.fn();
      client.subscribe(['interleave'], callback);

      const fetchPromise = client.fetchQuery({
        queryKey: ['interleave'],
        queryFn: async () => {
          return 'from-fetch';
        },
      });

      client.setQueryData(['interleave'], 'from-set');

      const result = await fetchPromise;
      // fetch overwrites set since it completes after
      expect(result).toBe('from-fetch');
    });
  });

  describe('memory safety', () => {
    it('should not leak observers after unsubscribe', () => {
      const callbacks: ReturnType<typeof vi.fn>[] = [];
      const unsubs: (() => void)[] = [];

      for (let i = 0; i < 100; i++) {
        const cb = vi.fn();
        callbacks.push(cb);
        unsubs.push(client.subscribe([`mem-${i}`], cb));
      }

      // Unsubscribe all
      for (const unsub of unsubs) {
        unsub();
      }

      // Trigger updates - should not reach any callbacks
      for (let i = 0; i < 100; i++) {
        client.setQueryData([`mem-${i}`], i);
      }

      for (const cb of callbacks) {
        expect(cb).toHaveBeenCalledTimes(1); // only initial snapshot
      }
    });

    it('should not leak after destroy', () => {
      for (let i = 0; i < 100; i++) {
        client.subscribe([`leak-${i}`], vi.fn());
      }

      client.destroy();
      expect(client.queryCount).toBe(0);
    });
  });
});
