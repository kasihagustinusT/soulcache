import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';
import { hashQueryKey } from '../../src/utils/query.utils';

/**
 * Late unsubscribe corrupts observerCount on new cache entries.
 *
 * The unsubscribe callback reads a fresh cache entry to decrement
 * observerCount. If the original entry was destroyed and a new one created
 * (via removeQuery + fetchQuery), the late unsubscribe decrements the
 * WRONG entry's count.
 *
 * Fix: Capture the cache entry reference at subscribe time and decrement
 * that specific entry in the unsubscribe callback.
 */
describe('Late unsubscribe corrupts observerCount', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  afterEach(() => {
    client.destroy();
  });

  it('1. Late unsubscribe does not decrement new entry observerCount', async () => {
    // Setup: create an initial entry with data
    await client.fetchQuery({ queryKey: ['users', 1], queryFn: async () => 'alice' });

    // Subscribe — increments observerCount on entry E1
    const unsub1 = client.subscribe(['users', 1], () => {});
    const keyHash = hashQueryKey(['users', 1]);

    // Verify entry E1 has observerCount = 1
    const entry1 = client.getCache().get(['users', 1]);
    expect(entry1?.observerCount).toBe(1);

    // Destroy and re-create the query
    client.removeQuery(['users', 1]);
    await client.fetchQuery({ queryKey: ['users', 1], queryFn: async () => 'bob' });

    // E2 should have observerCount = 0 (no active observers yet)
    const entry2 = client.getCache().get(['users', 1]);
    expect(entry2?.observerCount).toBe(0);

    // Subscribe a new observer to E2
    const unsub2 = client.subscribe(['users', 1], () => {});
    expect(entry2?.observerCount).toBe(1);

    // Now call the late unsubscribe from E1
    unsub1();

    // E2's observerCount should still be 1 — unsub1 should NOT have touched E2
    expect(entry2?.observerCount).toBe(1);

    unsub2();
  });

  it('2. Multiple subscribe/unsubscribe cycles keep count correct', async () => {
    await client.fetchQuery({ queryKey: ['k'], queryFn: async () => 'v1' });

    const entry1 = client.getCache().get(['k']);
    expect(entry1?.observerCount).toBe(0);

    // Subscribe and unsubscribe — count goes 0 → 1 → 0
    const unsub1 = client.subscribe(['k'], () => {});
    expect(entry1?.observerCount).toBe(1);

    unsub1();
    expect(entry1?.observerCount).toBe(0);

    // Subscribe again — count goes 0 → 1
    const unsub2 = client.subscribe(['k'], () => {});
    expect(entry1?.observerCount).toBe(1);

    unsub2();
    expect(entry1?.observerCount).toBe(0);
  });

  it('3. Late unsubscribe after GC does not crash', async () => {
    await client.fetchQuery({ queryKey: ['k'], queryFn: async () => 'v' });

    const unsub = client.subscribe(['k'], () => {});

    // Remove the query (destroys entry)
    client.removeQuery(['k']);

    // Late unsubscribe should not crash even though entry is gone
    expect(() => unsub()).not.toThrow();
  });

  it('4. Concurrent subscribers — count tracks correctly', async () => {
    await client.fetchQuery({ queryKey: ['k'], queryFn: async () => 'v' });

    const entry = client.getCache().get(['k']);

    const unsub1 = client.subscribe(['k'], () => {});
    const unsub2 = client.subscribe(['k'], () => {});
    const unsub3 = client.subscribe(['k'], () => {});

    expect(entry?.observerCount).toBe(3);

    unsub2();
    expect(entry?.observerCount).toBe(2);

    unsub1();
    expect(entry?.observerCount).toBe(1);

    unsub3();
    expect(entry?.observerCount).toBe(0);
  });
});
