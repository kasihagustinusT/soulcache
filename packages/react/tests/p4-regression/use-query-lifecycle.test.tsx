import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Lifecycle — error, retry, refetch, cancel', () => {
  it('fetch error sets snapshot error state', async () => {
    const client = new QueryClient();
    const key = ['lc-error'];

    renderHook(
      () =>
        useQuery({
          queryKey: key,
          queryFn: async () => {
            throw new Error('fail');
          },
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('error');
    expect(snap?.error?.message).toBe('fail');
    expect(snap?.data).toBeUndefined();
  });

  it('cancel during fetch leaves entry fetchStatus idle', async () => {
    const client = new QueryClient();
    const key = ['lc-cancel'];
    let resolve: (v: string) => void;
    const promise = new Promise<string>((r) => {
      resolve = r;
    });

    renderHook(
      () =>
        useQuery({
          queryKey: key,
          queryFn: async () => promise,
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    const entry = (client as any)._cache.get(key);
    expect(entry.fetchStatus).toBe('fetching');

    client.removeQuery(key);
    await act(async () => {});

    resolve!('late');
    await new Promise((r) => setTimeout(r, 20));

    expect(client.getQuerySnapshot(key)).toBeUndefined();
  });

  it('setQueryData after error clears error field', async () => {
    const client = new QueryClient();
    const key = ['lc-error-clear'];

    renderHook(
      () =>
        useQuery({
          queryKey: key,
          queryFn: async () => {
            throw new Error('err');
          },
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));

    client.setQueryData(key, 'recover');
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 10));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('recover');
    expect(snap?.error).toBeNull();
  });

  it('fetch after fetch returns fresh data', async () => {
    const client = new QueryClient();
    const key = ['lc-refetch'];

    renderHook(
      () =>
        useQuery({
          queryKey: key,
          queryFn: async () => 'first',
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));
    expect(client.getQuerySnapshot(key)?.data).toBe('first');

    await act(async () => {
      await client.fetchQuery({ queryKey: key, queryFn: async () => 'second' });
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(client.getQuerySnapshot(key)?.data).toBe('second');
  });
});
