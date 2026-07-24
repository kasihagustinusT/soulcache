import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Fetcher } from '../fetcher';
import type { FetchOptions, FetchMiddleware, FetchEvent } from '../types';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(text: string, status = 200): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

function errorResponse(status: number, body?: string): Response {
  return new Response(body ?? `Error ${status}`, { status });
}

describe('Fetcher', () => {
  let fetcher: Fetcher;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    fetcher = new Fetcher({
      fetchFn: mockFetch,
      defaultTimeout: 5000,
    });
  });

  describe('execute', () => {
    it('should execute a successful fetch', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ name: 'Alice' }));

      const result = await fetcher.execute<{ name: string }>(
        ['users', 123],
        { url: '/api/users/123' },
      );

      expect(result.data).toEqual({ name: 'Alice' });
      expect(result.status).toBe(200);
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.request.url).toBe('/api/users/123');
      expect(result.request.method).toBe('GET');
    });

    it('should send correct headers and body for POST', async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: 1 }, 201));

      await fetcher.execute(
        ['users'],
        {
          url: '/api/users',
          method: 'POST',
          body: { name: 'Bob' },
          headers: { 'X-Custom': 'test' },
        },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Custom': 'test',
          },
          body: JSON.stringify({ name: 'Bob' }),
        }),
      );
    });

    it('should not override Content-Type if already set', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await fetcher.execute(
        ['test'],
        {
          url: '/api',
          method: 'POST',
          body: { data: 1 },
          headers: { 'Content-Type': 'text/plain' },
        },
      );

      expect(mockFetch).toHaveBeenCalledWith(
        '/api',
        expect.objectContaining({
          headers: { 'Content-Type': 'text/plain' },
        }),
      );
    });

    it('should build URL from query key when url is not provided', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      await fetcher.execute(['users', '123']);

      expect(mockFetch).toHaveBeenCalledWith(
        '/users/123',
        expect.anything(),
      );
    });

    it('should classify HTTP errors', async () => {
      mockFetch.mockResolvedValue(errorResponse(404, 'Not Found'));

      await expect(
        fetcher.execute(['missing'], { url: '/api/missing' }),
      ).rejects.toMatchObject({
        name: 'FetchError',
        type: 'http',
        status: 404,
      });
    });

    it('should classify network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(
        fetcher.execute(['test'], { url: '/api/test' }),
      ).rejects.toMatchObject({
        name: 'FetchError',
        type: 'network',
      });
    });

    it('should handle text response type', async () => {
      mockFetch.mockResolvedValue(textResponse('hello world'));

      const result = await fetcher.execute(
        ['text'],
        { url: '/api/text', responseType: 'text' },
      );

      expect(result.data).toBe('hello world');
    });
  });

  describe('timeout', () => {
    it('should timeout when request exceeds timeout', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(jsonResponse({})), 10_000)),
      );

      await expect(
        fetcher.execute(['slow'], { url: '/api/slow', timeout: 50 }),
      ).rejects.toMatchObject({
        name: 'FetchError',
        type: 'timeout',
      });
    });

    it('should succeed within timeout', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(jsonResponse({ ok: true })), 10)),
      );

      const result = await fetcher.execute(
        ['fast'],
        { url: '/api/fast', timeout: 5000 },
      );

      expect(result.data).toEqual({ ok: true });
    });
  });

  describe('abort', () => {
    it('should abort via AbortSignal', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(jsonResponse({})), 10_000)),
      );

      const controller = new AbortController();
      const resultPromise = fetcher.execute(
        ['abortable'],
        { url: '/api/abortable', signal: controller.signal },
      );

      // Let the fetch start, then abort
      await new Promise((r) => setTimeout(r, 10));
      controller.abort();

      await expect(resultPromise).rejects.toMatchObject({
        name: 'FetchError',
        type: 'abort',
      });
    });

    it('should abort via fetcher.abort(id)', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(jsonResponse({})), 10_000)),
      );

      const resultPromise = fetcher.execute(
        ['manual'],
        { url: '/api/manual' },
      );

      // Get the request ID from the active controllers
      await new Promise((r) => setTimeout(r, 10));
      const activeIds = [...(fetcher as unknown as { controllers: Map<string, AbortController> }).controllers.keys()];
      expect(activeIds.length).toBe(1);

      fetcher.abort(activeIds[0]!);

      await expect(resultPromise).rejects.toMatchObject({
        name: 'FetchError',
        type: 'abort',
      });
    });

    it('should abort all requests', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve) => setTimeout(() => resolve(jsonResponse({})), 10_000)),
      );

      const p1 = fetcher.execute(['a'], { url: '/a' });
      const p2 = fetcher.execute(['b'], { url: '/b' });

      await new Promise((r) => setTimeout(r, 10));
      fetcher.abortAll();

      await expect(p1).rejects.toMatchObject({ type: 'abort' });
      await expect(p2).rejects.toMatchObject({ type: 'abort' });
    });
  });

  describe('deduplication', () => {
    it('should deduplicate identical concurrent requests', async () => {
      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        return new Promise((resolve) =>
          setTimeout(() => resolve(jsonResponse({ callCount })), 50),
        );
      });

      const [r1, r2] = await Promise.all([
        fetcher.execute(['dedup'], { url: '/api/dedup' }),
        fetcher.execute(['dedup'], { url: '/api/dedup' }),
      ]);

      // Only one actual fetch should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(r1.data).toEqual(r2.data);
    });

    it('should not deduplicate different methods', async () => {
      mockFetch.mockImplementation(() => jsonResponse({}));

      await Promise.all([
        fetcher.execute(['key'], { url: '/api', method: 'GET' }),
        fetcher.execute(['key'], { url: '/api', method: 'POST', body: {} }),
      ]);

      // Two fetches should be made (GET and POST)
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clean up dedup entries after completion', async () => {
      mockFetch.mockImplementation(() => jsonResponse({}));

      await fetcher.execute(['cleanup'], { url: '/api/cleanup' });

      expect(fetcher.inFlightCount).toBe(0);
    });
  });

  describe('middleware', () => {
    it('should execute user middleware', async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));

      const middleware: FetchMiddleware = async (request, next) => {
        const modified = {
          ...request,
          headers: { ...request.headers, 'X-Injected': 'true' },
        };
        return next(modified);
      };

      await fetcher.execute(['mw'], { url: '/api' }, [middleware]);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Injected': 'true' }),
        }),
      );
    });

    it('should allow middleware to short-circuit', async () => {
      const middleware: FetchMiddleware = async (_request, _next) => {
        return {
          data: { cached: true },
          status: 200,
          headers: new Headers(),
          duration: 0,
          request: _request,
        };
      };

      const result = await fetcher.execute(
        ['cached'],
        { url: '/api' },
        [middleware],
      );

      expect(result.data).toEqual({ cached: true });
      // Should not have called fetch
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should execute global middleware', async () => {
      const globalMiddleware: FetchMiddleware = async (request, next) => {
        const modified = {
          ...request,
          headers: { ...request.headers, 'X-Global': 'true' },
        };
        return next(modified);
      };

      const globalFetcher = new Fetcher({
        fetchFn: mockFetch,
        middleware: [globalMiddleware],
      });

      mockFetch.mockResolvedValue(jsonResponse({}));

      await globalFetcher.execute(['g'], { url: '/api' });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Global': 'true' }),
        }),
      );
    });

    it('should run user middleware before global middleware', async () => {
      const order: string[] = [];

      const userMw: FetchMiddleware = async (request, next) => {
        order.push('user');
        return next(request);
      };

      const globalMw: FetchMiddleware = async (request, next) => {
        order.push('global');
        return next(request);
      };

      const globalFetcher = new Fetcher({
        fetchFn: mockFetch,
        middleware: [globalMw],
      });

      mockFetch.mockResolvedValue(jsonResponse({}));

      await globalFetcher.execute(['order'], { url: '/api' }, [userMw]);

      expect(order).toEqual(['user', 'global']);
    });
  });

  describe('events', () => {
    it('should emit fetch:start event', async () => {
      const events: FetchEvent[] = [];
      const eventFetcher = new Fetcher({
        fetchFn: mockFetch,
        onEvent: (e) => events.push(e),
      });

      mockFetch.mockResolvedValue(jsonResponse({}));

      await eventFetcher.execute(['ev'], { url: '/api' });

      expect(events.some((e) => e.type === 'fetch:start')).toBe(true);
    });

    it('should emit fetch:success event', async () => {
      const events: FetchEvent[] = [];
      const eventFetcher = new Fetcher({
        fetchFn: mockFetch,
        onEvent: (e) => events.push(e),
      });

      mockFetch.mockResolvedValue(jsonResponse({}));

      await eventFetcher.execute(['ev2'], { url: '/api' });

      const success = events.find((e) => e.type === 'fetch:success');
      expect(success).toBeDefined();
      expect(success!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should emit fetch:error event on failure', async () => {
      const events: FetchEvent[] = [];
      const eventFetcher = new Fetcher({
        fetchFn: mockFetch,
        onEvent: (e) => events.push(e),
      });

      mockFetch.mockResolvedValue(errorResponse(500));

      await eventFetcher.execute(['ev3'], { url: '/api' }).catch(() => {});

      const error = events.find((e) => e.type === 'fetch:error');
      expect(error).toBeDefined();
      expect(error!.error).toBeDefined();
    });
  });

  describe('inFlightCount', () => {
    it('should track in-flight requests', async () => {
      let resolve!: (value: Response) => void;
      mockFetch.mockImplementation(() => new Promise((r) => { resolve = r; }));

      const p = fetcher.execute(['count'], { url: '/api' });

      expect(fetcher.inFlightCount).toBe(1);

      resolve(jsonResponse({}));
      await p;

      expect(fetcher.inFlightCount).toBe(0);
    });
  });
});
