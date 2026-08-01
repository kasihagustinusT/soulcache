import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

/**
 * Stale fetch silently corrupts new entry's state machine.
 *
 * When an old query entry's fetch completes, it writes data to a NEW
 * QueryEntry, which then has stale status ('success') and the entry
 * can never be garbage collected because canFetch() returns false.
 *
 * Fix: Capture the state machine reference before the async fetch. After the
 * fetch succeeds/fails, only write if the SM is still the same instance.
 */
describe('Stale fetch corrupts new entry', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  afterEach(() => {
    client.destroy();
  });

  it('1. Stale fetch from old entry does not corrupt new entry', async () => {
    // Start first fetch — slow
    const slowFetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return 'slow-data';
    });

    const promise1 = client.fetchQuery({ queryKey: ['key'], queryFn: slowFetch });

    // Remove the query while the first fetch is in-flight
    // This destroys the SM and rejects pending fetches
    client.removeQuery(['key']);

    // Immediately re-add the same query key — fresh SM, fresh entry
    const fastFetch = vi.fn(async () => 'fresh-data');
    const promise2 = client.fetchQuery({ queryKey: ['key'], queryFn: fastFetch });
    await promise2;

    // Let the stale fetch settle (it was rejected by removeQuery)
    await promise1.catch(() => {});

    // Wait a tick for the background _executeFetch to attempt writing
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The cache should contain the FRESH data, not the slow data
    const entry = client.getQueryData(['key']);
    expect(entry).toBe('fresh-data');
  });

  it('2. Stale fetch does not corrupt state machine transitions', async () => {
    // Start first fetch — very slow
    const slowFetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return 'slow-data';
    });

    const promise1 = client.fetchQuery({ queryKey: ['key'], queryFn: slowFetch });

    // Remove and re-add
    client.removeQuery(['key']);

    const freshFetch = vi.fn(async () => 'fresh-data');
    await client.fetchQuery({ queryKey: ['key'], queryFn: freshFetch });

    // Let the stale fetch settle
    await promise1.catch(() => {});

    // Wait for background _executeFetch to attempt writing
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Entry should still contain fresh data
    const entry = client.getQueryData(['key']);
    expect(entry).toBe('fresh-data');
  });

  it('3. Stale error from old fetch does not corrupt new entry', async () => {
    // Start first fetch — will fail after delay
    const failFetch = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new Error('intentional failure');
    });

    const promise1 = client.fetchQuery({ queryKey: ['key'], queryFn: failFetch });

    // Remove and re-add before the error arrives
    client.removeQuery(['key']);

    const freshFetch = vi.fn(async () => 'fresh-data');
    await client.fetchQuery({ queryKey: ['key'], queryFn: freshFetch });

    // Let the stale error land
    await promise1.catch(() => {});

    // Wait for background _executeFetch to attempt writing
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Entry should still contain fresh data, not be corrupted by stale error
    const entry = client.getQueryData(['key']);
    expect(entry).toBe('fresh-data');
  });

  it('4. Query not removed mid-fetch writes data normally', async () => {
    // Normal flow: no removeQuery — data should be written successfully
    const fetchFn = vi.fn(async () => 'normal-data');
    await client.fetchQuery({ queryKey: ['key'], queryFn: fetchFn });

    const entry = client.getQueryData(['key']);
    expect(entry).toBe('normal-data');
  });
});
