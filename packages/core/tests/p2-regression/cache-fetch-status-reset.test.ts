import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('Cache fetchStatus reset after fetch', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('fetchStatus resets to idle after successful fetch', async () => {
    const data = await client.fetchQuery({
      queryKey: ['p2-1', 'success'],
      queryFn: async () => ({ value: 42 }),
    });

    expect(data).toEqual({ value: 42 });

    const entry = client.getQueryData(['p2-1', 'success']);
    expect(entry).toEqual({ value: 42 });

    // QuerySnapshot should reflect idle fetchStatus
    let snapshot: any = null;
    const unsub = client.subscribe(['p2-1', 'success'], (s) => {
      snapshot = s;
    });
    expect(snapshot?.fetchStatus).toBe('idle');
    unsub();
  });

  it('fetchStatus resets to idle after failed fetch', async () => {
    try {
      await client.fetchQuery({
        queryKey: ['p2-1', 'error'],
        queryFn: async () => {
          throw new Error('test error');
        },
      });
    } catch {
      // expected
    }

    let snapshot: any = null;
    const unsub = client.subscribe(['p2-1', 'error'], (s) => {
      snapshot = s;
    });
    expect(snapshot?.fetchStatus).toBe('idle');
    unsub();
  });

  it('fetchStatus correct in subscribeToQuery path', async () => {
    await client.fetchQuery({
      queryKey: ['p2-1', 'sub'],
      queryFn: async () => ({ id: 1 }),
    });

    let snapshot: any = null;
    const unsub = client.subscribe(['p2-1', 'sub'], (s) => {
      snapshot = s;
    });
    expect(snapshot?.fetchStatus).toBe('idle');
    expect(snapshot?.data).toEqual({ id: 1 });
    unsub();
  });

  it('manual setQueryData resets fetchStatus', async () => {
    client.setQueryData(['p2-1', 'manual'], { id: 1 });

    let snapshot: any = null;
    const unsub = client.subscribe(['p2-1', 'manual'], (s) => {
      snapshot = s;
    });
    expect(snapshot?.fetchStatus).toBe('idle');
    unsub();
  });
});
