import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('_snapshotCache must be cleaned by removeQuery()', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. snapshot exists after query creation', () => {
    client.setQueryData(['test'], 'data');
    const snapshot = client.getQuerySnapshot(['test']);
    expect(snapshot).toBeDefined();
    expect(snapshot!.data).toBe('data');
  });

  it('2. removeQuery removes snapshot cache entry', () => {
    client.setQueryData(['test'], 'data');
    client.getQuerySnapshot(['test']); // Populate snapshot cache

    client.removeQuery(['test']);

    // After removal, getQuerySnapshot should return undefined
    // (no entry, no SM → returns undefined)
    const snapshot = client.getQuerySnapshot(['test']);
    expect(snapshot).toBeUndefined();
  });

  it('3. clear() remains correct', () => {
    client.setQueryData(['a'], 'data-a');
    client.setQueryData(['b'], 'data-b');
    client.getQuerySnapshot(['a']);
    client.getQuerySnapshot(['b']);

    client.clear();

    expect(client.getQuerySnapshot(['a'])).toBeUndefined();
    expect(client.getQuerySnapshot(['b'])).toBeUndefined();
  });

  it('4. destroy() remains correct', () => {
    client.setQueryData(['test'], 'data');
    client.getQuerySnapshot(['test']);

    client.destroy();

    expect(client.isDestroyed).toBe(true);
  });

  it('5. remove + recreate same key does not leak', () => {
    client.setQueryData(['key'], 'v1');
    client.getQuerySnapshot(['key']);

    client.removeQuery(['key']);

    // Recreate with same key
    client.setQueryData(['key'], 'v2');
    const snapshot = client.getQuerySnapshot(['key']);
    expect(snapshot!.data).toBe('v2');
  });

  it('6. repeated create/remove does not accumulate snapshots', () => {
    for (let i = 0; i < 100; i++) {
      client.setQueryData(['key', i], `value-${i}`);
      client.getQuerySnapshot(['key', i]);
      client.removeQuery(['key', i]);
    }

    // All should be gone
    for (let i = 0; i < 100; i++) {
      expect(client.getQuerySnapshot(['key', i])).toBeUndefined();
    }
  });

  it('7. late async completion after remove does not corrupt replacement', async () => {
    let resolveFetch!: (v: string) => void;
    const fetchPromise = new Promise<string>((r) => {
      resolveFetch = r;
    });

    const p = client
      .fetchQuery({
        queryKey: ['race'],
        queryFn: () => fetchPromise,
      })
      .catch(() => {});

    client.removeQuery(['race']);
    client.setQueryData(['race'], 'replacement');

    resolveFetch('stale');
    await p;

    const snapshot = client.getQuerySnapshot(['race']);
    expect(snapshot!.data).toBe('replacement');
  });
});
