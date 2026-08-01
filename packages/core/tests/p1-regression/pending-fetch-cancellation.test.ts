import { describe, it, expect, beforeEach } from 'vitest';
import { QueryClient } from '../../src/client/query-client';

describe('pending fetch promises must settle on clear/destroy', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = new QueryClient();
  });

  it('1. in-flight fetch + clear rejects', async () => {
    const queryFn = () => new Promise(() => {}); // Never resolves

    const promise = client.fetchQuery({ queryKey: ['k1'], queryFn });
    client.clear();

    await expect(promise).rejects.toThrow('Fetch was cancelled by client clear()');
  });

  it('2. in-flight fetch + destroy rejects', async () => {
    const queryFn = () => new Promise(() => {}); // Never resolves

    const promise = client.fetchQuery({ queryKey: ['k2'], queryFn });
    client.destroy();

    await expect(promise).rejects.toThrow('Fetch was cancelled by client destroy()');
  });

  it('3. queued fetch + clear rejects', async () => {
    const queryFn = () => new Promise(() => {}); // Never resolves

    const promise1 = client.fetchQuery({ queryKey: ['k3'], queryFn });
    const promise2 = client.fetchQuery({ queryKey: ['k3'], queryFn }); // Deduped

    client.clear();

    await expect(promise1).rejects.toThrow();
    await expect(promise2).rejects.toThrow();
  }, 10000);

  it('4. queued fetch + destroy rejects', async () => {
    const queryFn = () => new Promise(() => {}); // Never resolves

    const promise1 = client.fetchQuery({ queryKey: ['k4'], queryFn });
    const promise2 = client.fetchQuery({ queryKey: ['k4'], queryFn }); // Deduped

    client.destroy();

    await expect(promise1).rejects.toThrow();
    await expect(promise2).rejects.toThrow();
  }, 10000);

  it('5. old fetch rejects while new fetch after clear succeeds', async () => {
    const queryFn = () => new Promise(() => {});

    const promise1 = client.fetchQuery({ queryKey: ['k5'], queryFn });
    client.clear();

    await expect(promise1).rejects.toThrow();

    const result = await client.fetchQuery({
      queryKey: ['k5'],
      queryFn: () => Promise.resolve('fresh'),
    });
    expect(result).toBe('fresh');
  });

  it('6. promise settles exactly once', async () => {
    let settleCount = 0;
    const queryFn = () => new Promise(() => {});

    const promise = client.fetchQuery({ queryKey: ['k6'], queryFn });
    promise.then(
      () => {
        settleCount++;
      },
      () => {
        settleCount++;
      },
    );

    client.clear();
    await new Promise((r) => setTimeout(r, 50));

    expect(settleCount).toBe(1);
  });

  it('7. multiple concurrent fetches all reject', async () => {
    const queryFn1 = () => new Promise(() => {});
    const queryFn2 = () => new Promise(() => {});

    const p1 = client.fetchQuery({ queryKey: ['k7a'], queryFn: queryFn1 });
    const p2 = client.fetchQuery({ queryKey: ['k7b'], queryFn: queryFn2 });

    client.clear();

    await expect(p1).rejects.toThrow();
    await expect(p2).rejects.toThrow();
  });

  it('8. clear during network request returns SC_CANCELLED error code', async () => {
    const queryFn = () => new Promise(() => {});

    const promise = client.fetchQuery({ queryKey: ['k8'], queryFn });
    client.clear();

    try {
      await promise;
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe('SC_CANCELLED');
    }
  });

  it('9. destroy during network request returns SC_CANCELLED error code', async () => {
    const queryFn = () => new Promise(() => {});

    const promise = client.fetchQuery({ queryKey: ['k9'], queryFn });
    client.destroy();

    try {
      await promise;
      expect.fail('Should have thrown');
    } catch (error: unknown) {
      expect((error as { code?: string }).code).toBe('SC_CANCELLED');
    }
  });

  it('10. fetch after clear succeeds normally', async () => {
    const queryFn1 = () => new Promise(() => {});
    const promise1 = client.fetchQuery({ queryKey: ['k10'], queryFn: queryFn1 });
    client.clear();
    await expect(promise1).rejects.toThrow();

    const result = await client.fetchQuery({
      queryKey: ['k10'],
      queryFn: () => Promise.resolve('success'),
    });
    expect(result).toBe('success');
  });
});
