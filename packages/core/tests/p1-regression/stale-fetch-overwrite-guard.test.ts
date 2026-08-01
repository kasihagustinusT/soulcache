import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('_executeFetch stale async overwrite', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  afterEach(() => {
    client.destroy();
  });

  function deferred<T>(): {
    promise: Promise<T>;
    resolve: (v: T) => void;
    reject: (e: Error) => void;
  } {
    let resolve!: (v: T) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('setQueryData during fetch gap is not overwritten by late fetch', async () => {
    const { promise: deferredPromise, resolve: resolveFetch } = deferred<string>();
    const fetchFn = vi.fn(async () => {
      await deferredPromise;
      return 'fetch-data';
    });

    // _executeFetch creates entry synchronously before first await (queryFn)
    const p = client.fetchQuery({ queryKey: ['t1', 'key-a'], queryFn: fetchFn });

    // During the async gap, set different data
    client.setQueryData(['t1', 'key-a'], 'explicit-data');

    // Resolve the fetch — version guard should detect version change and bail
    resolveFetch('fetch-data');
    await p;

    const entry = client.getQueryData(['t1', 'key-a']);
    expect(entry).toBe('explicit-data');
  });

  it('late error does not overwrite setQueryData during gap', async () => {
    const { promise: deferredPromise, reject: rejectFetch } = deferred<string>();
    const failFn = vi.fn(async () => {
      await deferredPromise;
      throw new Error('fetch-failed');
    });

    const p = client.fetchQuery({ queryKey: ['t1', 'key-b'], queryFn: failFn }).catch(() => {});

    client.setQueryData(['t1', 'key-b'], 'preserved-data');

    rejectFetch(new Error('fetch-failed'));
    await p;

    const entry = client.getQueryData(['t1', 'key-b']);
    expect(entry).toBe('preserved-data');
  });

  it('normal fetch with no concurrent modification still writes', async () => {
    await client.fetchQuery({
      queryKey: ['t1', 'key-c'],
      queryFn: async () => 'normal-data',
    });

    const entry = client.getQueryData(['t1', 'key-c']);
    expect(entry).toBe('normal-data');
  });
});
