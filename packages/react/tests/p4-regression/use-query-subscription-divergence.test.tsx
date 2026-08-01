import { describe, it, expect } from 'vitest';
import { QueryClient } from '@soulcache/core';

describe('Subscription divergence between subscribe() and getQuerySnapshot()', () => {
  it('after error + setQueryData: subscribe() and getQuerySnapshot() agree on success', async () => {
    const client = new QueryClient();
    const key = ['divergence-1'];

    // Create error state
    await client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('fail');
        },
      })
      .catch(() => {});

    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    // Subscribe via core API
    let subscribeSnapshot: unknown = null;
    const unsub = client.subscribe(key, (snap) => {
      subscribeSnapshot = snap;
    });

    // setQueryData triggers observer.setData (status='success') AND cache.updated
    client.setQueryData(key, 'after-error');

    // Read from subscribe() callback (observer path)
    const observerStatus = (subscribeSnapshot as Record<string, unknown>)?.status;
    const observerData = (subscribeSnapshot as Record<string, unknown>)?.data;

    // Read from getQuerySnapshot() (SM path)
    const querySnapshot = client.getQuerySnapshot<string>(key);
    const snapshotStatus = querySnapshot?.status;
    const snapshotData = querySnapshot?.data;

    // Both paths agree after the SM transition fix (error→success)
    expect(observerStatus).toBe('success');
    expect(snapshotStatus).toBe('success');
    expect(observerData).toBe('after-error');
    expect(snapshotData).toBe('after-error');

    unsub();
  });

  it('after error + fetchQuery: no divergence', async () => {
    const client = new QueryClient();
    const key = ['divergence-2'];

    await client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('fail');
        },
      })
      .catch(() => {});

    let subscribeSnapshot: unknown = null;
    const unsub = client.subscribe(key, (snap) => {
      subscribeSnapshot = snap;
    });

    // Recovery via fetch (not setQueryData)
    await client.fetchQuery({
      queryKey: key,
      queryFn: async () => 'recovered',
    });

    const observerStatus = (subscribeSnapshot as Record<string, unknown>)?.status;
    const querySnapshot = client.getQuerySnapshot<string>(key);

    // Both should agree: status='success'
    expect(observerStatus).toBe('success');
    expect(querySnapshot?.status).toBe('success');
    expect(querySnapshot?.data).toBe('recovered');

    unsub();
  });

  it('after invalidate + setQueryData: both paths return same data and status', async () => {
    const client = new QueryClient();
    const key = ['divergence-3'];

    client.setQueryData(key, 'original');
    await client.invalidateQueries(key);

    let subscribeSnapshot: unknown = null;
    const unsub = client.subscribe(key, (snap) => {
      subscribeSnapshot = snap;
    });

    client.setQueryData(key, 'after-invalidate');

    const obs = subscribeSnapshot as Record<string, unknown>;
    const qs = client.getQuerySnapshot<string>(key);

    expect(obs.data).toBe('after-invalidate');
    expect(qs?.data).toBe('after-invalidate');

    unsub();
  });
});
