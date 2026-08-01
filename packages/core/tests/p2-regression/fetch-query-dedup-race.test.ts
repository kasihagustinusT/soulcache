import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('fetchQuery finally identity guard', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('clear + immediate re-fetch: new pending entry survives old finally', async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    // Start first fetch (will be cleared)
    const p1 = client.fetchQuery({
      queryKey: ['new-11', 'clear'],
      queryFn: () => fetchPromise,
    });

    // Catch rejection from clear so it doesn't become unhandled
    p1.catch(() => {});

    // Clear the cache (rejects pending, clears map)
    client.clear();

    // Start second fetch (creates new entry)
    const p2 = client.fetchQuery({
      queryKey: ['new-11', 'clear'],
      queryFn: async () => ({ second: true }),
    });

    // Resolve first fetch — its finally should NOT delete second's entry
    resolveFetch({ first: true });

    const result = await p2;
    expect(result).toEqual({ second: true });
  });

  it('removeQuery + immediate re-fetch: new pending entry survives', async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });

    const p1 = client.fetchQuery({
      queryKey: ['new-11', 'remove'],
      queryFn: () => fetchPromise,
    });

    // Catch the rejection from removeQuery so it doesn't become unhandled
    p1.catch(() => {});

    client.removeQuery(['new-11', 'remove']);

    const p2 = client.fetchQuery({
      queryKey: ['new-11', 'remove'],
      queryFn: async () => ({ second: true }),
    });

    resolveFetch({ first: true });

    const result = await p2;
    expect(result).toEqual({ second: true });
  });

  it('normal fetch: entry cleaned up correctly', async () => {
    const result = await client.fetchQuery({
      queryKey: ['new-11', 'normal'],
      queryFn: async () => ({ ok: true }),
    });

    expect(result).toEqual({ ok: true });
  });

  it('dedup still prevents duplicate requests', async () => {
    let callCount = 0;
    const fn = async () => {
      callCount++;
      return { count: callCount };
    };

    const [r1, r2] = await Promise.all([
      client.fetchQuery({ queryKey: ['new-11', 'dedup'], queryFn: fn }),
      client.fetchQuery({ queryKey: ['new-11', 'dedup'], queryFn: fn }),
    ]);

    expect(callCount).toBe(1);
    expect(r1).toEqual(r2);
  });
});
