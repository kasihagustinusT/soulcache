import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Enabled transitions', () => {
  it('false→true with empty cache triggers fetch', async () => {
    const client = new QueryClient();
    const key = ['en-empty'];
    const fetchFn = vi.fn().mockResolvedValue('data');

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: key,
          queryFn: fetchFn,
          enabled,
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
        initialProps: { enabled: false },
      },
    );

    await act(async () => {});
    expect(fetchFn).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('data');
  });

  it('false→true with cached success does not double fetch', async () => {
    const client = new QueryClient();
    const key = ['en-cached'];
    client.setQueryData(key, 'preloaded');

    const fetchFn = vi.fn().mockResolvedValue('fresh');

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: key,
          queryFn: fetchFn,
          enabled,
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
        initialProps: { enabled: false },
      },
    );

    await act(async () => {});
    expect(fetchFn).not.toHaveBeenCalled();
    expect(client.getQuerySnapshot(key)?.data).toBe('preloaded');

    rerender({ enabled: true });
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 20));

    expect(fetchFn).not.toHaveBeenCalled();
    expect(client.getQuerySnapshot(key)?.data).toBe('preloaded');
  });

  it('true→false while fetching does not crash and fetch completes', async () => {
    const client = new QueryClient();
    const key = ['en-pending'];
    let resolve: (v: string) => void;
    const promise = new Promise<string>((r) => {
      resolve = r;
    });
    const fetchFn = vi.fn().mockImplementation(() => promise);

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: key,
          queryFn: fetchFn,
          enabled,
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
        initialProps: { enabled: true },
      },
    );

    await act(async () => {});
    expect(fetchFn).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    await act(async () => {});
    expect(client.getQuerySnapshot(key)?.fetchStatus).toBe('fetching');

    resolve!('done');
    await new Promise((r) => setTimeout(r, 30));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
    expect(snap?.data).toBe('done');
  });

  it('false→true→false→true does not orphan fetch', async () => {
    const client = new QueryClient();
    const key = ['en-toggle'];
    const fetchFn = vi.fn().mockResolvedValue('data');

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useQuery({
          queryKey: key,
          queryFn: fetchFn,
          enabled,
        }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
        initialProps: { enabled: false },
      },
    );

    rerender({ enabled: true });
    await act(async () => {});
    rerender({ enabled: false });
    await act(async () => {});
    rerender({ enabled: true });
    await act(async () => {});
    await new Promise((r) => setTimeout(r, 30));

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.status).toBe('success');
  });
});
