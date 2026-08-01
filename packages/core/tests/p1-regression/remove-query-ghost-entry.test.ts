import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

/**
 * QueryClient.removeQuery does not reject pending fetches,
 * allowing ghost cache entries to appear after removal.
 *
 * Fix: removeQuery() now calls _rejectPendingFetchForKey() and
 * _executeFetch() checks that the state machine still exists before
 * writing back to cache.
 */
describe('removeQuery pending fetch / ghost entry', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. fetchQuery + removeQuery → promise rejects, no ghost entry', async () => {
    const queryFn = () => new Promise<string>(() => {}); // Never resolves

    const promise = client.fetchQuery({ queryKey: ['k1'], queryFn });

    // Small delay to ensure fetch is in-flight
    await new Promise((r) => setTimeout(r, 10));

    client.removeQuery(['k1']);

    await expect(promise).rejects.toThrow('Fetch was cancelled by removeQuery()');

    // Verify no ghost entry
    expect(client.getQueryData(['k1'])).toBeUndefined();
  });

  it('2. removeQuery with no pending fetch is safe', () => {
    client.removeQuery(['nonexistent']);
    expect(client.getQueryData(['nonexistent'])).toBeUndefined();
  });

  it('3. removeQuery(A) does not affect query B', async () => {
    const result = await client.fetchQuery({
      queryKey: ['b'],
      queryFn: () => Promise.resolve('data-b'),
    });
    expect(result).toBe('data-b');

    client.removeQuery(['a']);

    expect(client.getQueryData(['b'])).toBe('data-b');
  });

  it('4. deduplicated fetches + removeQuery → all settle', async () => {
    const queryFn = () => new Promise<string>(() => {}); // Never resolves

    const p1 = client.fetchQuery({ queryKey: ['d1'], queryFn });
    const p2 = client.fetchQuery({ queryKey: ['d1'], queryFn }); // Deduped

    await new Promise((r) => setTimeout(r, 10));

    client.removeQuery(['d1']);

    await expect(p1).rejects.toThrow();
    await expect(p2).rejects.toThrow();

    expect(client.getQueryData(['d1'])).toBeUndefined();
  });

  it('5. queryFn resolves → removeQuery → no ghost entry', async () => {
    const queryFn = async () => {
      await new Promise((r) => setTimeout(r, 50));
      return 'data-x';
    };

    const promise = client.fetchQuery({ queryKey: ['x'], queryFn }).catch(() => {});

    // Remove while fetch is in-flight
    await new Promise((r) => setTimeout(r, 10));
    client.removeQuery(['x']);

    // After the fetch completes, verify no ghost entry
    await promise;
    await new Promise((r) => setTimeout(r, 50));

    // The fetch resolved but should not have recreated the cache entry
    expect(client.getQueryData(['x'])).toBeUndefined();
  }, 10000);
});
