import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

describe('InfiniteQuery state getter immutability with memoization', () => {
  function createQuery() {
    return new InfiniteQuery({
      queryKey: ['test'],
      queryFn: async ({ pageParam }) => `page-${pageParam}`,
      getNextPageParam: (_last, _all, lastParam) => (lastParam as number) + 1,
      initialPageParam: 0,
    });
  }

  it('1. state getter memoizes when not dirty', () => {
    const q = createQuery();
    const s1 = q.state;
    const s2 = q.state;
    // Memoization returns same reference when not dirty
    expect(s1).toBe(s2);
  });

  it('2. state getter returns new snapshot after mutation via notifyListeners', async () => {
    const q = createQuery();
    await q.fetch();

    const s1 = q.state;
    // notifyListeners marks dirty, so next state call returns new snapshot
    await q.fetchNextPage();
    const s2 = q.state;
    expect(s1).not.toBe(s2);
  });

  it('3. external push() does not affect internal state', async () => {
    const q = createQuery();
    await q.fetch();

    const stateBefore = q.state;
    const pageCountBefore = stateBefore.pages.length;

    // Mutate the returned state
    stateBefore.pages.push({ data: 'injected', pageParam: 999, pageIndex: 999 });
    stateBefore.pageParams.push(999);

    // Trigger a state rebuild via notifyListeners
    await q.fetchNextPage();

    // Internal state should be unaffected by the earlier mutation
    const stateAfter = q.state;
    expect(stateAfter.pages.length).toBe(pageCountBefore + 1);
    expect(stateAfter.pageParams.length).toBe(pageCountBefore + 1);
    // The injected page should not be in the new snapshot
    expect(stateAfter.pages.some((p) => p.data === 'injected')).toBe(false);
  });

  it('4. external pop() does not affect internal state', async () => {
    const q = createQuery();
    await q.fetch();
    await q.fetchNextPage();

    const stateBefore = q.state;
    const pageCountBefore = stateBefore.pages.length;

    stateBefore.pages.pop();
    stateBefore.pageParams.pop();

    // Trigger a state rebuild
    await q.fetchNextPage();

    const stateAfter = q.state;
    expect(stateAfter.pages.length).toBe(pageCountBefore + 1);
  });

  it('5. external replacement does not mutate internals', async () => {
    const q = createQuery();
    await q.fetch();

    const state = q.state;
    state.pages = [{ data: 'replaced', pageParam: -1, pageIndex: -1 }];

    // Trigger a state rebuild
    await q.fetchNextPage();

    const stateAfter = q.state;
    expect(stateAfter.pages[0].data).not.toBe('replaced');
  });

  it('6. page contents preserve expected reference semantics', async () => {
    const q = createQuery();
    await q.fetch();

    const state = q.state;
    expect(state.pages[0].data).toBe('page-0');
    expect(state.pageParams[0]).toBe(0);
  });

  it('7. snapshot equality returns same reference when not dirty', async () => {
    const q = createQuery();
    await q.fetch();

    // Same state, same values → same reference (memoized)
    const s1 = q.state;
    const s2 = q.state;
    expect(s1).toBe(s2);
    expect(s1.pages[0].data).toBe(s2.pages[0].data);
  });

  it('8. external sort() does not affect query state', async () => {
    const q = createQuery();
    await q.fetch();
    await q.fetchNextPage();

    const state = q.state;
    const originalFirst = state.pages[0].data;
    const originalLast = state.pages[state.pages.length - 1].data;

    state.pages.sort((a, b) => (a.pageIndex > b.pageIndex ? -1 : 1));

    // Trigger a state rebuild
    await q.fetchNextPage();

    const stateAfter = q.state;
    // After fetchNextPage, we have 3 pages. Sort was applied to the old
    // 2-page snapshot, not affecting internal state. The new snapshot
    // should have pages in insertion order.
    expect(stateAfter.pages[0].data).toBe('page-0');
    expect(stateAfter.pages[1].data).toBe('page-1');
    expect(stateAfter.pages[2].data).toBe('page-2');
  });
});
