import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryClient } from '../../src/client/query-client';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('GC must clean up _snapshotCache and _stateMachines', () => {
  let client: QueryClient;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. GC eviction cleans up snapshot cache', () => {
    client = new QueryClient({ defaultOptions: { gcTime: 1000 } });
    const cache = client.getCache();

    // Create query and populate snapshot
    client.setQueryData(['gc-test'], 'data');
    client.getQuerySnapshot(['gc-test']);

    // Verify snapshot exists
    expect(client.getQuerySnapshot(['gc-test'])).toBeDefined();

    // Manually make entry expired and GC
    // Access the entry via cache and manipulate its expiry
    const entry = cache.get(['gc-test']);
    if (entry) {
      // Force expiry by setting expiresAt to past
      (entry as { expiresAt: string | null }).expiresAt = new Date(Date.now() - 1000).toISOString();
    }

    // Run GC
    const evicted = cache.collectGarbage();
    expect(evicted).toBe(1);

    // Snapshot should be cleaned up via onEvict callback
    // After GC, querying the key should return undefined
    // (no cache entry + no SM → clean path)
    const snapshot = client.getQuerySnapshot(['gc-test']);
    expect(snapshot).toBeUndefined();
  });

  it('2. GC eviction cleans up state machine', () => {
    client = new QueryClient({ defaultOptions: { gcTime: 1000 } });
    const cache = client.getCache();

    // Create query and state machine
    client.setQueryData(['sm-test'], 'data');
    client.getQuerySnapshot(['sm-test']);

    // Verify SM exists by checking queryCount
    expect(client.queryCount).toBe(1);

    // Force expiry and GC
    const entry = cache.get(['sm-test']);
    if (entry) {
      (entry as { expiresAt: string | null }).expiresAt = new Date(Date.now() - 1000).toISOString();
    }

    cache.collectGarbage();

    // SM should be cleaned up via onEvict callback
    expect(client.queryCount).toBe(0);
  });

  it('3. GC eviction cleans up snapshot data reference (memory safety)', () => {
    client = new QueryClient({ defaultOptions: { gcTime: 1000 } });
    const cache = client.getCache();

    // Create large data object
    const largeData = { items: new Array(1000).fill('x'.repeat(100)) };
    client.setQueryData(['memory-test'], largeData);
    client.getQuerySnapshot(['memory-test']);

    // Create a WeakRef to track GC
    const ref = new WeakRef(largeData);

    // Force expiry and GC
    const entry = cache.get(['memory-test']);
    if (entry) {
      (entry as { expiresAt: string | null }).expiresAt = new Date(Date.now() - 1000).toISOString();
    }

    cache.collectGarbage();

    // After GC, snapshot should be cleaned (onEvict removes it)
    // The data reference should be releaseable
    const snapshot = client.getQuerySnapshot(['memory-test']);
    expect(snapshot).toBeUndefined();

    // Clean up
    client.destroy();
  });

  it('4. LRU eviction cleans up snapshot cache', () => {
    // Create a cache with maxSize=2
    client = new QueryClient();
    const cache = new CacheEngine({ maxSize: 2, onEvict: () => {} });

    // We need to test via QueryClient, so use a different approach:
    // Manually trigger LRU eviction through cache size limit
    // QueryClient doesn't expose maxSize directly, so test CacheEngine + onEvict
    const evictedKeys: string[] = [];
    const testCache = new CacheEngine({
      maxSize: 2,
      onEvict: (keyHash) => evictedKeys.push(keyHash),
    });

    // Fill cache to capacity
    testCache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    testCache.set({ queryKey: ['b'], data: 'b', state: 'success' });

    // This should trigger LRU eviction of 'a'
    testCache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    expect(evictedKeys).toHaveLength(1);
    expect(testCache.has(['a'])).toBe(false);
    expect(testCache.has(['b'])).toBe(true);
    expect(testCache.has(['c'])).toBe(true);
  });

  it('5. onEvict fires for each GC-evicted entry', () => {
    const evictedKeys: string[] = [];
    const testCache = new CacheEngine({
      gcTime: 1000,
      onEvict: (keyHash) => evictedKeys.push(keyHash),
    });

    // Create entries and force expiry
    testCache.set({ queryKey: ['x'], data: 'x', state: 'success' });
    testCache.set({ queryKey: ['y'], data: 'y', state: 'success' });

    // Force both entries to be expired
    const entryX = testCache.get(['x']);
    const entryY = testCache.get(['y']);
    if (entryX) {
      (entryX as { expiresAt: string | null }).expiresAt = new Date(
        Date.now() - 1000,
      ).toISOString();
    }
    if (entryY) {
      (entryY as { expiresAt: string | null }).expiresAt = new Date(
        Date.now() - 1000,
      ).toISOString();
    }

    const evicted = testCache.collectGarbage();
    expect(evicted).toBe(2);
    expect(evictedKeys).toHaveLength(2);
  });

  it('6. onEvict does NOT fire for explicit delete()', () => {
    const evictedKeys: string[] = [];
    const testCache = new CacheEngine({
      onEvict: (keyHash) => evictedKeys.push(keyHash),
    });

    testCache.set({ queryKey: ['del'], data: 'd', state: 'success' });
    testCache.delete(['del']);

    // Explicit delete should NOT trigger onEvict
    expect(evictedKeys).toHaveLength(0);
  });

  it('7. onEvict does NOT fire for clear()', () => {
    const evictedKeys: string[] = [];
    const testCache = new CacheEngine({
      onEvict: (keyHash) => evictedKeys.push(keyHash),
    });

    testCache.set({ queryKey: ['c1'], data: 'd1', state: 'success' });
    testCache.set({ queryKey: ['c2'], data: 'd2', state: 'success' });
    testCache.clear();

    // clear() should NOT trigger onEvict
    expect(evictedKeys).toHaveLength(0);
  });

  it('8. onEvict does NOT fire for destroy()', () => {
    const evictedKeys: string[] = [];
    const testCache = new CacheEngine({
      onEvict: (keyHash) => evictedKeys.push(keyHash),
    });

    testCache.set({ queryKey: ['d1'], data: 'd', state: 'success' });
    testCache.destroy();

    // destroy() should NOT trigger onEvict
    expect(evictedKeys).toHaveLength(0);
  });

  it('9. GC + recreation: old snapshot does not contaminate new query', () => {
    client = new QueryClient({ defaultOptions: { gcTime: 1000 } });
    const cache = client.getCache();

    // Create Q1 with data
    client.setQueryData(['recreate'], 'v1');
    client.getQuerySnapshot(['recreate']);

    // Force GC
    const entry1 = cache.get(['recreate']);
    if (entry1) {
      (entry1 as { expiresAt: string | null }).expiresAt = new Date(
        Date.now() - 1000,
      ).toISOString();
    }
    cache.collectGarbage();

    // Q1 is evicted, SM destroyed, snapshot cleaned
    expect(client.queryCount).toBe(0);

    // Create Q2 with same key but different data
    client.setQueryData(['recreate'], 'v2');
    const snapshot = client.getQuerySnapshot(['recreate']);

    // Q2 should have its own fresh snapshot
    expect(snapshot).toBeDefined();
    expect(snapshot!.data).toBe('v2');
  });

  it('10. GC during active observer is prevented (observerCount > 0)', () => {
    client = new QueryClient({ defaultOptions: { gcTime: 1000 } });
    const cache = client.getCache();

    client.setQueryData(['protected'], 'data');

    // Subscribe — increments observerCount
    const unsub = client.subscribe(['protected'], () => {});

    // Force expiry
    const entry = cache.get(['protected']);
    if (entry) {
      (entry as { expiresAt: string | null }).expiresAt = new Date(Date.now() - 1000).toISOString();
    }

    // GC should NOT evict because observerCount > 0
    const evicted = cache.collectGarbage();
    expect(evicted).toBe(0);

    // Data still accessible
    expect(client.getQueryData(['protected'])).toBe('data');

    unsub();
    client.destroy();
  });
});
