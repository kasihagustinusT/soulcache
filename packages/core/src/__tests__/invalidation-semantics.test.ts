import { describe, it, expect } from 'vitest';
import { QueryClient } from '../client/query-client';

/**
 * Invalidation Semantics Tests
 *
 * Verifies the exact behavior of invalidateQueries on:
 *  - SM state
 *  - Entry state
 *  - Entry status (CacheStatus)
 *  - Snapshot
 *  - Concurrent fetch operations
 */
describe('Invalidation semantics', () => {
  function getInternals(client: QueryClient, key: string[]) {
    const c = client as any;
    const entry = c._cache.get(key);
    const keyHash = entry?.keyHash;
    const sm = keyHash ? c._stateMachines.get(keyHash) : undefined;
    return { entry, sm, keyHash };
  }

  it('1. success → invalidate: SM=invalidated, entry.state=invalidated, snapshot=loading, data preserved', async () => {
    const client = new QueryClient();
    const key = ['inv-1'];

    await client.fetchQuery({ queryKey: key, queryFn: async () => 'data' });

    const before = client.getQuerySnapshot<string>(key);
    expect(before?.status).toBe('success');
    expect(before?.data).toBe('data');

    await client.invalidateQueries(key);

    const after = client.getQuerySnapshot<string>(key);
    const { entry, sm } = getInternals(client, key);

    expect(sm?.state).toBe('invalidated');
    expect(entry?.state).toBe('invalidated');
    expect(entry?.status).toBe('invalidated');
    expect(after?.status).toBe('loading');
    expect(after?.data).toBe('data');
    expect(after?.error).toBeNull();
  });

  it('2. invalidate → refetch: no stale lifecycle state remains', async () => {
    const client = new QueryClient();
    const key = ['inv-2'];

    client.setQueryData(key, 'initial');
    await client.invalidateQueries(key);

    expect((client as any)._stateMachines.get((client as any)._cache.get(key).keyHash)?.state).toBe('invalidated');

    await client.fetchQuery({ queryKey: key, queryFn: async () => 'refreshed' });

    const snap = client.getQuerySnapshot<string>(key);
    const { sm, entry } = getInternals(client, key);

    expect(sm?.state).toBe('success');
    expect(entry?.state).toBe('success');
    expect(entry?.status).toBe('fresh');
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('refreshed');
  });

  it('3. invalidate → setQueryData: status becomes success', async () => {
    const client = new QueryClient();
    const key = ['inv-3'];

    client.setQueryData(key, 'original');
    await client.invalidateQueries(key);

    client.setQueryData(key, 'manual');

    const snap = client.getQuerySnapshot<string>(key);
    const { sm } = getInternals(client, key);

    expect(sm?.state).toBe('success');
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('manual');
  });

  it('4. error → setQueryData: recovery transitions SM to success', async () => {
    const client = new QueryClient();
    const key = ['inv-4'];

    await client.fetchQuery({
      queryKey: key,
      queryFn: async () => { throw new Error('fail'); },
    }).catch(() => {});

    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    client.setQueryData(key, 'after-failure');
    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('after-failure');
  });

  it('5. invalidate during fetch: fetch A → invalidate → A resolves. Stale lifecycle does not corrupt.', async () => {
    const client = new QueryClient();
    const key = ['inv-5'];
    let resolveA: (v: string) => void;
    const pA = new Promise<string>((r) => { resolveA = r; });

    const fetchA = client.fetchQuery({ queryKey: key, queryFn: async () => pA });

    await new Promise((r) => setTimeout(r, 10));

    // Invalidate while fetch A is in-flight
    await client.invalidateQueries(key);
    const { sm } = getInternals(client, key);
    // SM is in 'fetching', cannot transition to 'invalidated' from 'fetching'
    // Actually 'fetching → invalidated' is NOT in the transition table
    expect(sm?.state).toBe('fetching');

    // Resolve fetch A
    resolveA!('fetch-a-result');
    await fetchA;

    const snap = client.getQuerySnapshot<string>(key);
    const { sm: smAfter } = getInternals(client, key);
    // Fetch success transitions SM from fetching → success
    expect(smAfter?.state).toBe('success');
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('fetch-a-result');
  });

  it('6. double invalidate: invalidate → invalidate. Second call finds SM already invalidated.', async () => {
    const client = new QueryClient();
    const key = ['inv-6'];

    client.setQueryData(key, 'data');
    await client.invalidateQueries(key);
    await client.invalidateQueries(key);

    const snap = client.getQuerySnapshot<string>(key);
    const { sm, entry } = getInternals(client, key);

    expect(sm?.state).toBe('invalidated');
    // Second invalidateQueries: cache.invalidate() calls markInvalidated() again
    // markInvalidated sets entry.state and entry.status unconditionally
    expect(entry?.state).toBe('invalidated');
    expect(entry?.status).toBe('invalidated');
    expect(snap?.status).toBe('loading');
    expect(snap?.data).toBe('data');
  });

  it('7. hydrated invalidated state: dehydrate → hydrate preserves data', async () => {
    const client = new QueryClient();
    const key = ['inv-7'];

    client.setQueryData(key, 'hydrate-data');

    const { dehydrate, hydrate } = await import('../hydration/hydration');
    const state = dehydrate(client.getCache(), { includeStale: true });

    const client2 = new QueryClient();
    hydrate(client2.getCache(), state);

    const snap = client2.getQuerySnapshot<string>(key);
    expect(snap?.data).toBe('hydrate-data');
  });

  it('8. invalidateQueries with prefix matching affects only matching keys', async () => {
    const client = new QueryClient();
    const key1 = ['prefix', 'a'];
    const key2 = ['prefix', 'b'];
    const key3 = ['other'];

    client.setQueryData(key1, 'a');
    client.setQueryData(key2, 'b');
    client.setQueryData(key3, 'other');

    await client.invalidateQueries(['prefix']);

    const { sm: sm1 } = getInternals(client, key1);
    const { sm: sm2 } = getInternals(client, key2);
    const { sm: sm3 } = getInternals(client, key3);

    expect(sm1?.state).toBe('invalidated');
    expect(sm2?.state).toBe('invalidated');
    expect(sm3?.state).not.toBe('invalidated');
  });
});
