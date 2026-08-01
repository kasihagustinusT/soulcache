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

describe('mount/unmount fetch race safety', () => {
  it('unmount during fetch does not leak observers', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['race-obs'];
    let fetchResolve: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      fetchResolve = r;
    });

    const { unmount } = renderHook(
      () =>
        useQuery({
          queryKey: key,
          queryFn: async () => fetchPromise,
          enabled: true,
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await new Promise((r) => setTimeout(r, 10));

    unmount();

    await act(async () => {
      fetchResolve!('late-data');
      await new Promise((r) => setTimeout(r, 10));
    });

    // No observers should remain after unmount
    // SM may persist if cache entry exists (intentional — SM lives with entry)
    expect(client['_observers']?.size ?? 0).toBe(0);
  });

  it('late fetch after component replaced with same key does not overwrite', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['late-overwrite'];

    let slowResolve: (v: string) => void;
    const slowPromise = new Promise<string>((r) => {
      slowResolve = r;
    });

    // Start a fetch via the public API
    client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => slowPromise,
      })
      .catch(() => {});

    await new Promise((r) => setTimeout(r, 10));

    // Remove and recreate (simulates removeQuery + new authoritative data)
    client.removeQuery(key);
    client.setQueryData(key, 'authoritative');

    // Resolve the old fetch
    await act(async () => {
      slowResolve!('stale');
      await new Promise((r) => setTimeout(r, 10));
    });

    // Version guard + SM guard prevent stale overwrite
    const data = client.getQueryData<string>(key);
    expect(data).toBe('authoritative');
  });

  it('concurrent fetches deduplicate via pendingFetches', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['dedup-test'];
    let callCount = 0;

    let fetchResolve: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      fetchResolve = r;
    });

    // Start two concurrent fetches for the same key
    const p1 = client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        callCount++;
        return fetchPromise;
      },
    });

    const p2 = client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        callCount++; // Should never be called
        return 'second';
      },
    });

    // Dedup: both should receive the SAME promise
    await act(async () => {
      fetchResolve!('dedup-data');
      await new Promise((r) => setTimeout(r, 10));
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe('dedup-data');
    expect(r2).toBe('dedup-data');
    expect(callCount).toBe(1);
  });

  it('rapid 5× mount/unmount leaves no orphaned observers', async () => {
    const client = new QueryClient({ defaultOptions: { gcTime: 60_000 } });
    const key = ['rapid-5'];

    for (let i = 0; i < 5; i++) {
      const { unmount } = renderHook(
        () =>
          useQuery({
            queryKey: key,
            queryFn: async () => `data-${i}`,
            enabled: true,
          }),
        {
          wrapper: ({ children }) => (
            <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
          ),
        },
      );

      await new Promise((r) => setTimeout(r, 20));
      unmount();
    }

    // No orphaned observers after all cycles
    expect(client['_observers']?.size ?? 0).toBe(0);
  });
});
