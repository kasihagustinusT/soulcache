import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('subscribeToQuery unsubscribe cleans orphaned state machine', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('should clean orphaned SM when no cache entry exists', () => {
    const unsub = client.subscribeToQuery(['bug106', 'never-fetched'], () => {});
    const keyHash = JSON.stringify(['bug106', 'never-fetched']);
    expect((client as any)._stateMachines.has(keyHash)).toBe(true);
    unsub();
    expect((client as any)._stateMachines.has(keyHash)).toBe(false);
  });

  it('should preserve SM when cache entry still exists', async () => {
    await client.fetchQuery({
      queryKey: ['bug106', 'has-data'],
      queryFn: async () => ({ id: 1 }),
    });
    const keyHash = JSON.stringify(['bug106', 'has-data']);
    const unsub = client.subscribeToQuery(['bug106', 'has-data'], () => {});
    expect((client as any)._stateMachines.has(keyHash)).toBe(true);
    unsub();
    expect((client as any)._stateMachines.has(keyHash)).toBe(true);
  });

  it('should handle removeQuery before unsubscribe gracefully', () => {
    const unsub = client.subscribeToQuery(['bug106', 'removed'], () => {});
    const keyHash = JSON.stringify(['bug106', 'removed']);
    expect((client as any)._stateMachines.has(keyHash)).toBe(true);
    client.removeQuery(['bug106', 'removed']);
    unsub();
    expect((client as any)._stateMachines.has(keyHash)).toBe(false);
  });

  it('should not throw when SM already destroyed by clear', () => {
    const unsub = client.subscribeToQuery(['bug106', 'cleared'], () => {});
    client.clear();
    unsub();
  });

  it('should not double-destroy or throw on repeated unsubscribe', () => {
    const unsub = client.subscribeToQuery(['bug106', 'double'], () => {});
    unsub();
    unsub();
  });

  it('should handle eviction and unsubscribe gracefully', () => {
    const keyHash = JSON.stringify(['bug106', 'evicted']);
    const unsub = client.subscribeToQuery(['bug106', 'evicted'], () => {});
    expect((client as any)._stateMachines.has(keyHash)).toBe(true);
    client.removeQuery(['bug106', 'evicted']);
    unsub();
    expect((client as any)._stateMachines.has(keyHash)).toBe(false);
  });
});
