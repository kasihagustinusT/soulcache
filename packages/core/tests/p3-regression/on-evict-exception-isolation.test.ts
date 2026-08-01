import { describe, it, expect } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('onEvict exception isolation', () => {
  it('1. GC continues processing remaining entries when onEvict throws', () => {
    const evictedKeys: string[] = [];

    const cache = new CacheEngine({
      gcTime: 1000,
      maxSize: 10,
      onEvict: (keyHash: string) => {
        evictedKeys.push(keyHash);
        // Throw for the FIRST entry only
        if (evictedKeys.length === 1) {
          throw new Error('onEvict simulated failure');
        }
      },
    });

    // Create three expired entries
    cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    cache.set({ queryKey: ['b'], data: 'b', state: 'success' });
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    // Force expiry
    for (const key of ['a', 'b', 'c']) {
      const entry = cache.get([key]);
      if (entry) {
        (entry as { expiresAt: string | null }).expiresAt = new Date(
          Date.now() - 1000,
        ).toISOString();
      }
    }

    // GC should process all three entries despite the exception on 'a'
    const removed = cache.collectGarbage();
    expect(removed).toBe(3);
    expect(evictedKeys).toHaveLength(3);
    expect(evictedKeys[0]).toBeTypeOf('string');
    expect(evictedKeys[1]).toBeTypeOf('string');
    expect(evictedKeys[2]).toBeTypeOf('string');

    // All entries should be removed from store
    expect(cache.has(['a'])).toBe(false);
    expect(cache.has(['b'])).toBe(false);
    expect(cache.has(['c'])).toBe(false);
  });

  it('2. LRU eviction removes an entry when onEvict throws', () => {
    const evictedKeys: string[] = [];

    const cache = new CacheEngine({
      maxSize: 2,
      onEvict: (keyHash: string) => {
        evictedKeys.push(keyHash);
        throw new Error('onEvict simulated failure');
      },
    });

    cache.set({ queryKey: ['x'], data: 'x', state: 'success' });
    cache.set({ queryKey: ['y'], data: 'y', state: 'success' });

    // Trigger LRU eviction — one of x/y must go
    cache.set({ queryKey: ['z'], data: 'z', state: 'success' });

    // Exactly 1 entry was evicted despite the exception
    expect(evictedKeys).toHaveLength(1);

    // Store size is at most maxSize (2)
    expect(cache.size).toBe(2);

    // The new entry 'z' is present
    expect(cache.has(['z'])).toBe(true);
  });

  it('3. subsequent LRU evictions work after a throwing onEvict', () => {
    const evictedKeys: string[] = [];
    let throwCount = 0;

    const cache = new CacheEngine({
      maxSize: 2,
      onEvict: (keyHash: string) => {
        evictedKeys.push(keyHash);
        throwCount++;
        throw new Error('onEvict simulated failure');
      },
    });

    // Fill and overflow multiple times
    cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    cache.set({ queryKey: ['b'], data: 'b', state: 'success' });
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' }); // evicts one
    cache.set({ queryKey: ['d'], data: 'd', state: 'success' }); // evicts another

    // Two entries should have been evicted across two eviction rounds
    expect(evictedKeys).toHaveLength(2);
    expect(throwCount).toBe(2);
    expect(cache.size).toBe(2);
    expect(cache.has(['d'])).toBe(true);
  });

  it('4. normal GC behavior unchanged when onEvict does not throw', () => {
    const evictedKeys: string[] = [];
    const cache = new CacheEngine({
      gcTime: 1000,
      onEvict: (keyHash: string) => {
        evictedKeys.push(keyHash);
      },
    });

    cache.set({ queryKey: ['n1'], data: 'n1', state: 'success' });
    cache.set({ queryKey: ['n2'], data: 'n2', state: 'success' });

    const entryN1 = cache.get(['n1']);
    const entryN2 = cache.get(['n2']);
    if (entryN1)
      (entryN1 as { expiresAt: string | null }).expiresAt = new Date(
        Date.now() - 1000,
      ).toISOString();
    if (entryN2)
      (entryN2 as { expiresAt: string | null }).expiresAt = new Date(
        Date.now() - 1000,
      ).toISOString();

    const removed = cache.collectGarbage();
    expect(removed).toBe(2);
    expect(evictedKeys).toHaveLength(2);
    expect(cache.has(['n1'])).toBe(false);
    expect(cache.has(['n2'])).toBe(false);
  });
});
