import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

describe('InfiniteQuery', () => {
  describe('construction', () => {
    it('should create with required options', () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => [{ id: 1 }],
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      });

      expect(query.id).toBeDefined();
      expect(query.queryKey).toEqual(['posts']);
      expect(query.hasNextPage).toBe(true);
      expect(query.hasPreviousPage).toBe(false);
      expect(query.isDestroyed).toBe(false);
      expect(query.pageCount).toBe(0);
    });

    it('should default initialPageParam to 0', () => {
      const query = new InfiniteQuery({
        queryKey: ['items'],
        queryFn: async () => ['a'],
        getNextPageParam: () => undefined,
      });

      expect(query.state.pageParams).toEqual([]);
    });
  });

  describe('fetch', () => {
    it('should fetch the first page', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => {
          return { items: [`page-${pageParam}`], nextCursor: (pageParam as number) + 1 };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage: any) => lastPage.nextCursor,
      });

      await query.fetch();

      expect(query.pageCount).toBe(1);
      expect(query.data).toEqual([{ items: ['page-0'], nextCursor: 1 }]);
      expect(query.hasNextPage).toBe(true);
    });

    it('should handle fetch error', async () => {
      const query = new InfiniteQuery({
        queryKey: ['fail'],
        queryFn: async () => {
          throw new Error('Network error');
        },
        initialPageParam: 0,
        getNextPageParam: () => undefined,
      });

      await query.fetch();

      expect(query.pageCount).toBe(0);
      expect(query.state.error?.message).toBe('Network error');
    });
  });

  describe('fetchNextPage', () => {
    it('should fetch the next page', async () => {
      let page = 0;
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => {
          return { data: `page-${pageParam}`, next: (pageParam as number) + 1 };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage: any) => lastPage.next,
      });

      await query.fetch();
      expect(query.pageCount).toBe(1);

      const fetched = await query.fetchNextPage();
      expect(fetched).toBe(true);
      expect(query.pageCount).toBe(2);
      expect(query.data).toEqual([
        { data: 'page-0', next: 1 },
        { data: 'page-1', next: 2 },
      ]);
    });

    it('should return false when no more pages', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => ({ data: 'only-page' }),
        initialPageParam: 0,
        getNextPageParam: () => undefined, // No next page
      });

      await query.fetch();

      const fetched = await query.fetchNextPage();
      expect(fetched).toBe(false);
      expect(query.pageCount).toBe(1);
    });

    it('should track fetching state', async () => {
      let callCount = 0;
      let resolveFn!: (value: any) => void;
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => {
          callCount++;
          if (callCount === 1) {
            return { data: 'page-0' };
          }
          return new Promise((resolve) => {
            resolveFn = resolve;
          });
        },
        initialPageParam: 0,
        getNextPageParam: () => 1,
      });

      await query.fetch(); // resolves immediately

      const fetchPromise = query.fetchNextPage(); // hangs
      expect(query.isFetchingNextPage).toBe(true);

      resolveFn({ data: 'page-1' });
      await fetchPromise;

      expect(query.isFetchingNextPage).toBe(false);
    });

    it('should enforce maxPages limit', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 0,
        getNextPageParam: (_: any, __: any, lastParam: any) => (lastParam as number) + 1,
        maxPages: 2,
      });

      await query.fetch(); // page 0
      await query.fetchNextPage(); // page 1
      await query.fetchNextPage(); // page 2 (should evict page 0)

      expect(query.pageCount).toBe(2);
      expect(query.data).toEqual([{ page: 1 }, { page: 2 }]);
    });
  });

  describe('fetchPreviousPage', () => {
    it('should fetch the previous page', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 2,
        getNextPageParam: (_: any, __: any, lastParam: any) =>
          (lastParam as number) < 5 ? (lastParam as number) + 1 : undefined,
        getPreviousPageParam: (_: any, __: any, firstParam: any) =>
          (firstParam as number) > 0 ? (firstParam as number) - 1 : undefined,
      });

      // Fetch page 2, then page 3
      await query.fetch();
      await query.fetchNextPage();
      expect(query.data).toEqual([{ page: 2 }, { page: 3 }]);

      // Fetch previous page (page 1)
      const fetched = await query.fetchPreviousPage();
      expect(fetched).toBe(true);
      expect(query.data).toEqual([{ page: 1 }, { page: 2 }, { page: 3 }]);
    });

    it('should return false when no previous pages', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 0,
        getNextPageParam: () => 1,
        getPreviousPageParam: () => undefined, // No previous page
      });

      await query.fetch();

      const fetched = await query.fetchPreviousPage();
      expect(fetched).toBe(false);
    });

    it('should be disabled when getPreviousPageParam not provided', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => ({}),
        initialPageParam: 0,
        getNextPageParam: () => 1,
      });

      expect(query.hasPreviousPage).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel in-flight fetches', async () => {
      let callCount = 0;
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => {
          callCount++;
          if (callCount === 1) {
            return { data: 'page-0' };
          }
          return new Promise(() => {}); // Never resolves
        },
        initialPageParam: 0,
        getNextPageParam: () => 1,
      });

      await query.fetch(); // resolves immediately

      const fetchPromise = query.fetchNextPage(); // hangs
      query.cancel();

      const result = await fetchPromise;
      expect(result).toBe(false);
      expect(query.isFetchingNextPage).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset state', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 0,
        getNextPageParam: () => 1,
      });

      await query.fetch();
      await query.fetchNextPage();
      expect(query.pageCount).toBe(2);

      query.reset();
      expect(query.pageCount).toBe(0);
      expect(query.data).toEqual([]);
      expect(query.hasNextPage).toBe(true);
    });
  });

  describe('subscribe', () => {
    it('should notify on state changes', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 0,
        getNextPageParam: () => 1,
      });

      const listener = vi.fn();
      query.subscribe(listener);

      await query.fetch();
      await query.fetchNextPage();

      // Multiple notifications: fetch start, page added, next fetch start, page added
      expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('destroy', () => {
    it('should mark as destroyed', () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => ({}),
        getNextPageParam: () => undefined,
      });

      query.destroy();
      expect(query.isDestroyed).toBe(true);
    });

    it('should prevent operations after destroy', async () => {
      const query = new InfiniteQuery({
        queryKey: ['posts'],
        queryFn: async () => ({}),
        getNextPageParam: () => undefined,
      });

      query.destroy();
      await expect(query.fetch()).rejects.toThrow('destroyed');
    });
  });

  describe('structural behavior', () => {
    it('should maintain page order after bidirectional fetch', async () => {
      const query = new InfiniteQuery({
        queryKey: ['items'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 2,
        getNextPageParam: (_: any, __: any, lastParam: any) =>
          (lastParam as number) < 4 ? (lastParam as number) + 1 : undefined,
        getPreviousPageParam: (_: any, __: any, firstParam: any) =>
          (firstParam as number) > 0 ? (firstParam as number) - 1 : undefined,
      });

      await query.fetch(); // page 2
      await query.fetchNextPage(); // page 3
      await query.fetchNextPage(); // page 4
      await query.fetchPreviousPage(); // page 1
      await query.fetchPreviousPage(); // page 0

      expect(query.data).toEqual([
        { page: 0 },
        { page: 1 },
        { page: 2 },
        { page: 3 },
        { page: 4 },
      ]);
    });

    it('should update has flags correctly', async () => {
      const query = new InfiniteQuery({
        queryKey: ['items'],
        queryFn: async ({ pageParam }) => ({ page: pageParam }),
        initialPageParam: 0,
        getNextPageParam: (_: any, __: any, lastParam: any) =>
          (lastParam as number) < 2 ? (lastParam as number) + 1 : undefined,
        getPreviousPageParam: () => undefined,
      });

      await query.fetch(); // page 0
      expect(query.hasNextPage).toBe(true);

      await query.fetchNextPage(); // page 1
      expect(query.hasNextPage).toBe(true);

      await query.fetchNextPage(); // page 2
      expect(query.hasNextPage).toBe(false);
    });
  });
});
