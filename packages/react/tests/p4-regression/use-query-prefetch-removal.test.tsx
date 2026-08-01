import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';
import { usePrefetchQuery } from '../../src/use-prefetch-query';

describe('Prefetch + Query Removal', () => {
  it('prefetch populates cache before useQuery mounts', async () => {
    const client = new QueryClient();
    const key = ['pre-mount'];

    const { result } = renderHook(
      () => usePrefetchQuery({ queryKey: key, queryFn: async () => 'prefetched' }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {
      result.current();
    });
    await new Promise((r) => setTimeout(r, 20));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('prefetched');
  });

  it('prefetch on already-cached key does not re-fetch', async () => {
    const client = new QueryClient();
    const key = ['pre-cached'];
    client.setQueryData(key, 'existing');

    let fetchCount = 0;
    const { result } = renderHook(
      () =>
        usePrefetchQuery({
          queryKey: key,
          queryFn: async () => {
            fetchCount++;
            return 'new';
          },
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {
      result.current();
    });
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchCount).toBe(0);
    expect(client.getQuerySnapshot(key)?.data).toBe('existing');
  });

  it('removeQuery while useQuery subscribed clears and allows re-fetch', async () => {
    const client = new QueryClient();
    const key = ['remove-sub'];

    renderHook(
      () =>
        useQuery({
          queryKey: key,
          queryFn: async () => 'data',
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));
    expect(client.getQuerySnapshot(key)?.status).toBe('success');

    client.removeQuery(key);
    await act(async () => {});
    expect(client.getQuerySnapshot(key)).toBeUndefined();

    await act(async () => {
      await client.fetchQuery({ queryKey: key, queryFn: async () => 're-fetched' });
    });
    await new Promise((r) => setTimeout(r, 10));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.data).toBe('re-fetched');
  });
});
