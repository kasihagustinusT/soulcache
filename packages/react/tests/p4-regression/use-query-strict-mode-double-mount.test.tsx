import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('remount compatibility', () => {
  it('observerCount returns to 1 after unmount and remount', async () => {
    const client = new QueryClient();
    const key = ['remount-observer'];
    client.setQueryData(key, 'initial');

    const getObsCount = () => {
      const entry = (client as any)._cache.get(key);
      return entry ? entry.observerCount : -1;
    };

    expect(getObsCount()).toBe(0);

    const hook1 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });
    await act(async () => {});
    expect(getObsCount()).toBe(1);

    hook1.unmount();
    await act(async () => {});
    expect(getObsCount()).toBe(0);

    const hook2 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });
    await act(async () => {});
    expect(getObsCount()).toBe(1);

    hook2.unmount();
    await act(async () => {});
    expect(getObsCount()).toBe(0);
  });

  it('multiple concurrent subscribers maintain correct observerCount', async () => {
    const client = new QueryClient();
    const key = ['multi-observer'];
    client.setQueryData(key, 'initial');

    const getObsCount = () => {
      const entry = (client as any)._cache.get(key);
      return entry ? entry.observerCount : -1;
    };

    const hook1 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });
    await act(async () => {});

    const hook2 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });
    await act(async () => {});
    expect(getObsCount()).toBe(2);

    hook1.unmount();
    await act(async () => {});
    expect(getObsCount()).toBe(1);

    hook2.unmount();
    await act(async () => {});
    expect(getObsCount()).toBe(0);
  });

  it('re-mount after fetch in flight produces valid snapshot', async () => {
    const client = new QueryClient();
    const key = ['remount-fetch'];

    let resolve: (v: string) => void;
    const promise = new Promise<string>((r) => {
      resolve = r;
    });

    const { unmount } = renderHook(
      () => useQuery({ queryKey: key, queryFn: async () => promise }),
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    unmount();
    await act(async () => {});

    resolve!('done');
    await new Promise((r) => setTimeout(r, 10));

    renderHook(() => useQuery({ queryKey: key, queryFn: async () => promise }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });

    await act(async () => {});
    await new Promise((r) => setTimeout(r, 20));

    const snapshot = client.getQuerySnapshot<string>(key);
    expect(snapshot?.status).toBe('success');
    expect(snapshot?.data).toBe('done');
  });

  it('subscribeToQuery unsubscribe does not corrupt other subscriber observerCount', async () => {
    const client = new QueryClient();
    const key = ['no-corrupt'];
    client.setQueryData(key, 'initial');

    const getObsCount = () => {
      const entry = (client as any)._cache.get(key);
      return entry ? entry.observerCount : -1;
    };

    const hook1 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });
    await act(async () => {});

    const hook2 = renderHook(() => useQuery({ queryKey: key, queryFn: async () => 'data' }), {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });
    await act(async () => {});
    expect(getObsCount()).toBe(2);

    hook1.unmount();
    await act(async () => {});
    expect(getObsCount()).toBe(1);

    hook2.unmount();
    await act(async () => {});
    expect(getObsCount()).toBe(0);
  });
});
