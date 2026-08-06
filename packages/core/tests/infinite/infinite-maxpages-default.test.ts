import { describe, it, expect, vi } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

/**
 * BUG-3 regression suite — `maxPages` retention.
 *
 * Red-phase tests (fail on HEAD): the `maxPages ?? Infinity` default retains
 * every fetched page for the query lifetime (unbounded memory growth on
 * long-lived infinite queries), and a `NaN` `maxPages` is treated as
 * unbounded.
 *
 * Parity tests: the explicit `maxPages: Infinity` opt-out and the explicit
 * finite-cap behavior must be preserved by the fix.
 */
const TOTAL_PAGES = 55;

function makeQuery(options: { maxPages?: number } = {}) {
  return new InfiniteQuery({
    queryKey: ['pages'],
    queryFn: async ({ pageParam }) => ({ page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (_: unknown, __: unknown, lastParam: unknown) =>
      (lastParam as number) < 99 ? (lastParam as number) + 1 : undefined,
    ...options,
  });
}

async function fetchMany(query: InfiniteQuery<{ page: number }, number>, count: number) {
  await query.fetch();
  for (let i = 1; i < count; i++) {
    const ok = await query.fetchNextPage();
    if (!ok) break;
  }
}

describe('InfiniteQuery maxPages retention (BUG-3)', () => {
  describe('red-phase: default and NaN retention must be bounded', () => {
    it('M1: default retains at most 50 pages — oldest pages are evicted', async () => {
      const query = makeQuery();
      await fetchMany(query, TOTAL_PAGES);

      // On HEAD (default Infinity) this is 55 and data starts at page 0.
      expect(query.pageCount).toBeLessThanOrEqual(50);
      expect(query.pageCount).toBeGreaterThan(0);
      const pages = query.data;
      expect(pages[0]).toEqual({ page: TOTAL_PAGES - pages.length });
    });

    it('M2: a NaN maxPages is treated as the bounded default, not unbounded', async () => {
      const query = makeQuery({ maxPages: Number.NaN });
      await fetchMany(query, TOTAL_PAGES);

      expect(query.pageCount).toBeLessThanOrEqual(50);
      expect(query.pageCount).toBeGreaterThan(0);
    });
  });

  describe('parity: explicit retention semantics preserved', () => {
    it('M3: explicit maxPages: Infinity keeps all pages (documented opt-out)', async () => {
      const query = makeQuery({ maxPages: Infinity });
      await fetchMany(query, TOTAL_PAGES);

      expect(query.pageCount).toBe(TOTAL_PAGES);
      expect(query.data).toHaveLength(TOTAL_PAGES);
    });

    it('M4: explicit finite cap is honored', async () => {
      const query = makeQuery({ maxPages: 3 });
      await fetchMany(query, TOTAL_PAGES);

      expect(query.pageCount).toBe(3);
      expect(query.data).toEqual([
        { page: TOTAL_PAGES - 3 },
        { page: TOTAL_PAGES - 2 },
        { page: TOTAL_PAGES - 1 },
      ]);
    });

    it('M5: maxPages below the default never evicts pages under its own cap', async () => {
      const query = makeQuery({ maxPages: 100 });
      await fetchMany(query, TOTAL_PAGES);

      expect(query.pageCount).toBe(TOTAL_PAGES);
    });

    it('M6: a non-positive maxPages behaves as a minimum cap of 1 page', async () => {
      const zero = makeQuery({ maxPages: 0 });
      await fetchMany(zero, 5);
      expect(zero.pageCount).toBe(1);

      const negative = makeQuery({ maxPages: -3 });
      await fetchMany(negative, 5);
      expect(negative.pageCount).toBe(1);
    });

    it('M7: pageIndex stays contiguous after default-cap eviction', async () => {
      const query = makeQuery({ maxPages: 3 });
      await fetchMany(query, 10);

      const indices = query.state.pages.map((p) => p.pageIndex);
      expect(indices).toEqual([0, 1, 2]);
      expect(query.state.pageParams).toHaveLength(3);
    });

    it('M8: destroy releases retained page references', async () => {
      const held: WeakRef<object>[] = [];
      const query = new InfiniteQuery({
        queryKey: ['gc'],
        queryFn: async ({ pageParam }) => {
          const payload = { page: pageParam };
          held.push(new WeakRef(payload));
          return payload;
        },
        initialPageParam: 0,
        getNextPageParam: (_: unknown, __: unknown, lastParam: unknown) =>
          (lastParam as number) + 1,
        maxPages: 5,
      });
      await fetchMany(query, 6);

      const beforeDestroy = query.pageCount;
      expect(beforeDestroy).toBeGreaterThan(0);
      const spy = vi.fn();
      query.subscribe(spy);
      query.destroy();
      expect(query.isDestroyed).toBe(true);
      expect(query.pageCount).toBe(0);
    });
  });
});
