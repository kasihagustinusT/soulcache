import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('fetchStatus reset on error path via getQuerySnapshot', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('getQuerySnapshot returns fetchStatus idle after error', async () => {
    try {
      await client.fetchQuery({
        queryKey: ['h1', 'error-snapshot'],
        queryFn: async () => {
          throw new Error('boom');
        },
      });
    } catch {
      // expected
    }

    const snapshot = client.getQuerySnapshot(['h1', 'error-snapshot']);
    expect(snapshot).toBeDefined();
    expect(snapshot?.fetchStatus).toBe('idle');
    expect(snapshot?.status).toBe('error');
    expect(snapshot?.error?.message).toBe('boom');
  });

  it('getQuerySnapshot returns fetchStatus idle after success', async () => {
    await client.fetchQuery({
      queryKey: ['h1', 'success-snapshot'],
      queryFn: async () => ({ ok: true }),
    });

    const snapshot = client.getQuerySnapshot(['h1', 'success-snapshot']);
    expect(snapshot).toBeDefined();
    expect(snapshot?.fetchStatus).toBe('idle');
    expect(snapshot?.status).toBe('success');
  });

  it('subscribeToQuery callback receives fetchStatus idle on error', async () => {
    try {
      await client.fetchQuery({
        queryKey: ['h1', 'subscribe-error'],
        queryFn: async () => {
          throw new Error('fail');
        },
      });
    } catch {
      // expected
    }

    let snapshot: any = null;
    const unsub = client.subscribe(['h1', 'subscribe-error'], (s) => {
      snapshot = s;
    });
    expect(snapshot?.fetchStatus).toBe('idle');
    expect(snapshot?.error?.message).toBe('fail');
    unsub();
  });

  it('new entry created with error has fetchStatus idle', () => {
    client.setQueryData(['h1', 'manual-error'], undefined);

    const snapshot = client.getQuerySnapshot(['h1', 'manual-error']);
    expect(snapshot?.fetchStatus).toBe('idle');
  });
});
