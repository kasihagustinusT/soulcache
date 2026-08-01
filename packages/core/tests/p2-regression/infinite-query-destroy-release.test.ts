import { describe, it, expect, beforeEach } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

describe('InfiniteQuery.destroy() releases data', () => {
  it('destroy releases pages array', async () => {
    const query = new InfiniteQuery({
      queryKey: ['new-15', 'pages'],
      queryFn: async ({ pageParam }: { pageParam: number }) => ({ page: pageParam }),
      getNextPageParam: (lastPage: any) => (lastPage ? lastPage.page + 1 : 1),
      getPreviousPageParam: (firstPage: any) => (firstPage ? firstPage.page - 1 : undefined),
      initialPageParam: 0,
    });

    await query.fetchNextPage();
    await query.fetchNextPage();

    const stateBefore = query.state;
    expect(stateBefore.pages.length).toBe(2);

    query.destroy();

    const stateAfter = query.state;
    expect(stateAfter.pages).toEqual([]);
  });

  it('destroy releases pageParams array', async () => {
    const query = new InfiniteQuery({
      queryKey: ['new-15', 'params'],
      queryFn: async ({ pageParam }: { pageParam: number }) => ({ page: pageParam }),
      getNextPageParam: (lastPage: any) => (lastPage ? lastPage.page + 1 : 1),
      getPreviousPageParam: (firstPage: any) => (firstPage ? firstPage.page - 1 : undefined),
      initialPageParam: 0,
    });

    await query.fetchNextPage();

    query.destroy();

    const stateAfter = query.state;
    expect(stateAfter.pageParams).toEqual([]);
  });

  it('destroy releases error', async () => {
    const query = new InfiniteQuery({
      queryKey: ['new-15', 'error'],
      queryFn: async () => {
        throw new Error('test');
      },
      getNextPageParam: () => 1,
      getPreviousPageParam: () => undefined,
      initialPageParam: 0,
    });

    try {
      await query.fetchNextPage();
    } catch {
      // expected
    }

    query.destroy();

    const stateAfter = query.state;
    expect(stateAfter.error).toBeNull();
  });

  it('destroy during active fetch: no crash', async () => {
    const query = new InfiniteQuery({
      queryKey: ['new-15', 'active'],
      queryFn: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { page: 0 };
      },
      getNextPageParam: () => 1,
      getPreviousPageParam: () => undefined,
      initialPageParam: 0,
    });

    query.fetchNextPage(); // don't await
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should not throw
    query.destroy();
  });

  it('repeated destroy: no double-clear error', async () => {
    const query = new InfiniteQuery({
      queryKey: ['new-15', 'repeat'],
      queryFn: async () => ({ page: 0 }),
      getNextPageParam: () => 1,
      getPreviousPageParam: () => undefined,
      initialPageParam: 0,
    });

    query.destroy();
    query.destroy(); // should not throw
  });
});
