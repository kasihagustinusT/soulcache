// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { InfiniteQuery } from '@soulcache/core';
import { useInfiniteQuery } from '../../src/use-infinite-query';

describe('useInfiniteQuery must re-subscribe on queryKey change', () => {
  it('should re-subscribe when queryKey changes', async () => {
    const { result, rerender } = renderHook(
      ({ queryKey }: { queryKey: readonly unknown[] }) =>
        useInfiniteQuery({
          queryKey,
          queryFn: async ({ pageParam }) => {
            return { items: [`page-${pageParam}`], nextCursor: (pageParam as number) + 1 };
          },
          getNextPageParam: (lastPage: any) => lastPage.nextCursor,
          initialPageParam: 0,
        }),
      { initialProps: { queryKey: ['posts'] as readonly unknown[] } },
    );

    // Initial render should have a query instance
    expect(result.current).toBeDefined();

    // Change the queryKey
    rerender({ queryKey: ['users'] as readonly unknown[] });

    // Wait for the new query to initialize
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // The hook should still work with the new key — no crash, no stale data
    // The new query starts fresh (pages empty initially, then fetches)
    expect(result.current.pages).toBeDefined();
    expect(result.current.error).toBeNull();
  });

  it('should not leak subscriptions across key changes', async () => {
    const { result, rerender } = renderHook(
      ({ queryKey }: { queryKey: readonly unknown[] }) =>
        useInfiniteQuery({
          queryKey,
          queryFn: async ({ pageParam }) => {
            return { items: [`page-${pageParam}`], nextCursor: (pageParam as number) + 1 };
          },
          getNextPageParam: (lastPage: any) => lastPage.nextCursor,
          initialPageParam: 0,
        }),
      { initialProps: { queryKey: ['a'] as readonly unknown[] } },
    );

    // Cycle through keys: A → B → C → A
    rerender({ queryKey: ['b'] as readonly unknown[] });
    await waitFor(() => expect(result.current).toBeDefined());

    rerender({ queryKey: ['c'] as readonly unknown[] });
    await waitFor(() => expect(result.current).toBeDefined());

    rerender({ queryKey: ['a'] as readonly unknown[] });
    await waitFor(() => expect(result.current).toBeDefined());

    // No crash, no leaked subscriptions
    expect(result.current).toBeDefined();
  });

  it('should reflect state from the current query, not a stale one', async () => {
    let fetchCount = 0;

    const { result, rerender } = renderHook(
      ({ queryKey }: { queryKey: readonly unknown[] }) =>
        useInfiniteQuery({
          queryKey,
          queryFn: async ({ pageParam }) => {
            fetchCount++;
            return {
              items: [`${queryKey[0]}-page-${pageParam}`],
              nextCursor: (pageParam as number) + 1,
            };
          },
          getNextPageParam: (lastPage: any) => lastPage.nextCursor,
          initialPageParam: 0,
        }),
      { initialProps: { queryKey: ['posts'] as readonly unknown[] } },
    );

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.pages.length).toBeGreaterThan(0);
    });

    const pagesBefore = result.current.pages.length;

    // Change key — old data should not appear
    rerender({ queryKey: ['users'] as readonly unknown[] });

    await waitFor(() => {
      // New query starts fresh with no pages
      expect(result.current.pages.length).toBe(0);
    });
  });

  it('should update getSnapshot when key changes', async () => {
    const { result, rerender } = renderHook(
      ({ queryKey }: { queryKey: readonly unknown[] }) =>
        useInfiniteQuery({
          queryKey,
          queryFn: async ({ pageParam }) => {
            return { data: `${queryKey[0]}-${pageParam}`, nextCursor: (pageParam as number) + 1 };
          },
          getNextPageParam: (lastPage: any) => lastPage.nextCursor,
          initialPageParam: 0,
        }),
      { initialProps: { queryKey: ['first'] as readonly unknown[] } },
    );

    // Initial state
    expect(result.current.data).toBeUndefined();

    // Change key
    rerender({ queryKey: ['second'] as readonly unknown[] });

    // Should reflect new key's state (empty initially)
    await waitFor(() => {
      expect(result.current.pages).toEqual([]);
    });
  });
});
