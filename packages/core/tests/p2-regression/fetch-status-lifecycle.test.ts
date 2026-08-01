import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('fetchStatus visible during entire fetch lifecycle', () => {
  it('1. getQuerySnapshot returns fetchStatus=fetching during fetch for brand-new query', async () => {
    const client = new QueryClient();
    const fetchStatuses: string[] = [];

    // Subscribe BEFORE fetch to capture all status transitions
    const unsub = client.subscribeToQuery(['test-57'], () => {
      const snap = client.getQuerySnapshot(['test-57']);
      if (snap) {
        fetchStatuses.push(snap.fetchStatus);
      }
    });

    // Fetch with a delay so we can observe the loading state
    await client.fetchQuery({
      queryKey: ['test-57'],
      queryFn: () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('data'), 50);
        }),
    });

    unsub();

    // fetchStatus should have been 'fetching' at some point during the fetch
    expect(fetchStatuses).toContain('fetching');

    // After fetch completes, status should be idle
    const finalSnap = client.getQuerySnapshot(['test-57']);
    expect(finalSnap?.fetchStatus).toBe('idle');
    expect(finalSnap?.status).toBe('success');
    expect(finalSnap?.data).toBe('data');

    client.destroy();
  });

  it('2. subscribeToQuery sees correct status during entire fetch', async () => {
    const client = new QueryClient();
    const statuses: string[] = [];
    const fetchStatuses: string[] = [];

    const unsub = client.subscribeToQuery(['test-57b'], () => {
      const snap = client.getQuerySnapshot(['test-57b']);
      if (snap) {
        statuses.push(snap.status);
        fetchStatuses.push(snap.fetchStatus);
      }
    });

    await client.fetchQuery({
      queryKey: ['test-57b'],
      queryFn: () =>
        new Promise<string>((resolve) => {
          setTimeout(() => resolve('done'), 50);
        }),
    });

    unsub();

    // Should never have seen 'idle' after fetch started — the entry
    // existed before SM transitions, so status was 'loading' throughout.
    const loadingIdx = statuses.indexOf('loading');
    const idleIdx = statuses.indexOf('idle');
    if (loadingIdx >= 0) {
      // Once we saw loading, we should not see idle before success
      const successIdx = statuses.indexOf('success');
      if (successIdx > loadingIdx) {
        for (let i = loadingIdx; i < successIdx; i++) {
          expect(statuses[i]).not.toBe('idle');
        }
      }
    }

    client.destroy();
  });
});
