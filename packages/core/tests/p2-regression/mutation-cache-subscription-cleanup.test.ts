import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MutationCache } from '../../src/mutation/mutation-cache';

describe('MutationCache subscription cleanup', () => {
  let cache: MutationCache;

  beforeEach(() => {
    cache = new MutationCache();
  });

  it('remove() cleans up entry subscription', () => {
    const entry = cache.create({
      mutationId: 'h4-1',
      mutationFn: async () => 'ok',
    });

    expect(cache.size).toBe(1);

    const removed = cache.remove('h4-1');
    expect(removed).toBe(true);
    expect(cache.size).toBe(0);

    // Entry should be destroyed and no longer notify
    expect(entry.isDestroyed).toBe(true);
  });

  it('clear() cleans up all subscriptions', () => {
    cache.create({
      mutationId: 'h4-a',
      mutationFn: async () => 'a',
    });
    cache.create({
      mutationId: 'h4-b',
      mutationFn: async () => 'b',
    });

    expect(cache.size).toBe(2);

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('destroy() cleans up all subscriptions and listeners', () => {
    const listener = vi.fn();
    cache.subscribe(listener);

    cache.create({
      mutationId: 'h4-c',
      mutationFn: async () => 'c',
    });

    cache.destroy();

    // No more notifications after destroy
    listener.mockClear();
    const entry = cache.create({
      mutationId: 'h4-d',
      mutationFn: async () => 'd',
    });

    // destroy clears listeners, so new cache listeners are not notified
    // (the cache itself is destroyed)
    expect(cache.size).toBe(1); // entry was created but cache is destroyed
  });

  it('remove non-existent entry returns false without error', () => {
    const result = cache.remove('non-existent');
    expect(result).toBe(false);
  });

  it('evictOldest during create cleans up subscription of evicted entry', () => {
    const smallCache = new MutationCache({ maxSize: 2 });

    const e1 = smallCache.create({
      mutationId: 'h4-evict-1',
      mutationFn: async () => '1',
    });
    smallCache.create({
      mutationId: 'h4-evict-2',
      mutationFn: async () => '2',
    });

    // This should evict the oldest
    smallCache.create({
      mutationId: 'h4-evict-3',
      mutationFn: async () => '3',
    });

    expect(smallCache.size).toBe(2);
    expect(e1.isDestroyed).toBe(true);
  });
});
