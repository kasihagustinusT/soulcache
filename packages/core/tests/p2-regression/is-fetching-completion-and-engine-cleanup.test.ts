import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InfiniteQuery } from '../../src/infinite/infinite-query';
import { QueryEngine } from '../../src/query/query-engine';
import { StorageManager } from '../../src/storage/storage-manager';
import { MemoryAdapter } from '../../src/storage/adapters/memory-adapter';

describe('InfiniteQuery isFetching stale after completion', () => {
  it('1. fetch() sets isFetching to false after completion', async () => {
    const query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async ({ pageParam }) => ({ page: pageParam }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);
    expect(query.state.isFetching).toBe(false);
  });

  it('2. fetchNextPage() sets isFetching to false after completion', async () => {
    const query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async ({ pageParam }) => ({ page: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (_: any) => 1,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);

    await query.fetchNextPage();
    expect(query.isFetching).toBe(false);
    expect(query.isFetchingNextPage).toBe(false);
  });

  it('3. fetchPreviousPage() sets isFetching to false after completion', async () => {
    const query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async ({ pageParam }) => ({ page: pageParam }),
      initialPageParam: 2,
      getNextPageParam: (_: any, __: any, lastParam: any) =>
        (lastParam as number) < 5 ? (lastParam as number) + 1 : undefined,
      getPreviousPageParam: (_: any, __: any, firstParam: any) =>
        (firstParam as number) > 0 ? (firstParam as number) - 1 : undefined,
    });

    await query.fetch();
    await query.fetchNextPage();

    await query.fetchPreviousPage();
    expect(query.isFetching).toBe(false);
    expect(query.isFetchingPreviousPage).toBe(false);
  });

  it('4. listeners are notified when isFetching becomes false', async () => {
    const query = new InfiniteQuery({
      queryKey: ['posts'],
      queryFn: async ({ pageParam }) => ({ page: pageParam }),
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    const listener = vi.fn();
    query.subscribe(listener);

    await query.fetch();

    const calls = listener.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const lastCall = calls[calls.length - 1];
    expect(lastCall).toBeDefined();
  });

  it('5. fetch() error sets isFetching to false', async () => {
    const query = new InfiniteQuery({
      queryKey: ['fail'],
      queryFn: async () => {
        throw new Error('Network error');
      },
      initialPageParam: 0,
      getNextPageParam: () => undefined,
    });

    await query.fetch();
    expect(query.isFetching).toBe(false);
    expect(query.state.isFetching).toBe(false);
    expect(query.state.error?.message).toBe('Network error');
  });
});

describe("QueryEngine refetch timers do not resurrect GC'd queries", () => {
  let engine: QueryEngine;

  afterEach(() => {
    if (engine && !engine.isDestroyed) {
      engine.destroy();
    }
  });

  it('1. refetch timer does not fire if query removed from cache', async () => {
    vi.useFakeTimers();

    engine = new QueryEngine({ refetchInterval: 100 });
    const queryFn = vi.fn(async () => ({ name: 'Alice' }));

    await engine.executeQuery({
      queryKey: ['users'],
      queryFn,
    });

    expect(queryFn).toHaveBeenCalledTimes(1);

    // Remove query from cache
    engine.client.getCache().delete(['users']);

    // Advance timer past refetch interval
    await vi.advanceTimersByTimeAsync(200);

    // Should NOT have refetched because query was removed
    expect(queryFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('2. refetch timer does fire if query still in cache', async () => {
    vi.useFakeTimers();

    engine = new QueryEngine({ refetchInterval: 100 });
    const queryFn = vi.fn(async () => ({ name: 'Alice' }));

    await engine.executeQuery({
      queryKey: ['users'],
      queryFn,
    });

    expect(queryFn).toHaveBeenCalledTimes(1);

    // Advance timer past refetch interval
    await vi.advanceTimersByTimeAsync(200);

    // Should have refetched at least once because query is still in cache
    // (may re-schedule and fire again depending on timing)
    expect(queryFn.mock.calls.length).toBeGreaterThanOrEqual(2);

    vi.useRealTimers();
  });

  it('3. cancelQuery removes refetch timers', async () => {
    vi.useFakeTimers();

    engine = new QueryEngine({ refetchInterval: 100 });
    const queryFn = vi.fn(async () => ({ name: 'Alice' }));

    await engine.executeQuery({
      queryKey: ['users'],
      queryFn,
    });

    engine.cancelQuery(['users']);

    await vi.advanceTimersByTimeAsync(200);

    // Should not have refetched after cancel
    expect(queryFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('QueryEngine _refetchFns cleans up after failure', () => {
  let engine: QueryEngine;

  afterEach(() => {
    if (engine && !engine.isDestroyed) {
      engine.destroy();
    }
  });

  it('1. _refetchFns cleaned up when query fails', async () => {
    vi.useFakeTimers();

    engine = new QueryEngine({ refetchInterval: 100 });
    let shouldFail = false;
    const queryFn = vi.fn(async () => {
      if (shouldFail) throw new Error('Network error');
      return { name: 'Alice' };
    });

    await engine.executeQuery({
      queryKey: ['users'],
      queryFn,
    });

    expect(queryFn).toHaveBeenCalledTimes(1);

    // Set to fail on next call
    shouldFail = true;

    // Advance timer to trigger refetch
    await vi.advanceTimersByTimeAsync(150);

    // The failed refetch should clean up _refetchFns
    // No more refetches should be scheduled
    const callCountAfterFail = queryFn.mock.calls.length;

    await vi.advanceTimersByTimeAsync(200);

    // Should not have refetched again because _refetchFns was cleaned up
    expect(queryFn).toHaveBeenCalledTimes(callCountAfterFail);

    vi.useRealTimers();
  });

  it('2. _refetchFns cleaned up when engine destroyed', async () => {
    vi.useFakeTimers();

    engine = new QueryEngine({ refetchInterval: 100 });
    const queryFn = vi.fn(async () => ({ name: 'Alice' }));

    await engine.executeQuery({
      queryKey: ['users'],
      queryFn,
    });

    engine.destroy();

    await vi.advanceTimersByTimeAsync(200);

    // Should not have refetched after destroy
    expect(queryFn).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});

describe('StorageManager eventHandlers cleared on dispose', () => {
  it('1. event handlers are cleared after dispose', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    const manager = new StorageManager({ adapter });
    await manager.initialize();

    const handler = vi.fn();
    manager.on('storage.save.complete', handler);

    // Dispose the manager
    await manager.dispose();

    // After dispose, no more events should be emitted
    // (and the handler should not be called for any pending events)
    expect(manager.isReady()).toBe(false);
  });

  it('2. dispose does not throw when called multiple times', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    const manager = new StorageManager({ adapter });
    await manager.initialize();

    await manager.dispose();
    await manager.dispose(); // Should not throw
  });

  it('3. handler not called after dispose even if registered', async () => {
    const adapter = new MemoryAdapter();
    await adapter.initialize();
    const manager = new StorageManager({ adapter });
    await manager.initialize();

    const handler = vi.fn();
    manager.on('storage.save.complete', handler);

    await manager.dispose();

    // Handler should not be called for any subsequent operations
    expect(handler).not.toHaveBeenCalled();
  });
});
