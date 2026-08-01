import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

describe('infinite query concurrency', () => {
  it('1. next + previous concurrently both succeed', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-concurrent'],
      queryFn: async ({ pageParam }) => {
        await new Promise((r) => setTimeout(r, 5));
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: (_last: unknown, _all: unknown[], lastParam: number) => {
        return lastParam < 5 ? lastParam + 1 : undefined;
      },
      getPreviousPageParam: (_first: unknown, _all: unknown[], firstParam: number) => {
        return firstParam > -3 ? firstParam - 1 : undefined;
      },
    });

    await query.fetch();
    expect(query.pageCount).toBe(1);
    expect(query.state.pageParams[0]).toBe(0);

    const [nextResult, prevResult] = await Promise.all([
      query.fetchNextPage(),
      query.fetchPreviousPage(),
    ]);

    expect(nextResult).toBe(true);
    expect(prevResult).toBe(true);
    expect(query.pageCount).toBe(3); // prev(-1), initial(0), next(1)
    expect(query.isFetching).toBe(false);
  });

  it('2. cancel cancels both directions', async () => {
    let resolveInitial!: (value: unknown) => void;

    const query = new InfiniteQuery({
      queryKey: ['test-cancel'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) {
          return new Promise((resolve) => {
            resolveInitial = resolve as (v: unknown) => void;
          });
        }
        return new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 30000);
        });
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    const fetchP = query.fetch();
    resolveInitial({ data: 'page-0' });
    await fetchP;

    const p1 = query.fetchNextPage();
    const p2 = query.fetchPreviousPage();

    await new Promise((r) => setTimeout(r, 20));
    expect(query.isFetching).toBe(true);

    // Cancel should abort both
    query.cancel();

    // Operations should settle (resolve false due to abort)
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
    expect(query.isFetching).toBe(false);
  });

  it('3. one succeeds while other fails independently', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-independent'],
      queryFn: async ({ pageParam }) => {
        await new Promise((r) => setTimeout(r, 5));
        if ((pageParam as number) < 0) throw new Error('Previous failed');
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: (_last: unknown, _all: unknown[], lastParam: number) => {
        return lastParam < 5 ? lastParam + 1 : undefined;
      },
      getPreviousPageParam: (_first: unknown, _all: unknown[], firstParam: number) => {
        return firstParam > -3 ? firstParam - 1 : undefined;
      },
    });

    await query.fetch();

    const [nextResult, prevResult] = await Promise.all([
      query.fetchNextPage(),
      query.fetchPreviousPage(),
    ]);

    expect(nextResult).toBe(true);
    expect(prevResult).toBe(false);
    expect(query.state.error).toBeInstanceOf(Error);
    expect(query.state.error!.message).toBe('Previous failed');
    expect(query.isFetching).toBe(false);
  });

  it('4. isFetching true while concurrent operations exist', async () => {
    let resolveNext!: (value: unknown) => void;
    let resolvePrev!: (value: unknown) => void;

    const query = new InfiniteQuery({
      queryKey: ['test-fetching-true'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) {
          return { data: 'page-0' };
        }
        return new Promise((resolve) => {
          if ((pageParam as number) > 0) {
            resolveNext = resolve as (value: unknown) => void;
          } else {
            resolvePrev = resolve as (value: unknown) => void;
          }
        });
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    const p2 = query.fetchPreviousPage();

    await new Promise((r) => setTimeout(r, 20));
    expect(query.isFetching).toBe(true);

    // Resolve only next
    resolveNext({ data: 'next' });
    await p1;

    // Still fetching because previous is pending
    expect(query.isFetching).toBe(true);
    expect(query.isFetchingNextPage).toBe(false);

    // Resolve previous
    resolvePrev({ data: 'prev' });
    await p2;

    // Now both done
    expect(query.isFetching).toBe(false);
  }, 10000);

  it('5. isFetching false only when all operations finish', async () => {
    let resolveFirst!: (value: unknown) => void;
    let resolveSecond!: (value: unknown) => void;

    const query = new InfiniteQuery({
      queryKey: ['test-fetching-false'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) {
          return { data: 'page-0' };
        }
        return new Promise((resolve) => {
          if ((pageParam as number) > 0) {
            resolveFirst = resolve as (value: unknown) => void;
          } else {
            resolveSecond = resolve as (value: unknown) => void;
          }
        });
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    const p2 = query.fetchPreviousPage();

    await new Promise((r) => setTimeout(r, 20));
    expect(query.isFetching).toBe(true);

    // Resolve next first
    resolveFirst({ data: 'next' });
    await p1;
    expect(query.isFetching).toBe(true);

    // Then resolve prev
    resolveSecond({ data: 'prev' });
    await p2;
    expect(query.isFetching).toBe(false);
  }, 10000);

  it('6. fetch during pagination resets correctly', async () => {
    let resolvePage!: (value: unknown) => void;

    const query = new InfiniteQuery({
      queryKey: ['test-fetch-reset'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 1) {
          return new Promise((resolve) => {
            resolvePage = resolve as (value: unknown) => void;
          });
        }
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
    });

    await query.fetch();
    expect(query.pageCount).toBe(1);

    const p1 = query.fetchNextPage();
    await new Promise((r) => setTimeout(r, 20));

    // Call fetch() which should cancel and reset
    await query.fetch();

    // Old operation should have been cancelled
    expect(query.isFetching).toBe(false);
    expect(query.pageCount).toBe(1); // Reset to initial

    // Resolve the old promise to avoid leak
    resolvePage({ data: 'stale' });
    await p1;
  }, 10000);

  it('7. controller cleanup after success', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-cleanup-success'],
      queryFn: async ({ pageParam }) => {
        await new Promise((r) => setTimeout(r, 5));
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: (_last: unknown, _all: unknown[], lastParam: number) => {
        return lastParam < 5 ? lastParam + 1 : undefined;
      },
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);

    await query.fetchNextPage();
    expect(query.isFetching).toBe(false);
    expect(query.pageCount).toBe(2);
  });

  it('8. controller cleanup after error', async () => {
    let callCount = 0;
    const query = new InfiniteQuery({
      queryKey: ['test-cleanup-error'],
      queryFn: async ({ pageParam }) => {
        callCount++;
        if (callCount === 1) return { data: 'page0' };
        throw new Error('Fetch failed');
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
    });

    await query.fetch();
    const result = await query.fetchNextPage();

    expect(result).toBe(false);
    expect(query.isFetching).toBe(false);
    expect(query.state.error).toBeInstanceOf(Error);
    expect(query.state.error!.message).toBe('Fetch failed');
  });

  it('9. controller cleanup after abort', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-cleanup-abort'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) return { data: 'page-0' };
        return new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 30000);
        });
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
    });

    await query.fetch();

    const p = query.fetchNextPage();
    await new Promise((r) => setTimeout(r, 20));

    query.cancel();

    const result = await p;
    expect(result).toBe(false);
    expect(query.isFetching).toBe(false);
  });

  it('10. destroy during concurrent operations aborts all', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-destroy'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) return { data: 'page-0' };
        return new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 30000);
        });
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    const p2 = query.fetchPreviousPage();

    await new Promise((r) => setTimeout(r, 20));

    query.destroy();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
    expect(query.isDestroyed).toBe(true);
  });

  it('11. reset during concurrent operations aborts all', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-reset'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) return { data: 'page-0' };
        return new Promise((_resolve, reject) => {
          setTimeout(() => reject(new Error('timeout')), 30000);
        });
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    const p2 = query.fetchPreviousPage();

    await new Promise((r) => setTimeout(r, 20));

    query.reset();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
    expect(query.isFetching).toBe(false);
    expect(query.pageCount).toBe(0);
  });

  it('12. rapid sequential nextPage remains correctly guarded', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-rapid'],
      queryFn: async ({ pageParam }) => {
        await new Promise((r) => setTimeout(r, 10));
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: (_last: unknown, _all: unknown[], lastParam: number) => {
        return lastParam < 5 ? lastParam + 1 : undefined;
      },
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    const p2 = await query.fetchNextPage(); // Should return false immediately (guard)

    expect(p2).toBe(false);

    await p1;
    expect(query.pageCount).toBe(2);
  });
});
