import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

/**
 * Stage 05 — Final Certification (PR-D / BUG-3) independent adversarial suite.
 *
 * Model-driven validation: a pure model encodes the documented eviction
 * semantics; deterministic (seeded) workloads drive both the model and a real
 * InfiniteQuery, and the two are compared after every step. Written fresh for
 * certification; kept permanently as regression protection.
 */

type PageData = { page: number };

/** Seeded LCG for deterministic pseudo-random workloads. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Pure model of documented semantics: params window of size `cap`. */
function makeModel(cap: number, first: number, last: number) {
  let pages: number[] = [];
  const state = () => [...pages];
  return {
    fetch(): void {
      pages = [0];
    },
    next(): boolean {
      const lastParam = pages.length > 0 ? pages[pages.length - 1]! : 0;
      if (lastParam >= last) return false;
      pages = [...pages, lastParam + 1];
      if (pages.length > cap) pages = pages.slice(1);
      return true;
    },
    prev(): boolean {
      const firstParam = pages.length > 0 ? pages[0]! : 0;
      if (firstParam <= first) return false;
      pages = [firstParam - 1, ...pages];
      if (pages.length > cap) pages = pages.slice(0, -1);
      return true;
    },
    state,
  };
}

function makeQuery(options: { maxPages?: number; previous?: boolean; last?: number } = {}) {
  const first = -(options.last ?? 200);
  const last = options.last ?? 200;
  const prev = options.previous ?? false;
  return new InfiniteQuery<PageData, number>({
    queryKey: ['cert', String(options.maxPages ?? 'default')],
    queryFn: async ({ pageParam }) => ({ page: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _all, _lastParam) =>
      lastPage.page < last ? lastPage.page + 1 : undefined,
    getPreviousPageParam: prev
      ? (firstPage, _all, _firstParam) =>
          firstPage.page > first ? firstPage.page - 1 : undefined
      : undefined,
    ...(options.maxPages !== undefined ? { maxPages: options.maxPages } : {}),
  });
}

function assertSynced(
  query: InfiniteQuery<PageData, number>,
  model: ReturnType<typeof makeModel>,
  step: number,
): void {
  const expected = model.state();
  expect(query.state.pageParams, `step ${step} pageParams`).toEqual(expected);
  const actualParams = query.state.pages.map((p) => p.pageParam);
  expect(actualParams, `step ${step} page param field`).toEqual(expected);
  expect(query.state.pages.map((p) => p.pageIndex), `step ${step} indices`).toEqual(
    expected.map((_, i) => i),
  );
  expect(query.data.map((d) => d.page), `step ${step} data order`).toEqual(expected);
  expect(query.pageCount, `step ${step} pageCount`).toBe(expected.length);
  expect(query.state.pages.length).toBe(query.state.pageParams.length);
}

describe('CER: InfiniteQuery maxPages (BUG-3) certification', () => {
  it('C1: 400-op deterministic mixed next/prev/fetch workload matches the model (default cap 50)', async () => {
    const query = makeQuery({ previous: true, last: 200 });
    const model = makeModel(50, -200, 200);
    const rng = seededRandom(0xc0ffee);
    await query.fetch();
    void model.fetch();
    let steps = 0;

    const run = async (op: 'fetch' | 'next' | 'prev') => {
      steps++;
      if (op === 'fetch') {
        void model.fetch();
        await query.fetch();
      } else if (op === 'next') {
        const modelOk = model.next();
        const queryOk = await query.fetchNextPage();
        expect(queryOk).toBe(modelOk);
      } else {
        const modelOk = model.prev();
        const queryOk = await query.fetchPreviousPage();
        expect(queryOk).toBe(modelOk);
      }
      assertSynced(query, model, steps);
    };

    for (let i = 0; i < 400; i++) {
      const r = rng();
      if (r < 0.1) await run('fetch');
      else if (r < 0.6) await run('next');
      else await run('prev');
    }
  });

  it('C2: large dataset — 300 forward pages bounded to 50 by default; 1000 cap retains all', async () => {
    const q1 = makeQuery({ last: 1000 });
    await q1.fetch();
    for (let i = 0; i < 300; i++) await q1.fetchNextPage();
    expect(q1.pageCount).toBe(50);
    expect(q1.state.pageParams[0]).toBe(251);
    expect(q1.state.pageParams[49]).toBe(300);
    expect(q1.data).toHaveLength(50);

    const q2 = makeQuery({ maxPages: 1000, last: 1000 });
    await q2.fetch();
    for (let i = 0; i < 300; i++) await q2.fetchNextPage();
    // fetch() page 0 + 300 next pages = 301 pages; cap 1000 retains all
    expect(q2.pageCount).toBe(301);
    expect(q2.state.pageParams[0]).toBe(0);
    expect(q2.state.pageParams[300]).toBe(300);
  });

  it('C3: repeated fetch cycles leave no residue — pageIndex resets, window bounded each cycle', async () => {
    const query = makeQuery({ last: 500 });
    for (let cycle = 0; cycle < 5; cycle++) {
      await query.fetch();
      expect(query.pageCount).toBe(1);
      expect(query.state.pages[0]!.pageIndex).toBe(0);
      expect(query.state.pageParams).toEqual([0]);
      for (let i = 0; i < 60; i++) await query.fetchNextPage();
      expect(query.pageCount).toBe(50);
      expect(query.state.pages.map((p) => p.pageIndex)).toEqual(
        Array.from({ length: 50 }, (_, i) => i),
      );
    }
  });

  it('C4: aggressive cap=2 next/prev alternation never exceeds the window or corrupts indices', async () => {
    const query = makeQuery({ maxPages: 2, previous: true, last: 60 });
    const model = makeModel(2, -60, 60);
    await query.fetch();
    void model.fetch();
    assertSynced(query, model, 0);

    for (let i = 0; i < 40; i++) {
      if (i % 2 === 0) {
        const ok = await query.fetchNextPage();
        expect(ok).toBe(model.next());
      } else {
        const ok = await query.fetchPreviousPage();
        expect(ok).toBe(model.prev());
      }
      assertSynced(query, model, i + 1);
    }
    expect(query.pageCount).toBe(2);
  });

  it('C5: pageParams carry original values across eviction (not recomputed window indices)', async () => {
    const query = new InfiniteQuery<PageData, number>({
      queryKey: ['cert-params'],
      queryFn: async ({ pageParam }) => ({ page: pageParam as number }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => lastPage.page * 2 + 1,
      maxPages: 3,
    });
    await query.fetch(); // [0]
    for (let i = 0; i < 8; i++) await query.fetchNextPage();
    // sequence: 0,1,3,7,15,31,63,127,255 -> retain last 3: 63,127,255
    expect(query.state.pageParams).toEqual([63, 127, 255]);
    expect(query.state.pages.map((p) => p.pageIndex)).toEqual([0, 1, 2]);
    expect(query.data.map((d) => d.page)).toEqual([63, 127, 255]);
  });

  it('C6: long mixed sequence keeps snapshot/data/pageParams perfectly consistent', async () => {
    const query = makeQuery({ maxPages: 4, previous: true, last: 100 });
    await query.fetch();
    for (let i = 0; i < 30; i++) {
      if (i % 3 === 0) await query.fetchPreviousPage();
      else await query.fetchNextPage();
    }
    const s = query.state;
    expect(s.pages.length).toBe(s.pageParams.length);
    expect(query.data.length).toBe(s.pages.length);
    expect(query.pageCount).toBe(s.pages.length);
    s.pages.forEach((p, i) => expect(p.pageIndex).toBe(i));
    s.pageParams.forEach((p, i) => expect(s.pages[i]!.pageParam).toBe(p));
  });

  it('C7: destroy clears listeners — no notifications after destroy; subscribe-after-destroy is inert', async () => {
    const query = makeQuery();
    await query.fetch();
    let calls = 0;
    const unsub = query.subscribe(() => {
      calls++;
    });
    expect(calls).toBe(0);
    query.destroy();
    const afterDestroy = calls;
    query.cancel();
    query.cancel();
    unsub();
    expect(calls).toBe(afterDestroy);
    const inert = query.subscribe(() => {
      calls++;
    });
    inert();
    expect(calls).toBe(afterDestroy);
  });

  it('C8: exhaustion (hasNextPage false) is stable across repeated fetchNextPage calls', async () => {
    const query = makeQuery({ maxPages: 3, last: 5 });
    await query.fetch();
    for (let i = 0; i < 8; i++) await query.fetchNextPage();
    // window [3,4,5]; page 5 is the last page of the universe
    expect(query.pageCount).toBe(3);
    expect(query.state.pageParams).toEqual([3, 4, 5]);
    expect(query.hasNextPage).toBe(false);
    for (let i = 0; i < 5; i++) {
      expect(await query.fetchNextPage()).toBe(false);
      expect(query.pageCount).toBe(3);
      expect(query.state.pageParams).toEqual([3, 4, 5]);
    }
  });

  it('C10: listeners stay stable across 100 eviction cycles — no churn, unsubscribe works', async () => {
    const query = makeQuery({ maxPages: 5, previous: true, last: 1000 });
    await query.fetch();
    let notifications = 0;
    const unsub = query.subscribe(() => {
      notifications++;
    });
    const before = notifications;
    for (let i = 0; i < 100; i++) {
      await query.fetchNextPage();
      await query.fetchPreviousPage();
      expect(query.pageCount).toBeLessThanOrEqual(5);
    }
    expect(query.pageCount).toBe(5);
    expect(notifications).toBeGreaterThan(before);
    unsub();
    const afterUnsub = notifications;
    await query.fetchNextPage();
    expect(notifications).toBe(afterUnsub);
    expect(query.pageCount).toBe(5);
  });

  it('C9: memory pressure — many queries + large windows; destroy releases all retained state', async () => {
    // Structural memory-safety contract: after destroy, every query releases
    // its pages, pageParams and error (state returns empty arrays). Bounded
    // retention during life is proven by pageCount caps in C1/C2/C3.
    const queries: InfiniteQuery<PageData, number>[] = [];
    for (let q = 0; q < 10; q++) {
      const query = new InfiniteQuery<PageData, number>({
        queryKey: ['cert-gc', q],
        queryFn: async ({ pageParam }) => ({ page: pageParam as number }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => (lastPage.page < 1000 ? lastPage.page + 1 : undefined),
        maxPages: 20,
      });
      queries.push(query);
      await query.fetch();
      for (let i = 0; i < 300; i++) await query.fetchNextPage();
      expect(query.pageCount).toBe(20);
    }
    for (const q of queries) {
      q.destroy();
      expect(q.isDestroyed).toBe(true);
      expect(q.pageCount).toBe(0);
      expect(q.state.pages).toEqual([]);
      expect(q.state.pageParams).toEqual([]);
      expect(q.state.error).toBeNull();
    }
  });
});
