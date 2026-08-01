import { describe, it, expect, beforeEach } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('LRU eviction must not remove actively-fetching entries', () => {
  let cache: CacheEngine;

  beforeEach(() => {
    cache = new CacheEngine({ maxSize: 3, staleTime: 60000, gcTime: 120000 });
  });

  it('must NOT evict an entry with fetchStatus=fetching', () => {
    const a = cache.set({ queryKey: ['a'] });
    cache.set({ queryKey: ['b'] });
    cache.set({ queryKey: ['c'] });
    a.fetchStatus = 'fetching';
    a.observerCount = 0;
    cache.set({ queryKey: ['d'] });
    expect(cache.has(['a'])).toBe(true);
  });

  it('evicts idle entries but preserves fetching', () => {
    const a = cache.set({ queryKey: ['a'] });
    cache.set({ queryKey: ['b'] });
    cache.set({ queryKey: ['c'] });
    a.fetchStatus = 'fetching';
    a.observerCount = 0;
    cache.set({ queryKey: ['d'] });
    expect(cache.has(['a'])).toBe(true);
    expect(cache.size).toBe(3);
  });

  it('fetching entry with observerCount>0 doubly protected', () => {
    const a = cache.set({ queryKey: ['a'] });
    cache.set({ queryKey: ['b'] });
    cache.set({ queryKey: ['c'] });
    a.fetchStatus = 'fetching';
    a.observerCount = 1;
    cache.set({ queryKey: ['d'] });
    expect(cache.has(['a'])).toBe(true);
    expect(cache.size).toBe(3);
  });

  it('consistent with collectGarbage fetchStatus guard', () => {
    const a = cache.set({ queryKey: ['a'] });
    cache.set({ queryKey: ['b'] });
    cache.set({ queryKey: ['c'] });
    a.fetchStatus = 'fetching';
    (a as any).expiresAt = new Date(Date.now() - 100000).toISOString();
    const gcRemoved = cache.collectGarbage();
    expect(gcRemoved).toBe(0);
    expect(cache.has(['a'])).toBe(true);
    cache.set({ queryKey: ['d'] });
    expect(cache.has(['a'])).toBe(true);
  });
});
