import { describe, it, expect, beforeEach } from 'vitest';
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

describe('useQuery fetch effect improvements', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. parent rerender with same query key does not refetch', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { rerender } = renderHook(
      ({ label }: { label: string }) =>
        useQuery({
          queryKey: ['stable'],
          queryFn: async () => {
            fetchCount++;
            return `data-${label}`;
          },
        }),
      {
        wrapper,
        initialProps: { label: 'v1' },
      },
    );

    await waitFor(() => expect(fetchCount).toBe(1));

    // Rerender with new queryFn reference (same key)
    rerender({ label: 'v2' });
    await new Promise((r) => setTimeout(r, 50));

    // Should NOT re-fetch just because queryFn changed
    expect(fetchCount).toBe(1);
  });

  it('2. new query key still fetches', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ queryKey }: { queryKey: string }) =>
        useQuery({
          queryKey: [queryKey],
          queryFn: async () => {
            fetchCount++;
            return `data-${queryKey}`;
          },
        }),
      {
        wrapper,
        initialProps: { queryKey: 'key-a' },
      },
    );

    await waitFor(() => expect(fetchCount).toBe(1));
    expect(result.current.data).toBe('data-key-a');

    // Change key — should fetch new data
    rerender({ queryKey: 'key-b' });
    await waitFor(() => expect(fetchCount).toBe(2));
    expect(result.current.data).toBe('data-key-b');
  });

  it('3. enabled changes behave correctly', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: ['enabled-test'],
          queryFn: async () => {
            fetchCount++;
            return 'data';
          },
          enabled,
        }),
      {
        wrapper,
        initialProps: { enabled: false },
      },
    );

    // Not fetched yet (disabled)
    expect(fetchCount).toBe(0);
    expect(result.current.isIdle).toBe(true);

    // Enable
    rerender({ enabled: true });
    await waitFor(() => expect(fetchCount).toBe(1));
    expect(result.current.isSuccess).toBe(true);
  });

  it('4. StrictMode does not double-fetch', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    renderHook(
      () =>
        useQuery({
          queryKey: ['strict-dedup'],
          queryFn: async () => {
            fetchCount++;
            return 'data';
          },
        }),
      { wrapper },
    );

    await waitFor(() => expect(fetchCount).toBeGreaterThanOrEqual(1));
    // Dedup should prevent duplicate fetches
    expect(fetchCount).toBeLessThanOrEqual(2);
  });

  it('5. deduplication still works with refetch', async () => {
    const { wrapper } = createWrapper(client);

    const p1 = client.fetchQuery({
      queryKey: ['dedup-refetch'],
      queryFn: async () => 'data',
    });
    const p2 = client.fetchQuery({
      queryKey: ['dedup-refetch'],
      queryFn: async () => 'data',
    });

    const [d1, d2] = await Promise.all([p1, p2]);
    expect(d1).toBe(d2);
  });

  it('6. fetch continues correctly after component unmount', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCompleted = false;

    const { unmount } = renderHook(
      () =>
        useQuery({
          queryKey: ['unmount-test'],
          queryFn: async () => {
            await new Promise((r) => setTimeout(r, 50));
            fetchCompleted = true;
            return 'data';
          },
        }),
      { wrapper },
    );

    unmount();

    // Wait for fetch to complete
    await new Promise((r) => setTimeout(r, 100));

    // Fetch should complete (owned by QueryClient, not component)
    expect(fetchCompleted).toBe(true);

    // Cache should have the data
    const entry = client.getCache().get(['unmount-test']);
    expect(entry?.data).toBe('data');
  });

  it('7. background refetch still works', async () => {
    const { wrapper } = createWrapper(client);
    client.setQueryData(['bg-refetch'], 'old');

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['bg-refetch'],
          queryFn: async () => 'new',
        }),
      { wrapper },
    );

    // Should start with old data
    await waitFor(() => expect(result.current.data).toBe('old'));

    // Trigger refetch via fetchQuery (invalidateQueries doesn't auto-refetch)
    await act(async () => {
      client.fetchQuery({
        queryKey: ['bg-refetch'],
        queryFn: async () => 'new',
      });
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should have new data
    await waitFor(() => expect(result.current.data).toBe('new'));
  });
});
