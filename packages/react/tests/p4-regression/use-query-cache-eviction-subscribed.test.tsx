import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('entry lifecycle while subscribed', () => {
  it('setQueryData after removeQuery notifies subscriber', async () => {
    const client = new QueryClient();
    const key = ['remove-then-set'];
    client.setQueryData(key, 'initial');

    let seenSnapshots: Array<ReturnType<typeof client.getQuerySnapshot<string>>> = [];

    renderHook(
      () => {
        seenSnapshots.push(client.getQuerySnapshot<string>(key));
      },
      {
        wrapper: ({ children }) => (
          <SoulCacheProvider client={client}>{children}</SoulCacheProvider>
        ),
      },
    );

    await act(async () => {});
    expect(seenSnapshots[seenSnapshots.length - 1]?.data).toBe('initial');

    client.removeQuery(key);
    expect(client.getQuerySnapshot(key)).toBeUndefined();

    await act(async () => {
      client.setQueryData(key, 'recreated');
    });

    expect(client.getQuerySnapshot(key)?.data).toBe('recreated');
  });

  it('subscribeToQuery observerCount is correct on new entry after remove+set', async () => {
    const client = new QueryClient();
    const key = ['observer-after-remove'];

    const getObsCount = () => {
      const entry = (client as any)._cache.get(key);
      return entry ? entry.observerCount : -1;
    };

    expect(getObsCount()).toBe(-1);

    client.setQueryData(key, 'first');
    expect(getObsCount()).toBe(0);

    const hook = renderHook(() => null, {
      wrapper: ({ children }) => <SoulCacheProvider client={client}>{children}</SoulCacheProvider>,
    });

    const unsub = client.subscribeToQuery(key, () => {});
    expect(getObsCount()).toBe(1);

    client.removeQuery(key);
    expect(getObsCount()).toBe(-1);

    client.setQueryData(key, 'second');

    const newObsCount = getObsCount();
    expect(newObsCount).toBe(0);

    unsub();
    expect(getObsCount()).toBe(0);
  });
});
