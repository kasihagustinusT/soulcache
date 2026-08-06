import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

/**
 * Navigation-flag staleness regression (found during Stage 05 certification).
 *
 * `_hasNextPage` / `_hasPreviousPage` are cached flags. They are recomputed
 * after append/prepend, but when a finite `maxPages` cap causes eviction, the
 * window edges slide and the COMPLEMENTARY flag goes stale:
 *
 *   - forward exhaustion then fetchPreviousPage evicts the newest page; the
 *     surviving last page again has a next page, but `hasNextPage` stays false.
 *   - backward exhaustion then fetchNextPage evicts the oldest page; the
 *     surviving first page again has a previous page, but `hasPreviousPage`
 *     stays false.
 *
 * With the pre-fix `Infinity` default this never fired (no eviction ever
 * occurred). The BUG-3 finite default activates windowing, so these scenarios
 * are now reachable by default for bidirectional consumers.
 */

type PageData = { page: number };

function makeQuery(options: { maxPages: number; first: number; last: number }) {
  return new InfiniteQuery<PageData, number>({
    queryKey: ['navflag', options.first, options.last],
    queryFn: async ({ pageParam }) => ({ page: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.page < options.last ? lastPage.page + 1 : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.page > options.first ? firstPage.page - 1 : undefined,
    maxPages: options.maxPages,
  });
}

describe('Navigation-flag staleness with finite maxPages (PR-D)', () => {
  it('F1: hasNextPage revives after backward eviction (forward exhaustion is not terminal)', async () => {
    const query = makeQuery({ maxPages: 3, first: 0, last: 6 });
    await query.fetch();
    for (let i = 0; i < 6; i++) await query.fetchNextPage();
    // window [4,5,6], hasNextPage === false (6 is the last page)
    expect(query.state.pageParams).toEqual([4, 5, 6]);
    expect(query.hasNextPage).toBe(false);

    // Backward fetch evicts page 6; page 5 now has a next page (6).
    await query.fetchPreviousPage();
    expect(query.state.pageParams).toEqual([3, 4, 5]);
    expect(query.hasNextPage).toBe(true);
  });

  it('F2: hasPreviousPage revives after forward eviction (backward exhaustion is not terminal)', async () => {
    const query = makeQuery({ maxPages: 3, first: -6, last: 6 });
    await query.fetch();
    for (let i = 0; i < 6; i++) await query.fetchPreviousPage();
    // window [-6,-5,-4], hasPreviousPage === false (-6 is the first page)
    expect(query.state.pageParams).toEqual([-6, -5, -4]);
    expect(query.hasPreviousPage).toBe(false);

    // Forward fetch evicts page -6; page -5 now has a previous page (-6).
    await query.fetchNextPage();
    expect(query.state.pageParams).toEqual([-5, -4, -3]);
    expect(query.hasPreviousPage).toBe(true);
  });

  it('F3: after revival, navigation resumes in the revived direction', async () => {
    const query = makeQuery({ maxPages: 3, first: 0, last: 6 });
    await query.fetch();
    for (let i = 0; i < 6; i++) await query.fetchNextPage();
    await query.fetchPreviousPage(); // window [3,4,5], hasNextPage revived
    expect(await query.fetchNextPage()).toBe(true);
    expect(query.state.pageParams).toEqual([4, 5, 6]);
  });
});
