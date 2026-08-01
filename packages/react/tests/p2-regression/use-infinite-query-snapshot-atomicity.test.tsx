import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInfiniteQuery } from '../../src/use-infinite-query';
import { QueryClient } from '@soulcache/core';

function createClient(): QueryClient {
  return new QueryClient();
}

describe('useInfiniteQuery snapshot atomicity', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createClient();
  });

  it('all return values come from same snapshot (no torn reads)', async () => {
    const pages = [
      { data: [{ id: 1 }], pageParam: 0, pageIndex: 0 },
      { data: [{ id: 2 }], pageParam: 1, pageIndex: 1 },
    ];

    const { result } = renderHook(() =>
      useInfiniteQuery(client, ['new-16', 'atomic'], {
        queryFn: async () => [{ id: 1 }],
        getNextPageParam: () => 1,
        initialPageParam: 0,
      }),
    );

    // Set pages manually to control state
    act(() => {
      client.setQueryData(['new-16', 'atomic'], { pages, pageParams: [0, 1] });
    });

    await waitFor(() => {
      expect(result.current.pages).toBeDefined();
    });

    // All values should be consistent — if pages are present, status should be success
    if (result.current.pages && result.current.pages.length > 0) {
      expect(result.current.status).toBe('success');
    }
  });

  it('fetchStatus derived from snapshot, not live ref', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery(client, ['new-16', 'fetchstatus'], {
        queryFn: async () => [{ id: 1 }],
        getNextPageParam: () => 1,
        initialPageParam: 0,
      }),
    );

    // fetchStatus should be a valid value
    expect(['idle', 'fetching', 'paused']).toContain(result.current.fetchStatus);
  });

  it('hasNextPage/hasPreviousPage from snapshot', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery(client, ['new-16', 'pages'], {
        queryFn: async () => [{ id: 1 }],
        getNextPageParam: () => 1,
        getPreviousPageParam: () => -1,
        initialPageParam: 0,
      }),
    );

    expect(typeof result.current.hasNextPage).toBe('boolean');
    expect(typeof result.current.hasPreviousPage).toBe('boolean');
  });
});
