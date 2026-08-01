import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('Brand-new query must expose fetchStatus: fetching', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. brand-new query shows fetchStatus: fetching during initial fetch', async () => {
    let resolveFetch!: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    // Start fetch — does NOT await
    const p = client.fetchQuery({
      queryKey: ['new-query'],
      queryFn: () => fetchPromise,
    });

    // Entry should exist with fetchStatus: fetching
    const entry = client.getCache().get(['new-query']);
    expect(entry).toBeDefined();
    expect(entry!.fetchStatus).toBe('fetching');
    expect(entry!.state).toBe('pending');

    // Snapshot should also reflect fetching
    const snapshot = client.getQuerySnapshot(['new-query']);
    expect(snapshot).toBeDefined();
    expect(snapshot!.fetchStatus).toBe('fetching');

    resolveFetch('data');
    await p;

    // After success, fetchStatus returns to idle
    const entryAfter = client.getCache().get(['new-query']);
    expect(entryAfter!.fetchStatus).toBe('idle');
    expect(entryAfter!.state).toBe('success');
  });

  it('2. brand-new query shows fetchStatus: idle after failed fetch', async () => {
    let rejectFetch!: (e: Error) => void;
    const fetchPromise = new Promise<string>((_, r) => {
      rejectFetch = r;
    });

    const p = client
      .fetchQuery({
        queryKey: ['fail-query'],
        queryFn: () => fetchPromise,
      })
      .catch(() => {});

    // Entry should exist with fetchStatus: fetching
    const entry = client.getCache().get(['fail-query']);
    expect(entry).toBeDefined();
    expect(entry!.fetchStatus).toBe('fetching');

    rejectFetch(new Error('network error'));
    await p;

    // After error, fetchStatus returns to idle
    const entryAfter = client.getCache().get(['fail-query']);
    expect(entryAfter!.fetchStatus).toBe('idle');
    expect(entryAfter!.state).toBe('error');
  });

  it('3. existing query still shows fetchStatus: fetching on re-fetch', async () => {
    // Pre-populate cache
    client.setQueryData(['existing'], 'initial-data');

    let resolveFetch!: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const p = client.fetchQuery({
      queryKey: ['existing'],
      queryFn: () => fetchPromise,
    });

    // Entry should show fetching
    const entry = client.getCache().get(['existing']);
    expect(entry!.fetchStatus).toBe('fetching');

    resolveFetch('new-data');
    await p;

    expect(entry!.fetchStatus).toBe('idle');
    expect(entry!.data).toBe('new-data');
  });

  it('4. removeQuery during fetch does not leave stale fetchStatus', async () => {
    let resolveFetch!: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const p = client
      .fetchQuery({
        queryKey: ['remove-me'],
        queryFn: () => fetchPromise,
      })
      .catch(() => {});

    expect(client.getCache().get(['remove-me'])).toBeDefined();

    client.removeQuery(['remove-me']);
    expect(client.getCache().get(['remove-me'])).toBeUndefined();

    resolveFetch('data');
    await p;

    // After removal, entry should not exist
    expect(client.getCache().get(['remove-me'])).toBeUndefined();
  });

  it('5. deduplicated concurrent fetches share same entry', async () => {
    let resolveFetch!: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const p1 = client.fetchQuery({
      queryKey: ['dedup'],
      queryFn: () => fetchPromise,
    });
    const p2 = client.fetchQuery({
      queryKey: ['dedup'],
      queryFn: () => fetchPromise,
    });

    // Both should resolve with same data
    resolveFetch('shared-data');
    const [d1, d2] = await Promise.all([p1, p2]);
    expect(d1).toBe('shared-data');
    expect(d2).toBe('shared-data');

    // Entry should be in success state
    const entry = client.getCache().get(['dedup']);
    expect(entry!.state).toBe('success');
    expect(entry!.fetchStatus).toBe('idle');
  });

  it('6. background refetch still reports fetching for existing entry', async () => {
    client.setQueryData(['bg'], 'old-data');

    let resolveFetch!: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const p = client.fetchQuery({
      queryKey: ['bg'],
      queryFn: () => fetchPromise,
    });

    // Should show fetching
    const entry = client.getCache().get(['bg']);
    expect(entry!.fetchStatus).toBe('fetching');

    resolveFetch('new-data');
    await p;

    expect(entry!.fetchStatus).toBe('idle');
    expect(entry!.data).toBe('new-data');
  });

  it('7. state machine guard prevents stale fetch from corrupting replacement', async () => {
    let resolveFetch1!: (v: string) => void;
    const fetchPromise1 = new Promise<string>((r) => {
      resolveFetch1 = r;
    });

    const p1 = client
      .fetchQuery({
        queryKey: ['replace'],
        queryFn: () => fetchPromise1,
      })
      .catch(() => {});

    // Remove and re-add while first fetch is in flight
    client.removeQuery(['replace']);
    client.setQueryData(['replace'], 'manual-data');

    // First fetch resolves — should NOT overwrite manual data
    resolveFetch1('stale-data');
    await p1;

    const entry = client.getCache().get(['replace']);
    expect(entry!.data).toBe('manual-data');
  });
});
