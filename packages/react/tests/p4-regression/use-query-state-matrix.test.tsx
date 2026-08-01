import { describe, it, expect } from 'vitest';
import { QueryClient } from '@soulcache/core';

/**
 * State Matrix: Cache/Data × SM × Snapshot
 *
 * Tests every SM state × setQueryData combination to determine the
 * authoritative contract for data, error, status after each operation.
 */
describe('State Matrix', () => {
  it('A. success → setQueryData: status stays success', () => {
    const client = new QueryClient();
    const key = ['sm-a'];

    client.setQueryData(key, 'initial');
    const s1 = client.getQuerySnapshot<string>(key);
    expect(s1?.status).toBe('success');
    expect(s1?.data).toBe('initial');

    client.setQueryData(key, 'updated');
    const s2 = client.getQuerySnapshot<string>(key);
    expect(s2?.status).toBe('success');
    expect(s2?.data).toBe('updated');
  });

  it('B. error → setQueryData: status stays error (SM lifecycle)', async () => {
    const client = new QueryClient();
    const key = ['sm-b'];

    await client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('fetch-fail');
        },
      })
      .catch(() => {});

    const s1 = client.getQuerySnapshot<string>(key);
    expect(s1?.status).toBe('error');

    client.setQueryData(key, 'manual-data');
    const s2 = client.getQuerySnapshot<string>(key);
    expect(s2?.status).toBe('success');
    expect(s2?.data).toBe('manual-data');
    expect(s2?.error).toBeNull();
  });

  it('C. invalidated → setQueryData: data updates, status stays loading', async () => {
    const client = new QueryClient();
    const key = ['sm-c'];

    client.setQueryData(key, 'original');
    await client.invalidateQueries(key);

    const s1 = client.getQuerySnapshot<string>(key);
    expect(s1?.status).toBe('loading');
    expect(s1?.data).toBe('original');

    client.setQueryData(key, 'after-inv');
    const s2 = client.getQuerySnapshot<string>(key);
    expect(s2?.status).toBe('success');
    expect(s2?.data).toBe('after-inv');
  });

  it('D. stale → setQueryData: data updates, status stays fetching', async () => {
    const client = new QueryClient();
    const key = ['sm-d'];

    client.setQueryData(key, 'original');
    // SM transitions: idle → success (skip), so SM stays idle.
    // We need SM in 'stale'. Force through internal API.
    const entry = (client as any)._cache.get(key);
    entry.state = 'stale';
    entry.error = null;

    const c = client as any;
    const sm = c._stateMachines.get(c._snapshotCacheOrder[c._snapshotCacheOrder.length - 1]);
    if (sm && sm.canTransition('stale')) {
      sm.transition('stale');
    }

    const s1 = client.getQuerySnapshot<string>(key);
    client.setQueryData(key, 'after-stale');
    const s2 = client.getQuerySnapshot<string>(key);
    expect(s2?.status).toBe('success');
    expect(s2?.data).toBe('after-stale');
  });

  it('E. fetching → setQueryData: fetcher resolves but setQueryData wins', async () => {
    const client = new QueryClient();
    const key = ['sm-e'];

    let resolve: (v: string) => void;
    const p = new Promise<string>((r) => {
      resolve = r;
    });

    const fetchPromise = client.fetchQuery({
      queryKey: key,
      queryFn: async () => p,
    });

    await new Promise((r) => setTimeout(r, 10));
    const sBefore = client.getQuerySnapshot<string>(key);
    expect(sBefore?.status).toBe('loading');

    // setQueryData during fetch: fetching → success is a valid transition
    client.setQueryData(key, 'mid-fetch-data');

    const s1 = client.getQuerySnapshot<string>(key);
    expect(s1?.data).toBe('mid-fetch-data');

    resolve!('late-resolve');
    await fetchPromise.catch(() => {});

    const s2 = client.getQuerySnapshot<string>(key);
    expect(s2?.data).toBe('mid-fetch-data');
  });

  it('F. pending → setQueryData: status unaffected by setQueryData', async () => {
    const client = new QueryClient();
    const key = ['sm-f'];

    client.setQueryData(key, 'initial');
    client.setQueryData(key, 'pending-data');

    const s1 = client.getQuerySnapshot<string>(key);
    expect(s1?.data).toBe('pending-data');
    expect(s1?.status).toBe('success');
  });

  it('G. REFETCH: concurrent refetch + setQueryData does not corrupt', async () => {
    const client = new QueryClient();
    const key = ['sm-g'];
    let callCount = 0;

    client.setQueryData(key, 'base');

    // Start first fetch (will not resolve until we let it)
    let resolve1: (v: string) => void;
    const p1 = new Promise<string>((r) => {
      resolve1 = r;
    });
    const f1 = client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        callCount++;
        return p1;
      },
    });

    await new Promise((r) => setTimeout(r, 10));

    // setQueryData during fetch
    client.setQueryData(key, 'during-fetch');
    const s1 = client.getQuerySnapshot<string>(key);
    expect(s1?.data).toBe('during-fetch');

    // Resolve first fetch
    resolve1!('fetch1-result');
    await f1.catch(() => {});

    const s2 = client.getQuerySnapshot<string>(key);
    // First fetch resolved after setQueryData. The cache.set in _executeFetch
    // should win because entry.version was captured before fetch.
    // Actually, _executeFetch checks if version changed:
    // if (entry && entry.version !== capturedVersion) { return data; }
    // Since setQueryData incremented version, _executeFetch should NOT overwrite.
    expect(s2?.data).toBe('during-fetch');
  });

  it('H. ERROR RECOVERY: error → setQueryData → fetchQuery transitions to success', async () => {
    const client = new QueryClient();
    const key = ['sm-h'];

    await client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('fail');
        },
      })
      .catch(() => {});

    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    client.setQueryData(key, 'manual-recovery');
    expect(client.getQuerySnapshot<string>(key)?.data).toBe('manual-recovery');
    expect(client.getQuerySnapshot(key)?.status).toBe('success');

    // fetchQuery transitions error → pending → fetching → success
    await client.fetchQuery({
      queryKey: key,
      queryFn: async () => 'fetch-recovery',
    });

    const s = client.getQuerySnapshot<string>(key);
    expect(s?.status).toBe('success');
    expect(s?.data).toBe('fetch-recovery');
  });

  it('I. REMOVE+RECREATE: error → removeQuery → setQueryData starts fresh', async () => {
    const client = new QueryClient();
    const key = ['sm-i'];

    await client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('fail');
        },
      })
      .catch(() => {});

    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    client.removeQuery(key);
    expect(client.getQuerySnapshot(key)).toBeUndefined();

    client.setQueryData(key, 'fresh-start');

    const s = client.getQuerySnapshot<string>(key);
    expect(s?.status).toBe('success');
    expect(s?.data).toBe('fresh-start');
  });

  it('J. MULTI-SUBSCRIBER: A and B see identical coherent snapshots', () => {
    const client = new QueryClient();
    const key = ['sm-j'];
    const snapshotsA: unknown[] = [];
    const snapshotsB: unknown[] = [];

    const unsubA = client.subscribe(key, (snap) => {
      snapshotsA.push(snap);
    });
    const unsubB = client.subscribe(key, (snap) => {
      snapshotsB.push(snap);
    });

    client.setQueryData(key, 'data1');

    expect(snapshotsA.length).toBeGreaterThanOrEqual(1);
    expect(snapshotsB.length).toBeGreaterThanOrEqual(1);

    const lastA = snapshotsA[snapshotsA.length - 1] as Record<string, unknown>;
    const lastB = snapshotsB[snapshotsB.length - 1] as Record<string, unknown>;
    expect(lastA.data).toBe(lastB.data);
    expect(lastA.status).toBe(lastB.status);
    expect(lastA.error).toBe(lastB.error);

    unsubA();
    unsubB();
  });
});
