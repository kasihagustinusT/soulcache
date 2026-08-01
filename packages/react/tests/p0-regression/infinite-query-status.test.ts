// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { useInfiniteQuery } from '../../src/use-infinite-query';

describe('useInfiniteQuery status must reflect actual state', () => {
  it('should return "loading" when no pages and no error', () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test'],
        queryFn: async () => {
          return { items: [], nextCursor: undefined };
        },
        getNextPageParam: () => undefined,
        initialPageParam: 0,
        enabled: false,
      }),
    );

    expect(result.current.status).toBe('loading');
    expect(result.current.error).toBeNull();
  });

  it('should return "success" when pages exist', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test'],
        queryFn: async () => {
          return { items: ['a', 'b'], nextCursor: undefined };
        },
        getNextPageParam: () => undefined,
        initialPageParam: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.pages.length).toBeGreaterThan(0);
    });
  });

  it('should return "error" when fetch fails', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test-error'],
        queryFn: async () => {
          throw new Error('Network error');
        },
        getNextPageParam: () => undefined,
        initialPageParam: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeDefined();
      expect(result.current.error!.message).toBe('Network error');
    });
  });

  it('should NOT return "error" for successful fetch', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test-success'],
        queryFn: async () => {
          return { items: ['data'], nextCursor: undefined };
        },
        getNextPageParam: () => undefined,
        initialPageParam: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.error).toBeNull();
    });
  });

  it('should distinguish initial error from fetchNextPage error', async () => {
    let callCount = 0;

    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test-mixed'],
        queryFn: async ({ pageParam }) => {
          callCount++;
          if (callCount === 1) {
            return { items: ['page-0'], nextCursor: 1 };
          }
          throw new Error('Page 2 failed');
        },
        getNextPageParam: (_last, _all, lastParam) => (lastParam as number) + 1,
        initialPageParam: 0,
      }),
    );

    // Initial fetch should succeed
    await waitFor(() => {
      expect(result.current.status).toBe('success');
      expect(result.current.pages.length).toBe(1);
    });

    // fetchNextPage should fail
    await result.current.fetchNextPage();

    // Status should still be 'success' because we have pages
    // But error should be set
    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.error!.message).toBe('Page 2 failed');
    });
  });

  it('should handle empty pages array as loading', () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test-empty'],
        queryFn: async () => ({ items: [], nextCursor: undefined }),
        getNextPageParam: () => undefined,
        initialPageParam: 0,
        enabled: false,
      }),
    );

    // No pages, no error → loading
    expect(result.current.status).toBe('loading');
    expect(result.current.data).toBeUndefined();
  });

  it('should return correct page count', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test-count'],
        queryFn: async () => ({ items: ['a'], nextCursor: undefined }),
        getNextPageParam: () => undefined,
        initialPageParam: 0,
      }),
    );

    await waitFor(() => {
      expect(result.current.pageCount).toBe(1);
      expect(result.current.pages.length).toBe(1);
    });
  });

  it('should expose isFetching based on page fetch state', async () => {
    const { result } = renderHook(() =>
      useInfiniteQuery({
        queryKey: ['test-fetching'],
        queryFn: async () => ({ items: ['a'], nextCursor: undefined }),
        getNextPageParam: () => undefined,
        initialPageParam: 0,
      }),
    );

    // Before fetch completes, isFetchingNextPage should be false
    // (initial fetch uses fetch(), not fetchNextPage)
    expect(result.current.isFetchingNextPage).toBe(false);
    expect(result.current.isFetchingPreviousPage).toBe(false);
  });
});
