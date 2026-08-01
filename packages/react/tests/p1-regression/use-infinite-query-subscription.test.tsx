import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, render, waitFor, act } from '@testing-library/react';
import React, { StrictMode, useState } from 'react';
import { SoulCacheProvider } from '../../src/context';
import { useInfiniteQuery } from '../../src/use-infinite-query';
import { QueryClient } from '@soulcache/core';

/**
 * useInfiniteQuery subscription broken on mount.
 *
 * useSyncExternalStore calls subscribe during React's commit phase (before
 * effects). If the InfiniteQuery instance is created inside useEffect,
 * queryRef.current is null when subscribe runs, producing a no-op.
 * The component is permanently stuck showing null data.
 *
 * Fix: Create InfiniteQuery synchronously during render via lazy-init ref,
 * and use a queryVersion counter to force re-subscribe after StrictMode
 * cleanup/re-create.
 */

function createWrapper(client?: QueryClient) {
  const qc = client ?? new QueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(SoulCacheProvider, { client: qc }, children);
  };
}

describe('useInfiniteQuery subscription on mount', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. receives data after initial fetch (not stuck null)', async () => {
    const { result } = renderHook(
      () =>
        useInfiniteQuery({
          queryKey: ['inf-06-basic'],
          queryFn: async ({ pageParam }) => {
            return { items: [`page-${pageParam}`], next: (pageParam as number) + 1 };
          },
          getNextPageParam: (lastPage: any) => lastPage.next,
          initialPageParam: 0,
        }),
      { wrapper: createWrapper(client) },
    );

    // Initially loading (query was created during render, fetch started in effect)
    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.pages).toHaveLength(1);
    expect(result.current.data).toEqual([{ items: ['page-0'], next: 1 }]);
  });

  it('2. StrictMode: subscription remains active and data is received', async () => {
    const { result } = renderHook(
      () =>
        useInfiniteQuery({
          queryKey: ['inf-06-strict'],
          queryFn: async ({ pageParam }) => {
            return { items: [`item-${pageParam}`], next: (pageParam as number) + 1 };
          },
          getNextPageParam: (lastPage: any) => lastPage.next,
          initialPageParam: 0,
        }),
      {
        wrapper: ({ children }) =>
          React.createElement(
            StrictMode,
            null,
            React.createElement(SoulCacheProvider, { client }, children),
          ),
      },
    );

    // Should still receive data after StrictMode double-effect
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(result.current.pages).toHaveLength(1);
    expect(result.current.data).toEqual([{ items: ['item-0'], next: 1 }]);
  });

  it('3. key change: old query destroyed, new subscription receives new data', async () => {
    let fetchLog: string[] = [];

    function KeyChanger() {
      const [key, setKey] = useState('a');
      const result = useInfiniteQuery({
        queryKey: ['inf-06-key', key],
        queryFn: async ({ pageParam }) => {
          fetchLog.push(`fetch-${key}`);
          return { value: `${key}-${pageParam}`, next: (pageParam as number) + 1 };
        },
        getNextPageParam: (lastPage: any) => lastPage.next,
        initialPageParam: 0,
      });
      return React.createElement(
        'div',
        null,
        React.createElement('span', { 'data-testid': 'data' }, JSON.stringify(result.data)),
        React.createElement(
          'button',
          { 'data-testid': 'switch', onClick: () => setKey('b') },
          'switch',
        ),
      );
    }

    const { getByTestId } = render(
      React.createElement(SoulCacheProvider, { client }, React.createElement(KeyChanger)),
    );

    await waitFor(() => {
      expect(getByTestId('data').textContent).toContain('a-0');
    });

    expect(fetchLog).toContain('fetch-a');

    // Switch key
    act(() => {
      getByTestId('switch').click();
    });

    await waitFor(() => {
      expect(getByTestId('data').textContent).toContain('b-0');
    });

    expect(fetchLog).toContain('fetch-b');
  });

  it('4. enabled=false: no fetch, no leak; enabled=true starts lifecycle', async () => {
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useInfiniteQuery({
          queryKey: ['inf-06-enabled'],
          queryFn: async ({ pageParam }) => {
            fetchCount++;
            return { value: `v-${pageParam}`, next: (pageParam as number) + 1 };
          },
          getNextPageParam: (lastPage: any) => lastPage.next,
          initialPageParam: 0,
          enabled,
        }),
      { wrapper: createWrapper(client), initialProps: { enabled: false } },
    );

    // No fetch when disabled
    expect(result.current.status).toBe('loading');
    expect(fetchCount).toBe(0);

    await new Promise((r) => setTimeout(r, 50));
    expect(fetchCount).toBe(0);

    // Enable → should start fetch
    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    expect(fetchCount).toBe(1);
    expect(result.current.pages).toHaveLength(1);
  });
});
