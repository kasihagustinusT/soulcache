import { describe, it, expect } from 'vitest';
import { createInspector } from '../inspector';

describe('Inspector', () => {
  describe('inspectQuery', () => {
    it('should return null for non-existent query', () => {
      const inspector = createInspector();
      const cache = {
        get: () => undefined,
      };
      const result = inspector.inspectQuery(['nonexistent'], cache);
      expect(result).toBeNull();
    });

    it('should inspect existing query', () => {
      const inspector = createInspector();
      const entry = {
        data: { name: 'Alice' },
        state: 'success',
        fetchStatus: 'idle',
        error: null,
        observerCount: 2,
        accessCount: 5,
        updatedAt: '2024-01-01T00:00:00.000Z',
        staleAt: '2024-01-01T01:00:00.000Z',
        expiresAt: '2024-01-01T02:00:00.000Z',
        meta: { source: 'api' },
        dependencies: [],
      };
      const cache = {
        get: () => entry,
      };
      const result = inspector.inspectQuery(['users', 1], cache);
      expect(result).not.toBeNull();
      expect(result!.queryKey).toEqual(['users', 1]);
      expect(result!.status).toBe('success');
      expect(result!.observerCount).toBe(2);
      expect(result!.data).toEqual({ name: 'Alice' });
      expect(result!.sizeBytes).toBeGreaterThan(0);
    });
  });

  describe('inspectMutations', () => {
    it('should inspect mutations', () => {
      const inspector = createInspector();
      const mutationCache = {
        entries: () => [
          {
            id: 'mut-1',
            status: 'success',
            variables: { name: 'Bob' },
            data: { id: 1 },
            error: null,
            createdAt: 1000,
          },
        ],
      };
      const result = inspector.inspectMutations(mutationCache);
      expect(result).toHaveLength(1);
      expect(result[0]!.mutationId).toBe('mut-1');
      expect(result[0]!.duration).toBeNull();
    });

    it('should handle mutations without data', () => {
      const inspector = createInspector();
      const mutationCache = {
        entries: () => [
          {
            id: 'mut-2',
            status: 'pending',
            variables: null,
            data: undefined,
            error: null,
            createdAt: 1000,
          },
        ],
      };
      const result = inspector.inspectMutations(mutationCache);
      expect(result[0]!.duration).toBeNull();
    });

    it('should handle empty mutation cache', () => {
      const inspector = createInspector();
      const result = inspector.inspectMutations({ entries: () => [] });
      expect(result).toHaveLength(0);
    });
  });

  describe('inspectCacheStats', () => {
    it('should return cache stats', () => {
      const inspector = createInspector();
      const cache = {
        getStats: () => ({
          size: 10,
          activeEntries: 3,
          gcEligibleEntries: 5,
          totalAccesses: 100,
        }),
      };
      const result = inspector.inspectCacheStats(cache);
      expect(result.size).toBe(10);
      expect(result.activeEntries).toBe(3);
      expect(result.gcEligibleEntries).toBe(5);
      expect(result.totalAccesses).toBe(100);
    });
  });

  describe('inspectScheduler', () => {
    it('should return scheduler metrics', () => {
      const inspector = createInspector();
      const scheduler = {
        getMetrics: () => ({
          totalScheduled: 50,
          totalCompleted: 45,
          totalFailed: 2,
          totalCancelled: 3,
          queueSize: 0,
          activeTaskCount: 0,
          flushCount: 10,
          batchCount: 5,
        }),
      };
      const result = inspector.inspectScheduler(scheduler);
      expect(result.totalScheduled).toBe(50);
      expect(result.totalCompleted).toBe(45);
    });
  });

  describe('inspectRuntime', () => {
    it('should return full runtime snapshot', () => {
      const inspector = createInspector();
      const client = {
        queryCount: 2,
        getCache: () => ({
          entries: () => [
            {
              queryKey: ['users'],
              keyHash: '["users"]',
              data: [],
              state: 'success',
              fetchStatus: 'idle',
              error: null,
              observerCount: 1,
              accessCount: 10,
              updatedAt: '2024-01-01',
              staleAt: '2024-01-02',
              expiresAt: '2024-01-03',
              meta: {},
              dependencies: [],
            },
          ],
          getStats: () => ({
            size: 1,
            activeEntries: 1,
            gcEligibleEntries: 0,
            totalAccesses: 10,
          }),
        }),
        getMutationCache: () => ({
          entries: () => [],
        }),
        getScheduler: () => ({
          getMetrics: () => ({
            totalScheduled: 10,
            totalCompleted: 10,
            totalFailed: 0,
            totalCancelled: 0,
            queueSize: 0,
            activeTaskCount: 0,
            flushCount: 5,
            batchCount: 3,
          }),
        }),
      };
      const result = inspector.inspectRuntime(client);
      expect(result.queries).toHaveLength(1);
      expect(result.mutations).toHaveLength(0);
      expect(result.cacheStats.size).toBe(1);
      expect(result.timestamp).toBeGreaterThan(0);
    });
  });
});
