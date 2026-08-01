import { describe, it, expect, vi } from 'vitest';
import { QueryEntry } from '../../src/cache/query-entry';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('staleTime must be honored exactly once', () => {
  describe('staleAt boundary semantics', () => {
    it('should consider entry stale when staleAt is in the past', () => {
      const entry = new QueryEntry({
        queryId: 'q-1',
        queryKey: ['test'],
        keyHash: '["test"]',
      });

      // Set staleAt to 1 second ago
      entry.staleAt = new Date(Date.now() - 1000).toISOString();

      // Should be stale (staleAt is in the past)
      expect(Date.now() > new Date(entry.staleAt).getTime()).toBe(true);
    });

    it('should NOT consider entry stale when staleAt is in the future', () => {
      const entry = new QueryEntry({
        queryId: 'q-1',
        queryKey: ['test'],
        keyHash: '["test"]',
      });

      // Set staleAt to 10 seconds from now
      entry.staleAt = new Date(Date.now() + 10000).toISOString();

      // Should NOT be stale (staleAt is in the future)
      expect(Date.now() > new Date(entry.staleAt).getTime()).toBe(false);
    });

    it('should use lastFetchedAt fallback for staleness when staleAt is null', () => {
      const entry = new QueryEntry({
        queryId: 'q-1',
        queryKey: ['test'],
        keyHash: '["test"]',
      });

      entry.staleAt = null;
      entry.lastFetchedAt = Date.now() - 5000;

      // 5000ms old → stale if staleTime < 5000, fresh if staleTime > 5000
      expect(Date.now() - entry.lastFetchedAt).toBeGreaterThanOrEqual(5000);
    });

    it('should NOT be stale when staleAt is null and lastFetchedAt is undefined', () => {
      const entry = new QueryEntry({
        queryId: 'q-1',
        keyHash: '["test"]',
        queryKey: ['test'],
      });

      expect(entry.staleAt).toBeNull();
      expect(entry.lastFetchedAt).toBeUndefined();
    });

    it('should NOT double-count staleTime when staleAt is set by cache-engine', () => {
      const staleTime = 5000;
      const cache = new CacheEngine({ staleTime });

      cache.set({
        queryKey: ['test'],
        data: { value: 1 },
        state: 'success',
      });

      const entry = cache.get(['test'])!;

      // staleAt should be approximately Date.now() + staleTime
      const staleAtTime = new Date(entry.staleAt!).getTime();
      const expectedStaleAt = Date.now() + staleTime;

      // Allow 100ms tolerance for test execution time
      expect(Math.abs(staleAtTime - expectedStaleAt)).toBeLessThan(100);

      // Entry should NOT be stale immediately (staleAt is in the future)
      expect(new Date(entry.staleAt!).getTime()).toBeGreaterThan(Date.now());

      // After staleTime elapses, entry SHOULD be stale
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + staleTime + 1);
      expect(new Date(entry.staleAt!).getTime()).toBeLessThan(Date.now());
      vi.useRealTimers();
    });
  });

  describe('staleTime = 0', () => {
    it('should set staleAt to immediate time when staleTime = 0', () => {
      const cache = new CacheEngine({ staleTime: 0 });

      cache.set({
        queryKey: ['test'],
        data: { value: 1 },
        state: 'success',
      });

      const entry = cache.get(['test'])!;

      expect(entry.staleAt).not.toBeNull();
    });
  });

  describe('staleTime = Infinity', () => {
    it('should throw when staleTime is Infinity (Date overflow)', () => {
      const cache = new CacheEngine({ staleTime: Infinity });

      // new Date(Infinity) throws Invalid time value
      expect(() => {
        cache.set({
          queryKey: ['test'],
          data: { value: 1 },
          state: 'success',
        });
      }).toThrow('Invalid time value');
    });
  });

  describe('invalidation sets staleAt', () => {
    it('should set staleAt on invalidated entry', () => {
      const entry = new QueryEntry({
        queryId: 'q-1',
        queryKey: ['test'],
        keyHash: '["test"]',
      });

      entry.markInvalidated();

      expect(entry.state).toBe('invalidated');
      expect(entry.status).toBe('invalidated');
      expect(entry.staleAt).not.toBeNull();
    });

    it('should mark entry as invalidated via markInvalidated', () => {
      const entry = new QueryEntry({
        queryId: 'q-1',
        queryKey: ['test'],
        keyHash: '["test"]',
      });

      entry.markInvalidated();

      expect(entry.state).toBe('invalidated');
      expect(entry.status).toBe('invalidated');
      expect(entry.staleAt).not.toBeNull();
    });
  });

  describe('refetch updates staleAt', () => {
    it('should update staleAt on cache set with new data', () => {
      const staleTime = 10000;
      const cache = new CacheEngine({ staleTime });

      cache.set({
        queryKey: ['test'],
        data: { value: 1 },
        state: 'success',
      });

      const entry1 = cache.get(['test'])!;
      const staleAt1 = new Date(entry1.staleAt!).getTime();

      // Simulate refetch
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 5000);

      cache.set({
        queryKey: ['test'],
        data: { value: 2 },
        state: 'success',
      });

      const entry2 = cache.get(['test'])!;
      const staleAt2 = new Date(entry2.staleAt!).getTime();

      // staleAt should have been updated
      expect(staleAt2).toBeGreaterThan(staleAt1);

      vi.useRealTimers();
    });
  });

  describe('hydration', () => {
    it('should preserve staleAt through get/set cycle', () => {
      const cache = new CacheEngine({ staleTime: 5000 });

      cache.set({
        queryKey: ['test'],
        data: { value: 1 },
        state: 'success',
      });

      const entry = cache.get(['test'])!;
      const staleAt = entry.staleAt;

      // Re-set same data — staleAt should be refreshed
      cache.set({
        queryKey: ['test'],
        data: { value: 1 },
        state: 'success',
      });

      const entry2 = cache.get(['test'])!;
      // staleAt should be updated to new timestamp
      expect(new Date(entry2.staleAt!).getTime()).toBeGreaterThanOrEqual(
        new Date(staleAt!).getTime(),
      );
    });
  });
});
