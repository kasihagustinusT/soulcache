import { describe, it, expect, beforeEach } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('CacheEngine Stress Tests', () => {
  let cache: CacheEngine;

  beforeEach(() => {
    cache = new CacheEngine({
      staleTime: 1000,
      gcTime: 5000,
      maxSize: 50000,
    });
  });

  it('should handle 10000 query entries', () => {
    const start = performance.now();

    for (let i = 0; i < 10000; i++) {
      cache.set({
        queryKey: ['stress', 'users', i],
        data: { id: i, name: `User ${i}` },
      });
    }

    const duration = performance.now() - start;

    expect(cache.size).toBe(10000);
    // Should complete in reasonable time
    expect(duration).toBeLessThan(5000);
  });

  it('should handle 100000 updates', { timeout: 30000 }, () => {
    // Pre-populate
    for (let i = 0; i < 1000; i++) {
      cache.set({
        queryKey: ['stress', 'updates', i],
        data: { id: i, value: 0 },
      });
    }

    const start = performance.now();

    for (let i = 0; i < 100000; i++) {
      const idx = i % 1000;
      cache.set({
        queryKey: ['stress', 'updates', idx],
        data: { id: idx, value: i },
      });
    }

    const duration = performance.now() - start;

    // Should complete in reasonable time (relaxed for CI/mobile/ARM hardware)
    expect(duration).toBeLessThan(15000);

    // Verify final state
    const entry = cache.get(['stress', 'updates', 0]);
    expect(entry?.data).toEqual({ id: 0, value: 99000 });
  });

  it('should handle repeated invalidation', () => {
    // Pre-populate
    for (let i = 0; i < 1000; i++) {
      cache.set({
        queryKey: ['stress', 'invalidate', i],
        data: { id: i },
        state: 'success',
      });
    }

    const start = performance.now();

    // Invalidate all 1000 times
    for (let i = 0; i < 1000; i++) {
      cache.invalidate(['stress', 'invalidate', i]);
    }

    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);

    // All entries should be stale
    for (let i = 0; i < 1000; i++) {
      const entry = cache.get(['stress', 'invalidate', i]);
      expect(entry?.state).toBe('stale');
    }
  });

  it('should maintain O(1) lookup performance', () => {
    // Pre-populate with many entries
    for (let i = 0; i < 10000; i++) {
      cache.set({
        queryKey: ['perf', i],
        data: { id: i },
      });
    }

    // Measure lookup time
    const start = performance.now();
    const iterations = 10000;

    for (let i = 0; i < iterations; i++) {
      cache.get(['perf', i % 10000]);
    }

    const duration = performance.now() - start;
    const avgTimePerLookup = duration / iterations;

    // Each lookup should be sub-millisecond
    expect(avgTimePerLookup).toBeLessThan(0.1);
  });
});

describe('CacheEngine Memory Tests', () => {
  it('should release references after delete', () => {
    const cache = new CacheEngine();

    // Store large objects
    const largeObjects: object[] = [];
    for (let i = 0; i < 100; i++) {
      const obj = { data: new Array(1000).fill('x'.repeat(100)) };
      largeObjects.push(obj);
      cache.set({
        queryKey: ['memory', i],
        data: obj,
      });
    }

    expect(cache.size).toBe(100);

    // Delete all entries
    for (let i = 0; i < 100; i++) {
      cache.delete(['memory', i]);
    }

    expect(cache.size).toBe(0);
    expect(cache.entries()).toHaveLength(0);

    // Clear references
    largeObjects.length = 0;
  });

  it('should not leak memory with rapid set/delete cycles', () => {
    const cache = new CacheEngine({ maxSize: 100 });

    // Rapidly set and delete
    for (let cycle = 0; cycle < 10; cycle++) {
      for (let i = 0; i < 200; i++) {
        cache.set({
          queryKey: ['leak', cycle, i],
          data: { cycle, index: i, data: 'x'.repeat(100) },
        });
      }

      // Should trigger evictions
      expect(cache.size).toBeLessThanOrEqual(100);

      // Clear everything
      cache.clear();
      expect(cache.size).toBe(0);
    }
  });

  it('should cleanup expired entries via garbage collection', () => {
    const cache = new CacheEngine({ gcTime: 100 });

    // Add entries
    for (let i = 0; i < 50; i++) {
      cache.set({
        queryKey: ['gc', i],
        data: { id: i },
      });
    }

    expect(cache.size).toBe(50);

    // Force all entries to be expired by manipulating expiresAt
    const entries = cache.entries();
    for (const entry of entries) {
      (entry as any).expiresAt = new Date(Date.now() - 10000).toISOString();
    }

    // Run garbage collection
    const removed = cache.collectGarbage();

    expect(removed).toBe(50);
    expect(cache.size).toBe(0);
  });

  it('should preserve active entries during garbage collection', () => {
    const cache = new CacheEngine({ gcTime: 100 });

    // Add entries
    for (let i = 0; i < 50; i++) {
      cache.set({
        queryKey: ['gc-active', i],
        data: { id: i },
      });
    }

    // Mark some as active
    const entries = cache.entries();
    for (let i = 0; i < 10; i++) {
      entries[i].observerCount = 1;
    }

    // Force all entries to be expired
    for (const entry of entries) {
      (entry as any).expiresAt = new Date(Date.now() - 10000).toISOString();
    }

    // Run garbage collection
    const removed = cache.collectGarbage();

    // Only 40 should be removed (50 - 10 active)
    expect(removed).toBe(40);
    expect(cache.size).toBe(10);

    // Verify active entries are preserved
    for (let i = 0; i < 10; i++) {
      expect(cache.has(['gc-active', i])).toBe(true);
    }
  });
});
