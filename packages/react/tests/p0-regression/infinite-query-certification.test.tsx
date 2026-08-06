// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useInfiniteQuery } from '../../src/use-infinite-query';

/**
 * Stage 05 certification — React adapter + BUG-3 cap through the hook.
 * Independent mount/unmount and re-subscription validation.
 */

type PageData = { page: number; nextCursor: number | null };

function makeFn(key: string) {
  let calls = 0;
  return {
    calls: () => calls,
    hook: (maxPages?: number) =>
      useInfiniteQuery<PageData, number>({
        queryKey: [key],
        queryFn: async ({ pageParam }) => {
          calls++;
          return { page: pageParam, nextCursor: pageParam < 100 ? pageParam + 1 : null };
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        initialPageParam: 0,
        ...(maxPages !== undefined ? { maxPages } : {}),
      }),
  };
}

describe('CER: useInfiniteQuery + maxPages (BUG-3)', () => {
  it('R1: explicit small cap is enforced through the hook', async () => {
    const { hook } = makeFn('r1');
    const { result } = renderHook(() => hook(3));

    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));
    await act(async () => {
      for (let i = 0; i < 5; i++) await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.pageCount).toBe(3));
    expect(result.current.pages.map((p) => p.pageParam)).toEqual([3, 4, 5]);
    expect(result.current.data).toEqual([
      { page: 3, nextCursor: 4 },
      { page: 4, nextCursor: 5 },
      { page: 5, nextCursor: 6 },
    ]);
    expect(result.current.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2]);
  });

  it('R2: repeated mount/unmount cycles re-subscribe with no stale data or leaks', async () => {
    const { hook, calls } = makeFn('r2');
    for (let cycle = 0; cycle < 3; cycle++) {
      const { result, unmount } = renderHook(() => hook());
      await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));
      await act(async () => {
        await result.current.fetchNextPage();
      });
      await waitFor(() => expect(result.current.pageCount).toBe(2));
      // Each mount fetches the initial page fresh (calls grow per cycle)
      unmount();
    }
    // Initial fetch per cycle (3) + one fetchNextPage per cycle (3)
    expect(calls()).toBe(6);
  });

  it('R3: default cap (no maxPages) applies through the hook', async () => {
    const { hook } = makeFn('r3');
    const { result } = renderHook(() => hook());
    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));
    await act(async () => {
      for (let i = 0; i < 60; i++) await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.pageCount).toBe(50));
    expect(result.current.pages[0]!.pageParam).toBe(11);
    expect(result.current.pages[49]!.pageParam).toBe(60);
  });

  it('R4: key change destroys the old query — no cross-key page bleed', async () => {
    let mode = 'a' as string;
    const a = makeFn('r4a');
    const b = makeFn('r4b');
    const { result, rerender } = renderHook(() => (mode === 'a' ? a.hook() : b.hook()));

    await waitFor(() => expect(result.current.pages.length).toBeGreaterThan(0));
    mode = 'b';
    rerender();
    await waitFor(() => expect(result.current.pages.length).toBe(0));
    await waitFor(() => expect(result.current.pages.length).toBe(1));
    expect(result.current.pages[0]!.data).toEqual({ page: 0, nextCursor: 1 });
  });
});
