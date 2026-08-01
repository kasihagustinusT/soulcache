import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('subscribe must re-read entry from cache on transition', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  afterEach(() => {
    client.destroy();
  });

  it('should deliver fresh data from cache during state machine transition', async () => {
    // Pre-populate cache with old data
    client.setQueryData(['users', 1], { id: 1, name: 'Alice' });

    // Subscribe — captures entry with Alice
    const snapshots: Array<{ data?: unknown }> = [];
    const unsub = client.subscribe<{ id: 1; name: string }>(['users', 1], (snapshot) => {
      snapshots.push({ data: snapshot.data });
    });

    // Fetch with new data — stores Bob in cache BEFORE state machine transitions
    // onTransition fires during sm.transition('success'), reads from cache
    await client.fetchQuery({
      queryKey: ['users', 1],
      queryFn: async () => ({ id: 1 as const, name: 'Bob' }),
    });

    unsub();

    // Should have received Bob, not stale Alice
    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(lastSnapshot?.data).toEqual({ id: 1, name: 'Bob' });
  });

  it('should deliver error from cache during failed fetch transition', async () => {
    client.setQueryData(['items', 1], { value: 'original' });

    const snapshots: Array<{ data?: unknown; error?: Error | null }> = [];
    const unsub = client.subscribe<{ value: string }>(['items', 1], (snapshot) => {
      snapshots.push({ data: snapshot.data, error: snapshot.error });
    });

    // Fetch that fails — stores error in cache BEFORE state machine transitions
    await client
      .fetchQuery({
        queryKey: ['items', 1],
        queryFn: async () => {
          throw new Error('fetch failed');
        },
      })
      .catch(() => {});

    unsub();

    // Should have received the error from the new entry
    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(lastSnapshot?.error).toBeInstanceOf(Error);
    expect((lastSnapshot?.error as Error).message).toBe('fetch failed');
  });

  it('should work correctly for normal subscription without cache operations', () => {
    client.setQueryData(['test', 'key'], { value: 'hello' });

    const snapshots: Array<{ data?: unknown }> = [];
    const unsub = client.subscribe<{ value: string }>(['test', 'key'], (snapshot) => {
      snapshots.push({ data: snapshot.data });
    });

    // setQueryData directly notifies observers (not via state machine)
    client.setQueryData(['test', 'key'], { value: 'world' });

    unsub();

    expect(snapshots.length).toBeGreaterThanOrEqual(2);
    expect(snapshots[0].data).toEqual({ value: 'hello' });
    expect(snapshots[snapshots.length - 1].data).toEqual({ value: 'world' });
  });

  it('should deliver correct data across multiple fetch transitions', async () => {
    client.setQueryData(['multi'], { version: 0 });

    const snapshots: Array<{ data?: unknown }> = [];
    const unsub = client.subscribe<{ version: number }>(['multi'], (snapshot) => {
      snapshots.push({ data: snapshot.data });
    });

    // First fetch
    await client.fetchQuery({
      queryKey: ['multi'],
      queryFn: async () => ({ version: 1 }),
    });

    // Second fetch (refetch)
    await client.fetchQuery({
      queryKey: ['multi'],
      queryFn: async () => ({ version: 2 }),
    });

    unsub();

    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(lastSnapshot?.data).toEqual({ version: 2 });
  });
});
