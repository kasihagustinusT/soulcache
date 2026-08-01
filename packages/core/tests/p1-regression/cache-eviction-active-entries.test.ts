import { describe, it, expect, afterEach, vi } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('cache eviction with active entries', () => {
  let cache: CacheEngine;

  afterEach(() => {
    cache.clear();
    vi.useRealTimers();
  });

  it('should evict an inactive entry when capacity is exceeded', () => {
    vi.useFakeTimers();
    cache = new CacheEngine({ maxSize: 3, staleTime: 60000 });

    cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    vi.advanceTimersByTime(10);
    cache.set({ queryKey: ['b'], data: 'b', state: 'success' });
    vi.advanceTimersByTime(10);
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    expect(cache.size).toBe(3);

    // Insert 'd' — should evict one inactive entry
    vi.advanceTimersByTime(10);
    cache.set({ queryKey: ['d'], data: 'd', state: 'success' });

    expect(cache.size).toBe(3);
    // At least one of the original entries was evicted
    const evicted = ['a', 'b', 'c'].filter((k) => cache.get([k]) === undefined);
    expect(evicted.length).toBe(1);
    // The new entry survived
    expect(cache.get(['d'])).toBeDefined();
  });

  it('should allow temporary overflow when all entries are active', () => {
    cache = new CacheEngine({ maxSize: 3, staleTime: 60000 });

    const entryA = cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    const entryB = cache.set({ queryKey: ['b'], data: 'b', state: 'success' });
    const entryC = cache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    // All entries become active
    entryA.observerCount = 1;
    entryB.observerCount = 1;
    entryC.observerCount = 1;

    // Insert 'd' — all active, no eviction candidate, temporary overflow
    cache.set({ queryKey: ['d'], data: 'd', state: 'success' });

    // Cache exceeds maxSize — this is expected
    expect(cache.size).toBe(4);
    expect(cache.get(['a'])).toBeDefined();
    expect(cache.get(['b'])).toBeDefined();
    expect(cache.get(['c'])).toBeDefined();
    expect(cache.get(['d'])).toBeDefined();
  });

  it('should keep active entry functional after overflow', () => {
    cache = new CacheEngine({ maxSize: 2, staleTime: 60000 });

    const entryA = cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    const entryB = cache.set({ queryKey: ['b'], data: 'b', state: 'success' });

    // Both active
    entryA.observerCount = 1;
    entryB.observerCount = 1;

    // Overflow
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    // Active entry still accessible and returns correct data
    const retrieved = cache.get(['a']);
    expect(retrieved).toBeDefined();
    expect(retrieved?.data).toBe('a');
    expect(retrieved?.observerCount).toBe(1);
  });

  it('should evict entry after observer detaches and new entry arrives', () => {
    vi.useFakeTimers();
    cache = new CacheEngine({ maxSize: 2, staleTime: 60000 });

    // Fill cache: A (active), B (inactive)
    const entryA = cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    entryA.observerCount = 1;
    cache.set({ queryKey: ['b'], data: 'b', state: 'success' });

    // B is the only inactive candidate, inserting C evicts B
    vi.advanceTimersByTime(10);
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' });
    expect(cache.size).toBe(2);
    expect(cache.get(['a'])).toBeDefined();
    expect(cache.get(['b'])).toBeUndefined();
    expect(cache.get(['c'])).toBeDefined();

    // A's observer detaches — now A is inactive and eligible for eviction
    entryA.observerCount = 0;

    // Insert D — A should be evicted (sole inactive candidate)
    vi.advanceTimersByTime(10);
    cache.set({ queryKey: ['d'], data: 'd', state: 'success' });

    // A was evicted because it was the only inactive entry
    expect(cache.get(['a'])).toBeUndefined();
    // Other entries survive
    expect(cache.get(['c'])).toBeDefined();
    expect(cache.get(['d'])).toBeDefined();
  });

  it('should not orphan observers after overflow', () => {
    cache = new CacheEngine({ maxSize: 2, staleTime: 60000 });

    const entryA = cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    entryA.observerCount = 1;

    const entryB = cache.set({ queryKey: ['b'], data: 'b', state: 'success' });
    entryB.observerCount = 1;

    // Overflow — new entry inserted
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    // Active entry 'a' still in cache, observer not orphaned
    const retrieved = cache.get(['a']);
    expect(retrieved).toBeDefined();
    expect(retrieved?.observerCount).toBe(1);
    expect(retrieved?.data).toBe('a');
  });

  it('should protect all active entries from eviction during overflow', () => {
    cache = new CacheEngine({ maxSize: 2, staleTime: 60000 });

    const entryA = cache.set({ queryKey: ['a'], data: 'a', state: 'success' });
    entryA.observerCount = 1;

    const entryB = cache.set({ queryKey: ['b'], data: 'b', state: 'success' });
    entryB.observerCount = 1;

    // Overflow — both active entries protected, new entry still inserted
    cache.set({ queryKey: ['c'], data: 'c', state: 'success' });

    // Both active entries survive despite overflow
    expect(cache.get(['a'])).toBeDefined();
    expect(cache.get(['a']).observerCount).toBe(1);
    expect(cache.get(['b'])).toBeDefined();
    expect(cache.get(['b']).observerCount).toBe(1);
    // New entry also survives (temporary overflow)
    expect(cache.get(['c'])).toBeDefined();
    expect(cache.size).toBe(3);
  });
});
