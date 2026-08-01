import { describe, it, expect } from 'vitest';
import React from 'react';
import { QueryClient } from '@soulcache/core';

describe('Public API double-call + replacement races', () => {
  it('fetchQuery same key deduplicates', async () => {
    const client = new QueryClient();
    const key = ['dc-dedup'];
    let callCount = 0;

    const p1 = client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        callCount++;
        return 'a';
      },
    });
    const p2 = client.fetchQuery({
      queryKey: key,
      queryFn: async () => {
        callCount++;
        return 'b';
      },
    });

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(callCount).toBe(1);
    expect(r1).toBe('a');
    expect(r2).toBe('a');
  });

  it('setQueryData called twice with same data preserves snapshot identity', async () => {
    const client = new QueryClient();
    const key = ['dc-set-twice'];
    const data = { x: 1 };

    client.setQueryData(key, data);
    const s1 = client.getQuerySnapshot(key);

    client.setQueryData(key, data);
    const s2 = client.getQuerySnapshot(key);

    expect(s1?.data).toBe(data);
    expect(s2).toBe(s1);
  });

  it('removeQuery then setQueryData produces fresh snapshot', async () => {
    const client = new QueryClient();
    const key = ['rr-remove-set'];

    client.setQueryData(key, 'old');
    client.removeQuery(key);
    client.setQueryData(key, 'new');

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.data).toBe('new');
    expect(snap?.queryId).toBeTruthy();
  });

  it('old fetch cannot overwrite remove+setQueryData', async () => {
    const client = new QueryClient();
    const key = ['rr-old-fetch'];
    let resolveOld: (v: string) => void;
    const oldPromise = new Promise<string>((r) => {
      resolveOld = r;
    });

    const fetchPromise = client.fetchQuery({ queryKey: key, queryFn: async () => oldPromise });

    client.removeQuery(key);
    client.setQueryData(key, 'authoritative');

    resolveOld!('stale');
    try {
      await fetchPromise;
    } catch {
      /* expected to throw */
    }

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.data).toBe('authoritative');
  });

  it('invalidateQueries followed by setQueryData transitions SM to success', async () => {
    const client = new QueryClient();
    const key = ['dc-inv-set'];

    client.setQueryData(key, 'data');
    await client.invalidateQueries(key);
    client.setQueryData(key, 'after-inv');

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('after-inv');
    expect(snap?.error).toBeNull();
  });
});
