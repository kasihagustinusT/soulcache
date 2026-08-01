import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher } from '../fetcher';

function jsonResponse(data: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function errorResponse(status: number): Promise<Response> {
  return Promise.resolve(new Response(null, { status }));
}

describe('Fetcher deduplication refCount must not leak', () => {
  let fetcher: Fetcher;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    fetcher = new Fetcher({
      fetchFn: mockFetch as any,
      defaultTimeout: 5000,
    });
  });

  it('should clean up inFlight entry after all concurrent callers settle (success)', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(jsonResponse({ ok: true })), 50)),
    );

    // 3 concurrent callers for the same key
    const [r1, r2, r3] = await Promise.all([
      fetcher.execute(['dedup-test'], { url: '/api/test' }),
      fetcher.execute(['dedup-test'], { url: '/api/test' }),
      fetcher.execute(['dedup-test'], { url: '/api/test' }),
    ]);

    // Only 1 actual fetch should have been made
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // All should get the same result
    expect(r1.data).toEqual({ ok: true });
    expect(r2.data).toEqual({ ok: true });
    expect(r3.data).toEqual({ ok: true });

    // inFlight should be cleaned up
    expect(fetcher.inFlightCount).toBe(0);
  });

  it('should clean up inFlight entry after all concurrent callers settle (error)', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(errorResponse(500)), 50)),
    );

    // 3 concurrent callers — all should reject
    const results = await Promise.allSettled([
      fetcher.execute(['dedup-error'], { url: '/api/error' }),
      fetcher.execute(['dedup-error'], { url: '/api/error' }),
      fetcher.execute(['dedup-error'], { url: '/api/error' }),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);

    // All should be rejected
    results.forEach((r) => {
      expect(r.status).toBe('rejected');
    });

    // inFlight should be cleaned up
    expect(fetcher.inFlightCount).toBe(0);
  });

  it('should allow new request after cleanup (no stale state)', async () => {
    let callCount = 0;

    mockFetch.mockImplementation(() => {
      callCount++;
      return Promise.resolve(jsonResponse({ callCount }));
    });

    // First batch
    const [r1, r2] = await Promise.all([
      fetcher.execute(['dedup-reuse'], { url: '/api/reuse' }),
      fetcher.execute(['dedup-reuse'], { url: '/api/reuse' }),
    ]);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(r1.data).toEqual({ callCount: 1 });
    expect(fetcher.inFlightCount).toBe(0);

    // Second batch — should start a new request, not reuse stale state
    const r3 = await fetcher.execute(['dedup-reuse'], { url: '/api/reuse' });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(r3.data).toEqual({ callCount: 2 });
    expect(fetcher.inFlightCount).toBe(0);
  });

  it('should handle mixed success/failure without leaking', async () => {
    let callCount = 0;

    mockFetch.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(jsonResponse({ ok: true }));
      }
      return Promise.resolve(errorResponse(500));
    });

    // First request succeeds
    const r1 = await fetcher.execute(['dedup-mixed-1'], { url: '/api/mixed' });
    expect(r1.data).toEqual({ ok: true });
    expect(fetcher.inFlightCount).toBe(0);

    // Second request fails
    await expect(fetcher.execute(['dedup-mixed-2'], { url: '/api/mixed' })).rejects.toThrow();
    expect(fetcher.inFlightCount).toBe(0);
  });

  it('should not leak when requests are sequential', async () => {
    mockFetch.mockImplementation(() => Promise.resolve(jsonResponse({})));

    for (let i = 0; i < 10; i++) {
      await fetcher.execute(['seq-' + i], { url: '/api/' + i });
    }

    expect(fetcher.inFlightCount).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(10);
  });

  it('should handle rapid interleaved dedup and non-dedup requests', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(jsonResponse({})), 10)),
    );

    // Mix of same-key and different-key requests
    const promises = [
      fetcher.execute(['key-a'], { url: '/api/a' }),
      fetcher.execute(['key-a'], { url: '/api/a' }),
      fetcher.execute(['key-b'], { url: '/api/b' }),
      fetcher.execute(['key-a'], { url: '/api/a' }),
      fetcher.execute(['key-b'], { url: '/api/b' }),
    ];

    await Promise.all(promises);

    // 2 actual fetches (key-a and key-b)
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(fetcher.inFlightCount).toBe(0);
  });

  it('inFlight count should be 0 after all operations complete', async () => {
    mockFetch.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(jsonResponse({})), 20)),
    );

    await Promise.all([
      fetcher.execute(['c1'], { url: '/api/1' }),
      fetcher.execute(['c1'], { url: '/api/1' }),
      fetcher.execute(['c2'], { url: '/api/2' }),
      fetcher.execute(['c2'], { url: '/api/2' }),
      fetcher.execute(['c2'], { url: '/api/2' }),
    ]);

    expect(fetcher.inFlightCount).toBe(0);
  });
});
