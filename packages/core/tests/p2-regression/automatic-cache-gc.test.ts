import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('Automatic cache garbage collection', () => {
  it('expired entry collected on next set when near capacity', () => {
    const cache = new CacheEngine({ gcTime: 100, maxSize: 20 });

    // Fill to near capacity (75% of 20 = 15)
    for (let i = 0; i < 15; i++) {
      cache.set({
        queryKey: ['gc', i],
        data: { id: i },
      });
    }

    // Force expiry on first entry
    const entries = cache.entries();
    (entries[0] as any).expiresAt = new Date(Date.now() - 10000).toISOString();

    // Insert one more to trigger opportunistic GC
    cache.set({
      queryKey: ['gc', 'trigger'],
      data: { id: 'trigger' },
    });

    // Expired entry should have been collected
    expect(cache.has(['gc', 0])).toBe(false);
  });

  it('active entry NOT collected by opportunistic GC', () => {
    const cache = new CacheEngine({ gcTime: 100, maxSize: 20 });

    for (let i = 0; i < 15; i++) {
      cache.set({
        queryKey: ['gc-active', i],
        data: { id: i },
      });
    }

    // Mark first entry as active
    const entries = cache.entries();
    entries[0].observerCount = 1;
    (entries[0] as any).expiresAt = new Date(Date.now() - 10000).toISOString();

    cache.set({
      queryKey: ['gc-active', 'trigger'],
      data: { id: 'trigger' },
    });

    // Active entry should still exist
    expect(cache.has(['gc-active', 0])).toBe(true);
  });

  it('gcInterval: 0 (default): no timer created', () => {
    const cache = new CacheEngine();
    // No timer, no error
    cache.destroy();
  });

  it('destroy clears store', () => {
    const cache = new CacheEngine();
    cache.set({ queryKey: ['d', 1], data: { id: 1 } });
    expect(cache.size).toBe(1);
    cache.destroy();
    expect(cache.size).toBe(0);
  });

  it('opportunistic GC does not run below threshold', () => {
    const cache = new CacheEngine({ gcTime: 100, maxSize: 100 });

    // Add 5 entries (well below 75% of 100)
    for (let i = 0; i < 5; i++) {
      cache.set({
        queryKey: ['gc-threshold', i],
        data: { id: i },
      });
    }

    // Force expiry
    const entries = cache.entries();
    for (const e of entries) {
      (e as any).expiresAt = new Date(Date.now() - 10000).toISOString();
    }

    // Add one more (still below threshold)
    cache.set({
      queryKey: ['gc-threshold', 'more'],
      data: { id: 'more' },
    });

    // Expired entries should still exist (GC did not run)
    expect(cache.has(['gc-threshold', 0])).toBe(true);
  });
});
