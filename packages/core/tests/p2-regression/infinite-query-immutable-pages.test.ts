import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

describe('InfiniteQuery immutable page arrays', () => {
  it('state.pages reference changes after fetchNextPage', async () => {
    const query = new InfiniteQuery<{ items: string[] }>({
      queryKey: ['imm', 'next'],
      queryFn: async ({ pageParam }) => ({ items: [`page-${pageParam}`] }),
      getNextPageParam: (_last, _all, lastParam) => (lastParam as number) + 1,
      initialPageParam: 0,
    });

    await query.fetch();
    const stateBefore = query.state;
    const pagesBefore = stateBefore.pages;

    await query.fetchNextPage();
    const stateAfter = query.state;

    // Pages should be a different array reference (immutable update)
    expect(stateAfter.pages).not.toBe(pagesBefore);
    expect(stateAfter.pages.length).toBe(2);
    expect(stateAfter.pages[0]).toEqual(pagesBefore[0]);
  });

  it('state.pages reference changes after fetchPreviousPage', async () => {
    const query = new InfiniteQuery<{ items: string[] }>({
      queryKey: ['imm', 'prev'],
      queryFn: async ({ pageParam }) => ({ items: [`page-${pageParam}`] }),
      getNextPageParam: (_last, _all, lastParam) => (lastParam as number) + 1,
      getPreviousPageParam: (_first, _all, firstParam) => (firstParam as number) - 1,
      initialPageParam: 5,
    });

    // Fetch initial and next pages first
    await query.fetch();
    await query.fetchNextPage();
    const stateBefore = query.state;
    const pagesBefore = stateBefore.pages;

    await query.fetchPreviousPage();
    const stateAfter = query.state;

    // Pages should be a different array reference
    expect(stateAfter.pages).not.toBe(pagesBefore);
    expect(stateAfter.pages.length).toBe(3);
  });

  it('maxPages enforcement does not mutate original array', async () => {
    const query = new InfiniteQuery<{ items: string[] }>({
      queryKey: ['imm', 'max'],
      queryFn: async ({ pageParam }) => ({ items: [`page-${pageParam}`] }),
      getNextPageParam: (_last, _all, lastParam) => (lastParam as number) + 1,
      initialPageParam: 0,
      maxPages: 2,
    });

    await query.fetch();
    const state1 = query.state;

    await query.fetchNextPage();
    const state2 = query.state;

    await query.fetchNextPage(); // Should evict page 0, keeping pages 1 and 2
    const state3 = query.state;

    expect(state3.pages.length).toBe(2);
    expect(state3.pages[0]!.pageParam).toBe(1);
    expect(state3.pages[1]!.pageParam).toBe(2);
  });

  it('destroy() clears all pages', async () => {
    const query = new InfiniteQuery<{ items: string[] }>({
      queryKey: ['imm', 'destroy'],
      queryFn: async ({ pageParam }) => ({ items: [`page-${pageParam}`] }),
      getNextPageParam: (_last, _all, lastParam) => (lastParam as number) + 1,
      initialPageParam: 0,
    });

    await query.fetch();
    await query.fetchNextPage();
    expect(query.state.pages.length).toBe(2);

    query.destroy();
    expect(query.state.pages.length).toBe(0);
    expect(query.state.pageParams.length).toBe(0);
    expect(query.isDestroyed).toBe(true);
  });
});
