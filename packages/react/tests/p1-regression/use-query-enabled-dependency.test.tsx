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

describe('enabled dependency triggers fetch on transition', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('enabled: false → true triggers a fetch', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: ['enabled-toggle'],
          queryFn: async () => {
            fetchCount++;
            return 'data';
          },
          enabled,
        }),
      { wrapper, initialProps: { enabled: false } },
    );

    // Initially no fetch
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCount).toBe(0);
    expect(result.current.isIdle).toBe(true);

    // Toggle enabled to true
    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchCount).toBe(1);
    expect(result.current.data).toBe('data');
  });

  it('enabled: true → false → true does not re-fetch cached data', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: ['enabled-double-toggle'],
          queryFn: async () => {
            fetchCount++;
            return `data-${fetchCount}`;
          },
          enabled,
        }),
      { wrapper, initialProps: { enabled: true } },
    );

    // Initial fetch succeeds
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(fetchCount).toBe(1);

    // Toggle off
    rerender({ enabled: false });
    await new Promise((r) => setTimeout(r, 50));

    // Toggle back on — effect re-runs but data is cached, status is 'success'
    rerender({ enabled: true });
    await new Promise((r) => setTimeout(r, 100));

    // Should NOT refetch — data is still valid
    expect(fetchCount).toBe(1);
    expect(result.current.data).toBe('data-1');
  });

  it('enabled: false prevents initial fetch', async () => {
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['enabled-false-initial'],
          queryFn: async () => {
            fetchCount++;
            return 'data';
          },
          enabled: false,
        }),
      { wrapper },
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(fetchCount).toBe(0);
    expect(result.current.isIdle).toBe(true);
  });

  it('enabled change does not double-fetch when data is already cached', async () => {
    client.setQueryData(['enabled-cached'], 'pre-cached');
    const { wrapper } = createWrapper(client);
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: ['enabled-cached'],
          queryFn: async () => {
            fetchCount++;
            return 'fresh';
          },
          enabled,
        }),
      { wrapper, initialProps: { enabled: false } },
    );

    // Should have cached data immediately
    expect(result.current.data).toBe('pre-cached');

    // Toggle enabled — query already has data, status is not 'idle'
    rerender({ enabled: true });
    await new Promise((r) => setTimeout(r, 100));

    // Should not refetch because status is 'success', not 'idle'
    expect(fetchCount).toBe(0);
    expect(result.current.data).toBe('pre-cached');
  });

  it('enabled: true on mount fetches immediately', async () => {
    const { wrapper } = createWrapper(client);

    const { result } = renderHook(
      () =>
        useQuery({
          queryKey: ['enabled-true-mount'],
          queryFn: async () => 'immediate-data',
          enabled: true,
        }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe('immediate-data');
  });
});
