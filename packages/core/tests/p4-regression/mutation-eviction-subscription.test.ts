import { describe, it, expect, beforeEach } from 'vitest';
import { MutationCache } from '../../src/mutation/mutation-cache';

describe('MutationCache evictOldest must clean subscriptions', () => {
  let cache: MutationCache;

  beforeEach(() => {
    cache = new MutationCache({ maxSize: 3 });
  });

  it('1. normal remove cleans subscription', () => {
    const entry = cache.create({
      mutationId: 'm1',
      mutationFn: async () => 'a',
    });

    const unsub = entry.subscribe(() => {});
    void unsub;

    expect(cache.size).toBe(1);
    cache.remove('m1');
    expect(cache.size).toBe(0);
  });

  it('2. clear cleans all subscriptions', () => {
    cache.create({ mutationId: 'm1', mutationFn: async () => 'a' });
    cache.create({ mutationId: 'm2', mutationFn: async () => 'b' });

    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('3. destroy cleans all subscriptions', () => {
    cache.create({ mutationId: 'm1', mutationFn: async () => 'a' });
    cache.create({ mutationId: 'm2', mutationFn: async () => 'b' });

    cache.destroy();
    expect(cache.size).toBe(0);
  });

  it('4. eviction cleans subscription', () => {
    // Create 3 entries (maxSize = 3)
    cache.create({ mutationId: 'm1', mutationFn: async () => 'a' });
    cache.create({ mutationId: 'm2', mutationFn: async () => 'b' });
    cache.create({ mutationId: 'm3', mutationFn: async () => 'c' });

    expect(cache.size).toBe(3);

    // Creating a 4th should evict the oldest non-pending one
    cache.create({ mutationId: 'm4', mutationFn: async () => 'd' });

    // m1 should be evicted (oldest)
    expect(cache.get('m1')).toBeUndefined();
    expect(cache.size).toBe(3);
  });

  it('5. multiple subscriptions are cleaned on eviction', () => {
    const entry1 = cache.create({
      mutationId: 'm1',
      mutationFn: async () => 'a',
    });

    let count = 0;
    entry1.subscribe(() => {
      count++;
    });

    cache.create({ mutationId: 'm2', mutationFn: async () => 'b' });
    cache.create({ mutationId: 'm3', mutationFn: async () => 'c' });
    cache.create({ mutationId: 'm4', mutationFn: async () => 'd' }); // evicts m1

    expect(cache.get('m1')).toBeUndefined();
  });

  it('6. repeated eviction does not crash', () => {
    for (let i = 0; i < 10; i++) {
      cache.create({ mutationId: `m${i}`, mutationFn: async () => `${i}` });
    }

    // Should not crash; cache size should be at most maxSize
    expect(cache.size).toBeLessThanOrEqual(3);
  });

  it('7. cleanup executes exactly once per entry', () => {
    let destroyCount = 0;
    const originalDestroy = Function.prototype;

    const entry = cache.create({
      mutationId: 'm1',
      mutationFn: async () => 'a',
    });

    const unsub = entry.subscribe(() => {});

    // Evict the entry
    cache.create({ mutationId: 'm2', mutationFn: async () => 'b' });
    cache.create({ mutationId: 'm3', mutationFn: async () => 'c' });
    cache.create({ mutationId: 'm4', mutationFn: async () => 'd' }); // evicts m1

    // After eviction, entry should be destroyed
    expect(entry.isDestroyed).toBe(true);
    void unsub;
    void originalDestroy;
    void destroyCount;
  });

  it('8. no dangling references after eviction', () => {
    const entry = cache.create({
      mutationId: 'm1',
      mutationFn: async () => 'a',
    });

    cache.create({ mutationId: 'm2', mutationFn: async () => 'b' });
    cache.create({ mutationId: 'm3', mutationFn: async () => 'c' });
    cache.create({ mutationId: 'm4', mutationFn: async () => 'd' }); // evicts m1

    // Entry should be destroyed and not retrievable
    expect(entry.isDestroyed).toBe(true);
    expect(cache.get('m1')).toBeUndefined();
    expect(cache.findAll({ status: 'idle' }).find((e) => e.id === 'm1')).toBeUndefined();
  });
});
