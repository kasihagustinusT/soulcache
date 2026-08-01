import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Memory leak stress', () => {
  function getResourceCounts(client: QueryClient) {
    const c = client as any;
    return {
      stateMachines: c._stateMachines.size,
      observers: c._observers.size,
      snapshotCache: c._snapshotCache.size,
      snapshotOrder: c._snapshotCacheOrder.length,
      pendingFetches: c._pendingFetches.size,
      cacheEntries: Array.from(c._cache.entries()).length,
    };
  }

  it('100 mount/unmount cycles leak no resources', async () => {
    const client = new QueryClient();

    const before = getResourceCounts(client);

    for (let i = 0; i < 100; i++) {
      const { unmount } = renderHook(
        () =>
          useQuery({
            queryKey: ['stress', i],
            queryFn: async () => `data-${i}`,
          }),
        {
          wrapper: ({ children }) => (
            <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
          ),
        },
      );
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 10));
      unmount();
      await act(async () => {});
    }

    await new Promise((r) => setTimeout(r, 50));
    const after = getResourceCounts(client);

    expect(after.stateMachines).toBe(after.cacheEntries);
    expect(after.observers).toBe(0);
    expect(after.pendingFetches).toBe(0);
  });

  it('removeQuery+setQueryData in a cycle does not grow snapshot cache', async () => {
    const client = new QueryClient();
    const key = ['stress-snap'];

    const before = (client as any)._snapshotCache.size;

    for (let i = 0; i < 50; i++) {
      client.removeQuery(key);
      client.setQueryData(key, `v${i}`);
    }

    const after = (client as any)._snapshotCache.size;
    expect(after).toBeLessThanOrEqual(before + 2);
  });

  it('rapid mount/unmount of same key preserves observerCount', async () => {
    const client = new QueryClient();
    const key = ['stress-observer'];

    const getObsCount = () => {
      const entry = (client as any)._cache.get(key);
      return entry ? entry.observerCount : 0;
    };

    for (let i = 0; i < 20; i++) {
      const { unmount } = renderHook(
        () =>
          useQuery({
            queryKey: key,
            queryFn: async () => 'data',
          }),
        {
          wrapper: ({ children }) => (
            <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
          ),
        },
      );
      await act(async () => {});
      await new Promise((r) => setTimeout(r, 10));
      unmount();
      await act(async () => {});
    }

    expect(getObsCount()).toBe(0);
  });
});
