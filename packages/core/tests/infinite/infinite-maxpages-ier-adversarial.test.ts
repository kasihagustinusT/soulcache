import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

/**
 * IER — BUG-3 independent adversarial suite (Stage 04).
 *
 * Written independently from the bug report (POST_BATCH_M_ADVERSARIAL_AUDIT_V2
 * FINDING 1: `_maxPages` defaults to Infinity → unbounded retention). Intended
 * to be permanently retained as regression coverage. A1/A2 are the zero-trust
 * reproduction probes and MUST FAIL on the un-fixed tree.
 */

type PageData = { page: number };

const TOTAL = 55;
const LAST = 200;

function makeQuery(options: { maxPages?: number; previous?: boolean } = {}) {
  const prev = options.previous ?? false;
  return new InfiniteQuery<PageData, number>({
    queryKey: ['ier', String(options.maxPages ?? 'default')],
    queryFn: async ({ pageParam }) => ({ page: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _all, _lastParam) =>
      lastPage.page < LAST ? lastPage.page + 1 : undefined,
    getPreviousPageParam: prev
      ? (firstPage, _all, _firstParam) =>
          firstPage.page > -LAST ? firstPage.page - 1 : undefined
      : undefined,
    ...(options.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
  });
}

async function fetchForward(query: InfiniteQuery<PageData, number>, count: number) {
  await query.fetch();
  for (let i = 1; i < count; i++) {
    await query.fetchNextPage();
  }
}

describe('IER: InfiniteQuery maxPages (BUG-3) adversarial', () => {
  describe('zero-trust reproduction — must be RED without the fix', () => {
    it('A1: default (no maxPages) bounds retained pages to 50', async () => {
      const query = makeQuery();
      await fetchForward(query, TOTAL);
      expect(query.pageCount).toBeLessThanOrEqual(50);
      expect(query.pageCount).toBeGreaterThan(0);
    });

    it('A2: NaN maxPages must not act as unbounded', async () => {
      const query = makeQuery({ maxPages: Number.NaN });
      await fetchForward(query, TOTAL);
      expect(query.pageCount).toBeLessThanOrEqual(50);
      expect(query.pageCount).toBeGreaterThan(0);
    });
  });

  describe('window integrity and ordering', () => {
    it('A3: forward+backward navigation respects cap with contiguous pageIndex', async () => {
      const query = makeQuery({ maxPages: 5, previous: true });
      await fetchForward(query, 10); // params 5..9 retained

      expect(query.pageCount).toBe(5);
      expect(query.state.pageParams).toEqual([5, 6, 7, 8, 9]);
      expect(query.state.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2, 3, 4]);

      for (let i = 0; i < 3; i++) {
        await query.fetchPreviousPage();
      }
      // window slides left: [5..9] -> after 3 backward fetches -> [2..6]
      expect(query.pageCount).toBe(5);
      expect(query.state.pageParams).toEqual([2, 3, 4, 5, 6]);
      expect(query.state.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2, 3, 4]);
      expect(query.data.map((d) => d.page)).toEqual([2, 3, 4, 5, 6]);
    });

    it('A4: cap of 1 is the minimum — never empties the window', async () => {
      for (const raw of [1, 0, -3]) {
        const query = makeQuery({ maxPages: raw });
        await fetchForward(query, 5);
        expect(query.pageCount).toBe(1);
        expect(query.data).toEqual([{ page: 4 }]);
      }
    });

    it('A5: -Infinity is normalized to the minimum cap of 1', async () => {
      const query = makeQuery({ maxPages: -Infinity });
      await fetchForward(query, 5);
      expect(query.pageCount).toBe(1);
    });

    it('A6: fractional maxPages is floored (2.5 -> 2)', async () => {
      const query = makeQuery({ maxPages: 2.5 });
      await fetchForward(query, 6);
      expect(query.pageCount).toBe(2);
      expect(query.state.pageParams).toEqual([4, 5]);
    });

    it('A7: forward window slide preserves order and drops oldest', async () => {
      const query = makeQuery({ maxPages: 3 });
      await fetchForward(query, 7); // retained [4,5,6]
      expect(query.state.pageParams).toEqual([4, 5, 6]);

      await query.fetchNextPage();
      expect(query.state.pageParams).toEqual([5, 6, 7]);
      expect(query.data.map((d) => d.page)).toEqual([5, 6, 7]);
    });

    it('A8: hasNextPage stays consistent with the surviving last page after eviction', async () => {
      const query = makeQuery({ maxPages: 3 });
      await fetchForward(query, 5); // retained [2,3,4], last page 4 -> next exists
      expect(query.hasNextPage).toBe(true);
      await query.fetchNextPage(); // -> [3,4,5]
      expect(query.hasNextPage).toBe(true);
      expect(query.state.pageParams).toEqual([3, 4, 5]);
    });

    it('A9: consecutive state reads are memoized; a fetch changes the snapshot identity', async () => {
      const query = makeQuery({ maxPages: 3 });
      await fetchForward(query, 2);
      const s1 = query.state;
      const s2 = query.state;
      expect(s1).toBe(s2);
      await query.fetchNextPage();
      const s3 = query.state;
      expect(s3).not.toBe(s1);
      expect(s3.pages).toHaveLength(3);
    });

    it('A10: mutating a returned snapshot cannot corrupt internal page state', async () => {
      const query = makeQuery({ maxPages: 3 });
      await fetchForward(query, 2);
      const snap = query.state;
      // Internal `_pages` must be immune to caller mutation of the returned
      // snapshot (the snapshot is a copy). Note: consecutive `state` reads
      // return the memoized snapshot object itself — callers must not mutate
      // it (pre-existing behavior, unrelated to maxPages).
      snap.pages.pop();
      snap.pageParams.pop();
      expect(query.pageCount).toBe(2);
      expect(query.data.map((d) => d.page)).toEqual([0, 1]);
    });
  });

  describe('lifecycle, concurrency and memory', () => {
    it('A11: concurrent fetchNextPage calls are single-flight (no over-append)', async () => {
      const query = makeQuery({ maxPages: 5 });
      await query.fetch();
      const [a, b, c] = await Promise.all([
        query.fetchNextPage(),
        query.fetchNextPage(),
        query.fetchNextPage(),
      ]);
      expect(a).toBe(true);
      expect(b).toBe(false);
      expect(c).toBe(false);
      expect(query.pageCount).toBe(2); // fetch() page + exactly one next page
    });

    it('A12: cancel during fetchNextPage leaves no partial window; fetch() recovers cleanly', async () => {
      let releaseGate!: () => void;
      const gate = new Promise<void>((res) => {
        releaseGate = res;
      });
      const query = new InfiniteQuery<PageData, number>({
        queryKey: ['ier-cancel'],
        queryFn: async ({ pageParam, signal }) => {
          await Promise.race([
            gate,
            new Promise<never>((_res, rej) => {
              if (signal?.aborted) {
                rej(new Error('aborted'));
                return;
              }
              signal?.addEventListener('abort', () => rej(new Error('aborted')), { once: true });
            }),
          ]);
          return { page: pageParam as number };
        },
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < LAST ? lastPage.page + 1 : undefined),
        maxPages: 3,
      });

      const inFlight = query.fetchNextPage(); // do not await
      await new Promise((r) => setTimeout(r, 20));
      query.cancel();
      expect(await inFlight).toBe(false);
      expect(query.pageCount).toBe(0);
      expect(query.state.pages).toEqual([]);

      const recovery = query.fetch();
      await new Promise((r) => setTimeout(r, 20));
      releaseGate();
      await recovery;
      expect(query.pageCount).toBe(1);
      expect(query.state.pages[0]!.pageIndex).toBe(0);
    });

    it('A13: destroy after cap releases retained pages', async () => {
      const query = makeQuery({ maxPages: 4 });
      await fetchForward(query, 10);
      expect(query.pageCount).toBe(4);
      query.destroy();
      expect(query.isDestroyed).toBe(true);
      expect(query.pageCount).toBe(0);
      expect(query.state.pages).toEqual([]);
      expect(query.state.pageParams).toEqual([]);
    });

    it('A14: fetch() resets to a single page under the default cap', async () => {
      const query = makeQuery();
      await fetchForward(query, TOTAL); // bounded to 50
      expect(query.pageCount).toBe(50);
      await query.fetch();
      expect(query.pageCount).toBe(1);
      expect(query.state.pages[0]!.pageIndex).toBe(0);
      expect(query.state.pageParams).toEqual([0]);
    });

    it('A15: destroy releases retained pages (structural memory-safety contract)', async () => {
      // WeakRef/GC collection probes are unreliable inside vitest workers
      // (even a plain WeakRef target is not collected under forced gc()).
      // The deterministic contract is: destroy clears all retained state.
      const queries: InfiniteQuery<PageData, number>[] = [];
      for (let q = 0; q < 5; q++) {
        const query = new InfiniteQuery<PageData, number>({
          queryKey: ['ier-gc', q],
          queryFn: async ({ pageParam }) => ({ page: pageParam as number }),
          initialPageParam: 0,
          getNextPageParam: (lastPage) => (lastPage.page < 1000 ? lastPage.page + 1 : undefined),
          maxPages: 5,
        });
        queries.push(query);
        await fetchForward(query, 40);
        expect(query.pageCount).toBe(5);
      }
      for (const query of queries) {
        query.destroy();
        expect(query.isDestroyed).toBe(true);
        expect(query.pageCount).toBe(0);
        expect(query.state.pages).toEqual([]);
        expect(query.state.pageParams).toEqual([]);
      }
    });
  });

  describe('explicit Infinity opt-out parity', () => {
    it('A16: explicit maxPages: Infinity keeps every page (documented opt-out)', async () => {
      const query = makeQuery({ maxPages: Infinity });
      await fetchForward(query, TOTAL);
      expect(query.pageCount).toBe(TOTAL);
      expect(query.state.pageParams).toHaveLength(TOTAL);
    });
  });
});
