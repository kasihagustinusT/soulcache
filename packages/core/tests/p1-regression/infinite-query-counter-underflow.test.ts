import { describe, it, expect } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';

/**
 * InfiniteQuery _activeOperationCount counter underflow after cancellation.
 * InfiniteQuery premature isFetching=false after fetch() restart.
 *
 * Root cause: cancel() hard-resets _activeOperationCount=0, but cancelled
 * operations' finally blocks still decrement the counter, causing underflow.
 * Fix: generation-safety pattern — each operation captures the cancel generation
 * and only decrements if its generation matches the current one.
 */
describe('InfiniteQuery counter underflow & premature isFetching', () => {
  it('1. cancel after concurrent ops → no counter underflow', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-underflow-1'],
      queryFn: async ({ pageParam }) => {
        await new Promise((r) => setTimeout(r, 50));
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);

    const p1 = query.fetchNextPage();
    const p2 = query.fetchPreviousPage();
    await new Promise((r) => setTimeout(r, 10));
    expect(query.isFetching).toBe(true);

    query.cancel();

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toBe(false);
    expect(r2).toBe(false);
    expect(query.isFetching).toBe(false);

    // Verify no counter underflow: start new op, complete it, check isFetching
    const p3 = query.fetchNextPage();
    await p3;
    expect(query.isFetching).toBe(false);
  }, 10000);

  it('2. cancel → new operation → no stale finally corruption', async () => {
    let resolveFirst!: (value: unknown) => void;

    const query = new InfiniteQuery({
      queryKey: ['test-underflow-2'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 1) {
          return new Promise((resolve) => {
            resolveFirst = resolve as (v: unknown) => void;
          });
        }
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    await new Promise((r) => setTimeout(r, 10));
    expect(query.isFetching).toBe(true);

    // Cancel the first operation
    query.cancel();
    expect(query.isFetching).toBe(false);

    // Start a new operation
    const p2 = query.fetchNextPage();
    await new Promise((r) => setTimeout(r, 10));
    expect(query.isFetching).toBe(true);

    // Resolve the OLD cancelled operation
    resolveFirst({ data: 'stale' });

    // Wait for both
    const [r1, r2] = await Promise.all([p1, p2]);

    // The first was cancelled, the second should have completed
    expect(r1).toBe(false);
    expect(r2).toBe(true);
    expect(query.isFetching).toBe(false);
  }, 10000);

  it('3. fetch() interrupting fetchNextPage → no premature isFetching=false', async () => {
    let resolveSecond!: (value: unknown) => void;

    const query = new InfiniteQuery({
      queryKey: ['test-underflow-3'],
      queryFn: async ({ pageParam }) => {
        if ((pageParam as number) === 0) {
          await new Promise((r) => setTimeout(r, 50));
        }
        if ((pageParam as number) === 1) {
          return new Promise((resolve) => {
            resolveSecond = resolve as (v: unknown) => void;
          });
        }
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
    });

    await query.fetch();

    const p1 = query.fetchNextPage();
    await new Promise((r) => setTimeout(r, 10));

    // fetch() interrupts fetchNextPage
    const p2 = query.fetch();

    // Allow the cancelled operation's finally to run
    await new Promise((r) => setTimeout(r, 10));

    // isFetching should still be true because fetch() is still in-flight
    expect(query.isFetching).toBe(true);

    // Resolve the old cancelled operation (no-op since abort fired)
    resolveSecond({ data: 'stale' });

    // Resolve the new fetch
    await p2;
    await p1; // old operation resolves (aborted)

    expect(query.isFetching).toBe(false);
    expect(query.pageCount).toBe(1);
  }, 10000);

  it('4. rapid start-cancel-start-cancel-start-complete → clean state', async () => {
    const query = new InfiniteQuery({
      queryKey: ['test-underflow-4'],
      queryFn: async ({ pageParam }) => {
        await new Promise((r) => setTimeout(r, 20));
        return { data: `page-${pageParam}` };
      },
      initialPageParam: 0,
      getNextPageParam: () => 1,
      getPreviousPageParam: () => -1,
    });

    await query.fetch();

    // Rapid sequence
    const p1 = query.fetchNextPage();
    query.cancel();
    const p2 = query.fetchPreviousPage();
    query.cancel();
    const p3 = query.fetchNextPage();

    await Promise.allSettled([p1, p2]);
    await p3;

    expect(query.isFetching).toBe(false);
    expect(query.pageCount).toBe(2);
  }, 10000);
});
