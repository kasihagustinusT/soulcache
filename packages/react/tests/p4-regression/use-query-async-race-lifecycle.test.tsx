import { describe, it, expect } from 'vitest';
import { QueryClient } from '@soulcache/core';

describe('Async Race: error + setQueryData during concurrent fetch lifecycle', () => {
  it('fetch error → setQueryData → late fetch resolve does not overwrite', async () => {
    const client = new QueryClient();
    const key = ['race-r1'];
    let resolveFetch: (v: string) => void;
    let rejectFetch: (e: Error) => void;
    const p = new Promise<string>((resolve, reject) => {
      resolveFetch = resolve;
      rejectFetch = reject;
    });

    const fetchP = client.fetchQuery({ queryKey: key, queryFn: async () => p });

    await new Promise((r) => setTimeout(r, 10));

    // setQueryData during fetch
    client.setQueryData(key, 'manual-data');

    // Now the fetch rejects with error
    rejectFetch!(new Error('fetch-error'));
    await fetchP.catch(() => {});

    // The late fetch error should NOT overwrite the manual data
    const s = client.getQuerySnapshot<string>(key);
    expect(s?.data).toBe('manual-data');
  });

  it('setQueryData(A) → fetch B resolves after A', async () => {
    const client = new QueryClient();
    const key = ['race-r2'];
    let resolveA: (v: string) => void;
    let resolveB: (v: string) => void;
    const pA = new Promise<string>((r) => {
      resolveA = r;
    });
    const pB = new Promise<string>((r) => {
      resolveB = r;
    });

    const fetchA = client.fetchQuery({ queryKey: key, queryFn: async () => pA });

    await new Promise((r) => setTimeout(r, 10));

    client.setQueryData(key, 'from-setQueryData');

    // Start fetch B (same key) — this is dedup'd because fetch A is pending
    const fetchB = client.fetchQuery({ queryKey: key, queryFn: async () => pB });

    resolveB!('fetch-b-result');
    resolveA!('fetch-a-result');

    await Promise.all([fetchA, fetchB]).catch(() => {});
    await new Promise((r) => setTimeout(r, 10));

    const s = client.getQuerySnapshot<string>(key);
    // The version check in _executeFetch should prevent stale writes
    expect(s?.data).toBe('from-setQueryData');
  });

  it('error → setQueryData → refetch → old retry timer does not corrupt', async () => {
    const client = new QueryClient();
    const key = ['race-r3'];

    await client
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          throw new Error('fail');
        },
      })
      .catch(() => {});

    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    client.setQueryData(key, 'manual');

    await client.fetchQuery({
      queryKey: key,
      queryFn: async () => 'fresh-fetch',
    });

    const s = client.getQuerySnapshot<string>(key);
    expect(s?.status).toBe('success');
    expect(s?.data).toBe('fresh-fetch');
  });

  it('invalidated → setQueryData → refetch → old operation resolves', async () => {
    const client = new QueryClient();
    const key = ['race-r4'];

    client.setQueryData(key, 'original');
    await client.invalidateQueries(key);

    expect(client.getQuerySnapshot(key)?.status).toBe('loading');

    client.setQueryData(key, 'manual');

    await client.fetchQuery({
      queryKey: key,
      queryFn: async () => 'refreshed',
    });

    const s = client.getQuerySnapshot<string>(key);
    expect(s?.data).toBe('refreshed');
    expect(s?.status).toBe('success');
  });
});
