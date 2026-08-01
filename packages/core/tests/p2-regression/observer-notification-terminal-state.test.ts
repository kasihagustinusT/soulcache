import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('SM transition includes fetchStatus for terminal states', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('observer receives complete state on fetch success', async () => {
    const snapshots: any[] = [];
    const unsub = client.subscribe(['p2-2', 'success'], (s) => {
      snapshots.push({ ...s });
    });

    await client.fetchQuery({
      queryKey: ['p2-2', 'success'],
      queryFn: async () => ({ value: 1 }),
    });

    // Find the snapshot with data
    const withData = snapshots.find((s) => s.data !== undefined);
    expect(withData).toBeDefined();
    expect(withData.data).toEqual({ value: 1 });
    expect(withData.fetchStatus).toBe('idle');
    expect(withData.status).toBe('success');
    unsub();
  });

  it('observer receives complete state on fetch error', async () => {
    const snapshots: any[] = [];
    const unsub = client.subscribe(['p2-2', 'error'], (s) => {
      snapshots.push({ ...s });
    });

    try {
      await client.fetchQuery({
        queryKey: ['p2-2', 'error'],
        queryFn: async () => {
          throw new Error('test');
        },
      });
    } catch {
      // expected
    }

    const withError = snapshots.find((s) => s.error !== null && s.error !== undefined);
    expect(withError).toBeDefined();
    expect(withError.fetchStatus).toBe('idle');
    expect(withError.status).toBe('error');
    unsub();
  });

  it('multiple observers all receive consistent state', async () => {
    const snapshots1: any[] = [];
    const snapshots2: any[] = [];

    const unsub1 = client.subscribe(['p2-2', 'multi'], (s) => {
      snapshots1.push({ ...s });
    });
    const unsub2 = client.subscribe(['p2-2', 'multi'], (s) => {
      snapshots2.push({ ...s });
    });

    await client.fetchQuery({
      queryKey: ['p2-2', 'multi'],
      queryFn: async () => ({ id: 1 }),
    });

    const last1 = snapshots1[snapshots1.length - 1];
    const last2 = snapshots2[snapshots2.length - 1];
    expect(last1.data).toEqual(last2.data);
    expect(last1.fetchStatus).toBe(last2.fetchStatus);
    expect(last1.status).toBe(last2.status);

    unsub1();
    unsub2();
  });
});
