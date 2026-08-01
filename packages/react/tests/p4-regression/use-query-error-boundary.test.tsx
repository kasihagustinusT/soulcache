import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Error boundary integration', () => {
  it('fetch rejection produces error state in React', async () => {
    const client = new QueryClient();
    const key = ['err-reject'];
    const error = new Error('fetch failed');

    let captured: ReturnType<typeof useQuery<string>> | undefined;

    renderHook(
      () => {
        captured = useQuery({
          queryKey: key,
          queryFn: async () => {
            throw error;
          },
        });
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));

    expect(captured?.status).toBe('error');
    expect(captured?.isError).toBe(true);
    expect(captured?.error?.message).toBe('fetch failed');
    expect(captured?.data).toBeUndefined();
  });

  it('setQueryData after error transitions SM to success', async () => {
    const client = new QueryClient();
    const key = ['err-set-data'];

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

    let snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('error');
    expect(snap?.data).toBeUndefined();

    await act(async () => {
      client.setQueryData(key, 'recovered');
      await new Promise((r) => setTimeout(r, 10));
    });

    snap = client.getQuerySnapshot<string>(key);
    expect(snap?.data).toBe('recovered');
    expect(snap?.status).toBe('success');
    expect(snap?.error).toBeNull();
  });

  it('fetch after setQueryData resolves SM from error to success', async () => {
    const client = new QueryClient();
    const key = ['err-fetch-resolve'];

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

    client.setQueryData(key, 'recovered');

    await act(async () => {
      await client.fetchQuery({ queryKey: key, queryFn: async () => 'fresh-fetch' });
    });
    await new Promise((r) => setTimeout(r, 10));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('fresh-fetch');
    expect(snap?.error).toBeNull();
  });

  it('removeQuery after error clears state', async () => {
    const client = new QueryClient();
    const key = ['err-remove'];

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

    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    client.removeQuery(key);
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 10));

    expect(client.getQuerySnapshot(key)).toBeUndefined();
  });

  it('error state does not persist after remove+set replacement', async () => {
    const client = new QueryClient();
    const key = ['err-no-stale'];

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
    expect(client.getQuerySnapshot(key)?.status).toBe('error');

    client.removeQuery(key);
    client.setQueryData(key, 'fresh-start');
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 10));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('fresh-start');
    expect(snap?.error).toBeNull();
  });
});
