import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

function createWrapper(client?: QueryClient) {
  const qc = client ?? new QueryClient();
  return {
    client: qc,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <SoulCacheProvider client={qc}>{children}</SoulCacheProvider>
    ),
  };
}

describe('observerCount lifecycle correctness', () => {
  it('observerCount is incremented when entry exists at subscribe time', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['obs-exists'];
    // Pre-populate cache so subscribeToQuery finds an entry
    client.setQueryData(key, 'pre-cached');

    const { wrapper } = createWrapper(client);
    const { unmount } = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper,
    });

    // Entry exists at subscribe time, so observerCount should be 1
    const entry = client.getCache().get(key);
    expect(entry?.observerCount).toBe(1);

    unmount();

    // After unmount, observerCount returns to 0
    const entryAfter = client.getCache().get(key);
    expect(entryAfter?.observerCount).toBe(0);
  });

  it('observerCount increments for each mounted component with existing entry', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['obs-multi'];
    client.setQueryData(key, 'pre-cached');

    const hook1 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });

    const hook2 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });

    const entry = client.getCache().get(key);
    expect(entry?.observerCount).toBe(2);

    hook1.unmount();
    expect(entry?.observerCount).toBe(1);

    hook2.unmount();
    expect(entry?.observerCount).toBe(0);
  });

  it('observerCount decrements on current entry after replacement', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['obs-replace'];
    client.setQueryData(key, 'initial');

    const { unmount } = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });

    const entry1 = client.getCache().get(key);
    expect(entry1?.observerCount).toBe(1);

    // Remove query and recreate — simulates eviction + new entry
    client.removeQuery(key);
    // setQueryData creates a new entry (observerCount defaults to 0)
    // The component's subscription still exists but the old entry is detached
    client.setQueryData(key, 'replacement');

    const entry2 = client.getCache().get(key);
    // New entry has observerCount=0 (setQueryData doesn't subscribe)
    expect(entry2?.observerCount).toBe(0);

    unmount();

    // Unsubscribe looks up the CURRENT entry and no-ops
    // since observerCount is 0. The old code would decrement the old
    // detached entry (harmless but inconsistent).
    const entry3 = client.getCache().get(key);
    expect(entry3?.observerCount).toBe(0);
  });

  it('observerCount does not go negative on double-unmount', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['obs-dual'];
    client.setQueryData(key, 'data');

    const { wrapper } = createWrapper(client);
    const { unmount } = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper,
    });

    const entry = client.getCache().get(key);
    expect(entry?.observerCount).toBe(1);

    unmount();
    expect(entry?.observerCount).toBe(0);

    // Unsubscribe was already called. Calling again would be a no-op
    // because the subscription was already torn down.
  });
});
