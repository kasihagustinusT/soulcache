import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('snapshot identity stability', () => {
  it('getQuerySnapshot returns stable reference across unrelated re-renders', async () => {
    const client = new QueryClient();
    const key = ['stable-snap'];
    client.setQueryData(key, 'cached');

    const snapshots: Array<ReturnType<typeof client.getQuerySnapshot<string>>> = [];

    const { rerender } = renderHook(
      ({ n }: { n: number }) => {
        const snapshot = client.getQuerySnapshot<string>(key);
        snapshots.push(snapshot);
        return n;
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
        initialProps: { n: 0 },
      },
    );

    await act(async () => {});
    const firstSnapshot = snapshots[snapshots.length - 1];

    rerender({ n: 1 });
    rerender({ n: 2 });
    rerender({ n: 3 });

    const lastSnapshot = snapshots[snapshots.length - 1];
    expect(lastSnapshot).toBe(firstSnapshot);
  });

  it('setQueryData with same data reference preserves identity', async () => {
    const client = new QueryClient();
    const key = ['same-ref'];
    const data = { value: 42 };
    client.setQueryData(key, data);

    let current: ReturnType<typeof client.getQuerySnapshot<object>> | undefined;

    renderHook(
      () => {
        current = client.getQuerySnapshot<object>(key);
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    const before = current;

    await act(async () => {
      client.setQueryData(key, data);
      await new Promise((r) => setTimeout(r, 10));
    });

    const after = current;
    expect(after?.data).toBe(data);
    expect(after).toBe(before);
  });

  it('setQueryData with new data reference creates new snapshot', async () => {
    const client = new QueryClient();
    const key = ['new-ref'];

    let resolveFetch: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const seenSnapshots: Array<ReturnType<typeof client.getQuerySnapshot<string>>> = [];

    renderHook(
      () => {
        useQuery({ queryKey: key, queryFn: async () => fetchPromise });
        seenSnapshots.push(client.getQuerySnapshot<string>(key));
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    const before = seenSnapshots[seenSnapshots.length - 1];

    await act(async () => {
      client.setQueryData(key, 'updated');
      await new Promise((r) => setTimeout(r, 10));
    });

    const after = seenSnapshots[seenSnapshots.length - 1];
    expect(after?.data).toBe('updated');
    expect(after).not.toBe(before);
  });

  it('invalidateQueries produces new snapshot with changed status', async () => {
    const client = new QueryClient();
    const key = ['invalidate-snap'];
    client.setQueryData(key, 'data');

    const seenSnapshots: Array<ReturnType<typeof client.getQuerySnapshot<string>>> = [];

    renderHook(
      () => {
        useQuery({ queryKey: key, queryFn: async () => 'data' });
        seenSnapshots.push(client.getQuerySnapshot<string>(key));
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    const before = seenSnapshots[seenSnapshots.length - 1];
    expect(before?.status).toBe('success');

    const dataBefore = before?.data;

    await act(async () => {
      client.invalidateQueries(key);
      await new Promise((r) => setTimeout(r, 10));
    });

    const after = seenSnapshots[seenSnapshots.length - 1];
    expect(after?.status).not.toBe('success');
    expect(after?.data).toBe(dataBefore);
    expect(after).not.toBe(before);
  });

  it('fetch lifecycle produces unique snapshot references per state transition', async () => {
    const client = new QueryClient();
    const key = ['fetch-lifecycle'];

    let resolveFetch: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const directSnapshots: Array<ReturnType<typeof client.getQuerySnapshot<string>>> = [];

    function captureSnapshot() {
      const snap = client.getQuerySnapshot<string>(key);
      directSnapshots.push(snap);
    }

    renderHook(
      () => {
        useQuery({ queryKey: key, queryFn: async () => fetchPromise });
        captureSnapshot();
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});

    const sMid = client.getQuerySnapshot<string>(key);
    directSnapshots.push(sMid);

    await act(async () => {
      resolveFetch!('done');
      await new Promise((r) => setTimeout(r, 50));
    });

    const sFinal = client.getQuerySnapshot<string>(key);
    expect(sFinal?.status).toBe('success');
    expect(sFinal?.data).toBe('done');

    for (let i = 0; i < directSnapshots.length; i++) {
      for (let j = i + 1; j < directSnapshots.length; j++) {
        if (directSnapshots[i] === undefined || directSnapshots[j] === undefined) continue;
        if (
          directSnapshots[i]!.status === directSnapshots[j]!.status &&
          directSnapshots[i]!.fetchStatus === directSnapshots[j]!.fetchStatus &&
          directSnapshots[i]!.data === directSnapshots[j]!.data
        ) {
          expect(directSnapshots[i]).toBe(directSnapshots[j]);
        } else {
          expect(directSnapshots[i]).not.toBe(directSnapshots[j]);
        }
      }
    }
  });

  it('concurrent getQuerySnapshot calls return the same reference', async () => {
    const client = new QueryClient();
    const key = ['concurrent-snap'];
    client.setQueryData(key, { num: 42 });

    const first = client.getQuerySnapshot(key);
    const second = client.getQuerySnapshot(key);
    expect(first).toBe(second);
  });
});
