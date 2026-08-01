import { describe, it, expect } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('subscribeToQuery tracks observerCount', () => {
  it('1. subscribeToQuery increments observerCount on cache entry', () => {
    const client = new QueryClient();
    client.setQueryData(['test-58'], 'data');

    const entry = client.getCache().get(['test-58']);
    expect(entry?.observerCount).toBe(0);

    const unsub = client.subscribeToQuery(['test-58'], () => {});

    const entryAfter = client.getCache().get(['test-58']);
    expect(entryAfter?.observerCount).toBe(1);

    unsub();

    const entryUnsub = client.getCache().get(['test-58']);
    expect(entryUnsub?.observerCount).toBe(0);

    client.destroy();
  });

  it('2. multiple subscribers correctly track observerCount', () => {
    const client = new QueryClient();
    client.setQueryData(['test-58b'], 'data');

    const unsub1 = client.subscribeToQuery(['test-58b'], () => {});
    const unsub2 = client.subscribeToQuery(['test-58b'], () => {});

    const entry = client.getCache().get(['test-58b']);
    expect(entry?.observerCount).toBe(2);

    unsub1();

    const entryAfter = client.getCache().get(['test-58b']);
    expect(entryAfter?.observerCount).toBe(1);

    unsub2();

    const entryFinal = client.getCache().get(['test-58b']);
    expect(entryFinal?.observerCount).toBe(0);

    client.destroy();
  });

  it('3. entries with active subscribers are protected from LRU eviction', () => {
    const client = new QueryClient({ defaultOptions: { maxSize: 3 } });

    // Fill cache to capacity with subscribed queries
    const unsubs: (() => void)[] = [];
    for (let i = 0; i < 3; i++) {
      client.setQueryData([`key-${i}`], `value-${i}`);
      unsubs.push(client.subscribeToQuery([`key-${i}`], () => {}));
    }

    // All entries should have observerCount > 0
    const cache = client.getCache();
    for (let i = 0; i < 3; i++) {
      const entry = cache.get([`key-${i}`]);
      expect(entry?.observerCount).toBe(1);
    }

    // Adding a 4th entry: all existing are protected, so overflow is permitted.
    // The cache should still contain all 3 original entries.
    client.setQueryData(['key-extra'], 'extra');
    for (let i = 0; i < 3; i++) {
      const entry = cache.get([`key-${i}`]);
      expect(entry).toBeDefined();
      expect(entry?.observerCount).toBe(1);
    }

    // Cleanup
    for (const unsub of unsubs) unsub();
    client.destroy();
  });

  it('4. observerCount decrements correctly after unsubscribe', async () => {
    const client = new QueryClient();
    client.setQueryData(['test-58d'], 'data');

    const unsub1 = client.subscribeToQuery(['test-58d'], () => {});
    const unsub2 = client.subscribeToQuery(['test-58d'], () => {});

    const entry1 = client.getCache().get(['test-58d']);
    expect(entry1?.observerCount).toBe(2);

    unsub1();
    const entryAfter1 = client.getCache().get(['test-58d']);
    expect(entryAfter1?.observerCount).toBe(1);

    unsub2();
    const entryAfter2 = client.getCache().get(['test-58d']);
    expect(entryAfter2?.observerCount).toBe(0);

    client.destroy();
  });
});
