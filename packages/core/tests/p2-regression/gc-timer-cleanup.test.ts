import { describe, it, expect } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';
import { QueryClient } from '../../src/client/query-client';

describe('GC does not evict entries with active fetches', () => {
  it('entry with observerCount=0 and fetchStatus=idle IS collected when expired', () => {
    const cache = new CacheEngine({ gcTime: 100, maxSize: 10 });

    cache.set({
      queryKey: ['gc-fetch', 1],
      data: { id: 1 },
    });

    const entry = cache.get(['gc-fetch', 1])!;
    (entry as any).expiresAt = new Date(Date.now() - 10000).toISOString();

    const removed = cache.collectGarbage();
    expect(removed).toBe(1);
    expect(cache.has(['gc-fetch', 1])).toBe(false);
  });

  it('opportunistic GC on set does not crash when cache is empty', () => {
    const cache = new CacheEngine({ gcTime: 100, maxSize: 100 });

    cache.set({
      queryKey: ['gc-empty'],
      data: { id: 1 },
    });

    expect(cache.size).toBe(1);
  });
});

describe('QueryClient.destroy() stops GC timer', () => {
  it('destroy() clears the GC interval timer', () => {
    const client = new QueryClient({
      defaultOptions: { gcInterval: 1000 },
    });

    const cache = (client as any)._cache;
    expect(cache._gcTimer).toBeDefined();

    client.destroy();
    expect(cache._gcTimer).toBeUndefined();
    expect(client.isDestroyed).toBe(true);
  });

  it('clear() does NOT stop GC timer (clear is not destroy)', () => {
    const client = new QueryClient({
      defaultOptions: { gcInterval: 1000 },
    });

    const cache = (client as any)._cache;
    expect(cache._gcTimer).toBeDefined();

    client.clear();
    // clear() should not affect the timer
    expect(cache._gcTimer).toBeDefined();
  });

  it('destroy() is idempotent', () => {
    const client = new QueryClient();
    client.destroy();
    client.destroy(); // No throw
    expect(client.isDestroyed).toBe(true);
  });
});
