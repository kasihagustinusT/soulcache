import { describe, it, expect, vi, afterEach } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

describe('InfiniteQuery isFetching tracks all fetch phases', () => {
  let query: InfiniteQuery<string, number>;

  afterEach(() => {
    if (query && !query.isDestroyed) query.destroy();
  });

  it('isFetching is false before any fetch', () => {
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => 'page-0',
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    expect(query.state.isFetching).toBe(false);
    expect(query.isFetching).toBe(false);
  });

  it('isFetching is true during initial fetch()', async () => {
    let resolveFetch!: (value: string) => void;
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: () =>
        new Promise<string>((r) => {
          resolveFetch = r;
        }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    const fetchPromise = query.fetch();
    // Need microtask to let fetch() start
    await new Promise((r) => setTimeout(r, 0));

    expect(query.isFetching).toBe(true);
    expect(query.state.isFetching).toBe(true);

    resolveFetch('page-0');
    await fetchPromise;

    expect(query.isFetching).toBe(false);
  });

  it('isFetching is false after initial fetch succeeds', async () => {
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => 'page-0',
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    await query.fetch();

    expect(query.isFetching).toBe(false);
    expect(query.state.isFetching).toBe(false);
  });

  it('isFetching is false after initial fetch fails', async () => {
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => {
        throw new Error('network error');
      },
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    await query.fetch().catch(() => {});

    expect(query.isFetching).toBe(false);
    expect(query.state.isFetching).toBe(false);
  });

  it('isFetching is true during fetchNextPage()', async () => {
    let resolvePage!: (value: string) => void;
    const pageFetch = new Promise<string>((r) => {
      resolvePage = r;
    });

    let callCount = 0;
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => {
        if (callCount === 0) {
          callCount++;
          return 'page-0';
        }
        return pageFetch;
      },
      initialPageParam: 0,
      getNextPageParam: (_last, _all, lastParam) => lastParam + 1,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);

    const nextPromise = query.fetchNextPage();
    await new Promise((r) => setTimeout(r, 0));

    expect(query.isFetching).toBe(true);
    expect(query.isFetchingNextPage).toBe(true);

    resolvePage('page-1');
    await nextPromise;

    expect(query.isFetching).toBe(false);
    expect(query.data).toEqual(['page-0', 'page-1']);
  });

  it('isFetching is false after fetchNextPage succeeds', async () => {
    let callCount = 0;
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => `page-${callCount++}`,
      initialPageParam: 0,
      getNextPageParam: (_last, _all, lastParam) => lastParam + 1,
    });

    await query.fetch();
    await query.fetchNextPage();

    expect(query.isFetching).toBe(false);
    expect(query.data).toEqual(['page-0', 'page-1']);
  });

  it('isFetching is true during fetchPreviousPage()', async () => {
    let resolvePage!: (value: string) => void;
    const pageFetch = new Promise<string>((r) => {
      resolvePage = r;
    });

    let callCount = 0;
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => {
        if (callCount === 0) {
          callCount++;
          return 'page-1';
        }
        return pageFetch;
      },
      initialPageParam: 1,
      getNextPageParam: (_last, _all, lastParam) => lastParam + 1,
      getPreviousPageParam: (_first, _all, firstParam) => firstParam - 1,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);

    const prevPromise = query.fetchPreviousPage();
    await new Promise((r) => setTimeout(r, 0));

    expect(query.isFetching).toBe(true);
    expect(query.isFetchingPreviousPage).toBe(true);

    resolvePage('page-0');
    await prevPromise;

    expect(query.isFetching).toBe(false);
    expect(query.data).toEqual(['page-0', 'page-1']);
  });

  it('isFetching is false after fetchPreviousPage succeeds', async () => {
    const callCount = 0;
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async ({ pageParam }) => `page-${pageParam}`,
      initialPageParam: 1,
      getNextPageParam: (_last, _all, lastParam) => lastParam + 1,
      getPreviousPageParam: (_first, _all, firstParam) => firstParam - 1,
    });

    await query.fetch();
    await query.fetchPreviousPage();

    expect(query.isFetching).toBe(false);
    expect(query.data).toEqual(['page-0', 'page-1']);
  });

  it('cancel() resets isFetching to false', async () => {
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => new Promise<string>(() => {}), // Never resolves
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    const fetchPromise = query.fetch();
    await new Promise((r) => setTimeout(r, 0));

    expect(query.isFetching).toBe(true);

    query.cancel();
    await fetchPromise.catch(() => {});

    expect(query.isFetching).toBe(false);
  });

  it('reset() resets isFetching to false', async () => {
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => 'page-0',
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);

    query.reset();
    expect(query.isFetching).toBe(false);
    expect(query.state.pages).toEqual([]);
  });

  it('isFetching appears in state snapshot', async () => {
    query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async () => 'page-0',
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    const state = query.state;
    expect(state).toHaveProperty('isFetching');
    expect(state.isFetching).toBe(false);
  });
});
