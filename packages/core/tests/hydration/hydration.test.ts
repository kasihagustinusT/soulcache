import { describe, it, expect, beforeEach } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';
import { dehydrate, hydrate, serialize, deserialize } from '../../src/hydration/hydration';
import type { DehydratedState } from '../../src/types/hydration.types';

describe('Hydration Runtime', () => {
  let cache: CacheEngine;

  beforeEach(() => {
    cache = new CacheEngine();
  });

  describe('dehydrate', () => {
    it('should serialize empty cache', () => {
      const state = dehydrate(cache);
      expect(state.version).toBe(1);
      expect(state.queries).toEqual([]);
      expect(state.timestamp).toBeTypeOf('number');
    });

    it('should serialize a single query', () => {
      cache.set({
        queryKey: ['user', 1],
        data: { id: 1, name: 'Alice' },
        state: 'success',
      });

      const state = dehydrate(cache);
      expect(state.queries).toHaveLength(1);
      expect(state.queries[0]).toEqual(
        expect.objectContaining({
          queryKey: ['user', 1],
          data: { id: 1, name: 'Alice' },
          state: 'success',
        }),
      );
    });

    it('should serialize multiple queries', () => {
      cache.set({ queryKey: ['a'], data: 1, state: 'success' });
      cache.set({ queryKey: ['b'], data: 2, state: 'success' });
      cache.set({ queryKey: ['c'], data: 3, state: 'success' });

      const state = dehydrate(cache);
      expect(state.queries).toHaveLength(3);
    });

    it('should serialize errors', () => {
      cache.set({
        queryKey: ['fail'],
        error: new Error('test error'),
        state: 'error',
      });

      const state = dehydrate(cache);
      expect(state.queries[0]).toEqual(
        expect.objectContaining({
          state: 'error',
          error: expect.objectContaining({
            message: 'test error',
            name: 'Error',
          }),
        }),
      );
    });

    it('should respect maxQueries option', () => {
      cache.set({ queryKey: ['a'], data: 1, state: 'success' });
      cache.set({ queryKey: ['b'], data: 2, state: 'success' });
      cache.set({ queryKey: ['c'], data: 3, state: 'success' });

      const state = dehydrate(cache, { maxQueries: 2 });
      expect(state.queries).toHaveLength(2);
    });

    it('should respect filter option', () => {
      cache.set({ queryKey: ['user', 1], data: { name: 'Alice' }, state: 'success' });
      cache.set({ queryKey: ['post', 1], data: { title: 'Hello' }, state: 'success' });

      const state = dehydrate(cache, {
        filter: (q) => q.queryKey[0] === 'user',
      });
      expect(state.queries).toHaveLength(1);
      expect(state.queries[0].queryKey).toEqual(['user', 1]);
    });

    it('should skip stale queries by default', () => {
      cache.set({ queryKey: ['a'], data: 1, state: 'success' });
      const entry = cache.get(['a']);
      if (entry) entry.markStale();

      const state = dehydrate(cache);
      expect(state.queries).toHaveLength(0);
    });

    it('should include stale queries when option is set', () => {
      cache.set({ queryKey: ['a'], data: 1, state: 'success' });
      const entry = cache.get(['a']);
      if (entry) entry.markStale();

      const state = dehydrate(cache, { includeStale: true });
      expect(state.queries).toHaveLength(1);
    });
  });

  describe('hydrate', () => {
    it('should restore queries from dehydrated state', () => {
      const state: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          {
            queryKey: ['user', 1],
            queryHash: '["user",1]',
            data: { id: 1, name: 'Alice' },
            state: 'success',
            updatedAt: Date.now(),
          },
        ],
      };

      hydrate(cache, state);

      expect(cache.size).toBe(1);
      const data = cache.get<{ id: number; name: string }>(['user', 1]);
      expect(data?.data).toEqual({ id: 1, name: 'Alice' });
    });

    it('should restore multiple queries', () => {
      const state: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          { queryKey: ['a'], queryHash: '["a"]', data: 1, state: 'success', updatedAt: Date.now() },
          { queryKey: ['b'], queryHash: '["b"]', data: 2, state: 'success', updatedAt: Date.now() },
          { queryKey: ['c'], queryHash: '["c"]', data: 3, state: 'success', updatedAt: Date.now() },
        ],
      };

      hydrate(cache, state);

      expect(cache.size).toBe(3);
      expect(cache.get<number>(['a'])?.data).toBe(1);
      expect(cache.get<number>(['b'])?.data).toBe(2);
      expect(cache.get<number>(['c'])?.data).toBe(3);
    });

    it('should restore errors', () => {
      const state: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          {
            queryKey: ['fail'],
            queryHash: '["fail"]',
            data: undefined,
            state: 'error',
            updatedAt: Date.now(),
            error: { message: 'test error', name: 'Error', stack: 'at test...' },
          },
        ],
      };

      hydrate(cache, state);

      const entry = cache.get(['fail']);
      expect(entry?.error).toBeInstanceOf(Error);
      expect(entry?.error?.message).toBe('test error');
    });

    it('should respect maxQueries option', () => {
      const state: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          { queryKey: ['a'], queryHash: '["a"]', data: 1, state: 'success', updatedAt: Date.now() },
          { queryKey: ['b'], queryHash: '["b"]', data: 2, state: 'success', updatedAt: Date.now() },
          { queryKey: ['c'], queryHash: '["c"]', data: 3, state: 'success', updatedAt: Date.now() },
        ],
      };

      hydrate(cache, state, { maxQueries: 2 });
      expect(cache.size).toBe(2);
    });

    it('should respect filter option', () => {
      const state: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          { queryKey: ['user', 1], queryHash: '["user",1]', data: { name: 'Alice' }, state: 'success', updatedAt: Date.now() },
          { queryKey: ['post', 1], queryHash: '["post",1]', data: { title: 'Hello' }, state: 'success', updatedAt: Date.now() },
        ],
      };

      hydrate(cache, state, {
        filter: (q) => q.queryKey[0] === 'user',
      });

      expect(cache.size).toBe(1);
      expect(cache.get(['user', 1])?.data).toEqual({ name: 'Alice' });
    });

    it('should handle empty state', () => {
      hydrate(cache, { version: 1, timestamp: Date.now(), queries: [] });
      expect(cache.size).toBe(0);
    });

    it('should handle null/undefined state', () => {
      hydrate(cache, null as unknown as DehydratedState);
      expect(cache.size).toBe(0);
    });
  });

  describe('serialize/deserialize', () => {
    it('should roundtrip through JSON', () => {
      const original: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          {
            queryKey: ['user', 1],
            queryHash: '["user",1]',
            data: { id: 1, name: 'Alice' },
            state: 'success',
            updatedAt: Date.now(),
          },
        ],
      };

      const json = serialize(original);
      const restored = deserialize(json);

      expect(restored).toEqual(original);
    });

    it('should reconstruct Error objects', () => {
      const original: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          {
            queryKey: ['fail'],
            queryHash: '["fail"]',
            data: undefined,
            state: 'error',
            updatedAt: Date.now(),
            error: { message: 'test error', name: 'CustomError', stack: 'at test...' },
          },
        ],
      };

      const json = serialize(original);
      const restored = deserialize(json);

      expect(restored.queries[0].error).toBeInstanceOf(Error);
      expect((restored.queries[0].error as Error).message).toBe('test error');
      expect((restored.queries[0].error as Error).name).toBe('CustomError');
    });

    it('should handle complex nested data', () => {
      const original: DehydratedState = {
        version: 1,
        timestamp: Date.now(),
        queries: [
          {
            queryKey: ['data'],
            queryHash: '["data"]',
            data: {
              nested: { array: [1, 2, 3], string: 'hello', null: null, bool: true },
            },
            state: 'success',
            updatedAt: Date.now(),
          },
        ],
      };

      const json = serialize(original);
      const restored = deserialize(json);

      expect(restored.queries[0].data).toEqual(original.queries[0].data);
    });
  });

  describe('end-to-end', () => {
    it('should dehydrate from one cache and hydrate to another', () => {
      // Server cache
      const serverCache = new CacheEngine();
      serverCache.set({ queryKey: ['user', 1], data: { id: 1, name: 'Alice' }, state: 'success' });
      serverCache.set({ queryKey: ['posts'], data: [{ id: 1 }], state: 'success' });

      // Dehydrate
      const state = dehydrate(serverCache);
      const json = serialize(state);

      // Client cache
      const clientCache = new CacheEngine();
      const clientState = deserialize(json);
      hydrate(clientCache, clientState);

      // Verify
      expect(clientCache.size).toBe(2);
      expect(clientCache.get(['user', 1])?.data).toEqual({ id: 1, name: 'Alice' });
      expect(clientCache.get(['posts'])?.data).toEqual([{ id: 1 }]);
    });
  });
});
