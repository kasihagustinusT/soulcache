import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { QueryClient } from '@soulcache/core';
import { SoulCacheProvider } from '../../src/context';
import { useQuery } from '../../src/use-query';

describe('Subscription reentrancy + multi-key isolation', () => {
  it('setQueryData from within notification does not cause infinite loop', async () => {
    const client = new QueryClient();
    const key = ['reentrant-set'];
    let notificationCount = 0;

    client.subscribeToQuery(key, () => {
      notificationCount++;
      if (notificationCount < 3) {
        client.setQueryData(key, `update-${notificationCount}`);
      }
    });

    client.setQueryData(key, 'initial');
    await new Promise((r) => setTimeout(r, 20));

    expect(notificationCount).toBeLessThanOrEqual(3);
  });

  it('removeQuery from notification does not crash', async () => {
    const client = new QueryClient();
    const key = ['reentrant-remove'];

    client.subscribeToQuery(key, () => {
      client.removeQuery(key);
    });

    client.setQueryData(key, 'triggers-remove');
    await new Promise((r) => setTimeout(r, 20));
    expect(client.getQuerySnapshot(key)).toBeUndefined();
  });

  it('subscribe from within notification creates separate subscription', async () => {
    const client = new QueryClient();
    const key = ['reentrant-sub'];
    const notifications: number[] = [];

    client.subscribeToQuery(key, () => {
      notifications.push(1);
    });

    client.subscribeToQuery(key, () => {
      notifications.push(2);
      client.subscribeToQuery(key, () => {
        notifications.push(3);
      });
    });

    client.setQueryData(key, 'trigger');
    await new Promise((r) => setTimeout(r, 20));

    client.setQueryData(key, 'second');
    await new Promise((r) => setTimeout(r, 20));

    expect(notifications.filter((n) => n === 3).length).toBeGreaterThanOrEqual(1);
  });

  it('operations on key X do not affect key Y', async () => {
    const client = new QueryClient();
    const keyX = ['iso-x'];
    const keyY = ['iso-y'];

    client.setQueryData(keyX, 'X-data');
    client.setQueryData(keyY, 'Y-data');

    client.invalidateQueries(keyX);

    const snapX = client.getQuerySnapshot(keyX);
    const snapY = client.getQuerySnapshot(keyY);

    expect(snapX?.status).not.toBe('success');
    expect(snapY?.data).toBe('Y-data');
    expect(snapY?.status).toBe('success');
  });

  it('unsubscribe from within notification is idempotent', async () => {
    const client = new QueryClient();
    const key = ['reentrant-unsub'];

    const unsub = client.subscribeToQuery(key, () => {
      unsub();
    });

    client.setQueryData(key, 'a');
    client.setQueryData(key, 'b');
    client.setQueryData(key, 'c');

    await new Promise((r) => setTimeout(r, 20));

    const snap = client.getQuerySnapshot<string>(key);
    expect(snap?.data).toBe('c');
  });
});
