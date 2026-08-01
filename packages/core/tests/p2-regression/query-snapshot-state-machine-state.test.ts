import { describe, it, expect } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('getQuerySnapshot uses SM state for status mapping', () => {
  it('1. after invalidateQueries, snapshot status reflects SM state', async () => {
    const client = new QueryClient();
    client.setQueryData(['test-59'], 'data');

    // Trigger a fetch to get SM into success state
    await client.fetchQuery({
      queryKey: ['test-59'],
      queryFn: async () => 'fetched',
    });

    // Verify initial status is success
    const snapBefore = client.getQuerySnapshot(['test-59']);
    expect(snapBefore?.status).toBe('success');

    // Invalidate — SM transitions to 'invalidated', cache entry goes to 'stale'
    await client.invalidateQueries(['test-59']);

    // The snapshot should reflect the SM state ('invalidated' -> 'loading'),
    // NOT the cache entry state ('stale' -> 'fetching')
    const snapAfter = client.getQuerySnapshot(['test-59']);
    expect(snapAfter?.status).toBe('loading');

    client.destroy();
  });

  it('2. subscribeToQuery and subscribe see consistent status after invalidate', async () => {
    const client = new QueryClient();
    client.setQueryData(['test-59b'], 'data');

    await client.fetchQuery({
      queryKey: ['test-59b'],
      queryFn: async () => 'fetched',
    });

    // Collect statuses from both APIs
    const subscribeToQueryStatuses: string[] = [];
    const subscribeStatuses: string[] = [];

    const unsub1 = client.subscribeToQuery(['test-59b'], () => {
      const snap = client.getQuerySnapshot(['test-59b']);
      if (snap) subscribeToQueryStatuses.push(snap.status);
    });

    const unsub2 = client.subscribe(['test-59b'], (snap) => {
      subscribeStatuses.push(snap.status);
    });

    await client.invalidateQueries(['test-59b']);

    unsub1();
    unsub2();

    // Both APIs should report the same status ('loading' after invalidate)
    const lastSubQT = subscribeToQueryStatuses[subscribeToQueryStatuses.length - 1];
    const lastSub = subscribeStatuses[subscribeStatuses.length - 1];
    expect(lastSubQT).toBe(lastSub);

    client.destroy();
  });

  it('3. snapshot status is correct during pending SM state', async () => {
    const client = new QueryClient();

    // Start a slow fetch
    const fetchPromise = client.fetchQuery({
      queryKey: ['test-59c'],
      queryFn: () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('done'), 100);
        }),
    });

    // Snapshot should show loading during fetch (SM is in pending/fetching state)
    const snap = client.getQuerySnapshot(['test-59c']);
    expect(snap?.status).toBe('loading');
    expect(snap?.fetchStatus).toBe('fetching');

    await fetchPromise;

    const finalSnap = client.getQuerySnapshot(['test-59c']);
    expect(finalSnap?.status).toBe('success');

    client.destroy();
  });
});
