import type { QueryKey } from '../types/query.types';
import { generateId } from '../utils/query.utils';
import type {
  FetchRequest,
  FetchResult,
  FetchOptions,
  FetchError,
  FetchMiddleware,
  FetchEvent,
  FetchEventType,
  FetcherOptions,
  ResponseType,
} from './types';

/**
 * Fetcher
 *
 * Orchestrates the fetch pipeline per FETCH_PIPELINE.md.
 * Manages AbortController lifecycle, timeout enforcement, request deduplication,
 * response normalization, and error classification.
 *
 * @example
 * ```ts
 * const fetcher = new Fetcher({ defaultTimeout: 10_000 });
 *
 * const result = await fetcher.execute<User>(['users', 123], {
 *   url: '/api/users/123',
 *   method: 'GET',
 * });
 *
 * console.log(result.data); // { id: 123, name: 'Alice' }
 * ```
 */
export class Fetcher {
  private readonly defaultTimeout: number;
  private readonly defaultResponseType: ResponseType;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly globalMiddleware: readonly FetchMiddleware[];
  private readonly onEvent: ((event: FetchEvent) => void) | undefined;

  /** In-flight request deduplication map: dedupKey → { promise, refCount } */
  private readonly inFlight: Map<string, {
    promise: Promise<FetchResult>;
    refCount: number;
  }> = new Map();

  /** Active AbortControllers by request ID */
  private readonly controllers: Map<string, AbortController> = new Map();

  constructor(options?: FetcherOptions) {
    this.defaultTimeout = options?.defaultTimeout ?? 30_000;
    this.defaultResponseType = options?.defaultResponseType ?? 'json';
    this.fetchFn = options?.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.globalMiddleware = options?.middleware ?? [];
    this.onEvent = options?.onEvent;
  }

  /**
   * Execute
   *
   * Runs a fetch operation through the full pipeline:
   * 1. Build request
   * 2. Setup abort signal
   * 3. Deduplication check
   * 4. Timeout enforcement
   * 5. Fetch execution
   * 6. Response handling
   * 7. Error classification
   * 8. Cleanup
   */
  async execute<T = unknown>(
    queryKey: QueryKey,
    options: FetchOptions = {},
    middleware?: readonly FetchMiddleware[],
  ): Promise<FetchResult<T>> {
    const startTime = Date.now();
    const request = this.buildRequest(queryKey, options, startTime);
    const controller = this.createController(request, options.signal);
    request.signal = controller.signal;

    const dedupKey = this.getDedupKey(queryKey, options);

    this.emit('fetch:start', request);

    try {
      const result = await this.deduplicate(dedupKey, async () => {
        return this.executePipeline<T>(request, controller, options, middleware);
      });

      this.emit('fetch:success', request, result.duration);
      return result;
    } catch (rawError) {
      const duration = Date.now() - startTime;
      const error = this.classifyError(rawError, request, duration);
      this.emit('fetch:error', request, error);
      throw error;
    } finally {
      this.cleanup(request.id);
    }
  }

  /**
   * Abort
   *
   * Cancels an in-flight request by ID.
   */
  abort(requestId: string): void {
    const controller = this.controllers.get(requestId);
    if (controller !== undefined) {
      controller.abort();
      this.controllers.delete(requestId);
    }
  }

  /**
   * Abort All
   *
   * Cancels all in-flight requests.
   */
  abortAll(): void {
    for (const [id] of this.controllers) {
      this.abort(id);
    }
  }

  /**
   * In-Flight Count
   *
   * Returns the number of deduplicated in-flight requests.
   */
  get inFlightCount(): number {
    return this.inFlight.size;
  }

  /**
   * Active Controller Count
   */
  get activeCount(): number {
    return this.controllers.size;
  }

  // ─── Pipeline Stages ──────────────────────────────────────────────

  /**
   * Build Request (Stage 1)
   *
   * Constructs a fully-resolved FetchRequest from QueryKey + options.
   */
  private buildRequest(queryKey: QueryKey, options: FetchOptions, startTime: number): FetchRequest {
    const url = options.url ?? this.buildUrl(queryKey);
    const method = options.method ?? 'GET';
    const headers: Record<string, string> = { ...options.headers };
    const body = options.body !== undefined ? JSON.stringify(options.body) : undefined;

    if (body !== undefined && headers['Content-Type'] === undefined) {
      headers['Content-Type'] = 'application/json';
    }

    return {
      id: generateId(),
      url,
      method,
      headers,
      body,
      timeout: options.timeout ?? this.defaultTimeout,
      responseType: options.responseType ?? this.defaultResponseType,
      queryKey,
      _startTime: startTime,
    } as FetchRequest & { _startTime: number };
  }

  /**
   * Build URL from QueryKey
   *
   * Default: serializes key segments as URL path.
   */
  private buildUrl(queryKey: QueryKey): string {
    return `/${queryKey.map((segment) => encodeURIComponent(String(segment))).join('/')}`;
  }

  /**
   * Create Controller (Stage 2)
   *
   * Creates an AbortController and chains the external signal.
   */
  private createController(request: FetchRequest, externalSignal?: AbortSignal): AbortController {
    const controller = new AbortController();
    this.controllers.set(request.id, controller);

    if (externalSignal !== undefined) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
      }
    }

    return controller;
  }

  /**
   * Execute Pipeline (Stages 3-6)
   *
   * Runs timeout enforcement, middleware chain, fetch, and response handling.
   */
  private async executePipeline<T>(
    request: FetchRequest,
    _controller: AbortController,
    options: FetchOptions,
    userMiddleware: readonly FetchMiddleware[] | undefined,
  ): Promise<FetchResult<T>> {
    const fetchFn = options.fetchFn ?? this.fetchFn;

    // Build middleware chain (user middleware first, then global)
    const chain = this.buildMiddlewareChain(userMiddleware, fetchFn);

    // Apply timeout (Stage 3)
    if (request.timeout > 0) {
      return this.withTimeout(
        chain(request),
        request.signal,
        request.timeout,
        request,
      ) as Promise<FetchResult<T>>;
    }

    return chain(request) as Promise<FetchResult<T>>;
  }

  /**
   * Build Middleware Chain
   *
   * Creates a composed function that runs middleware then the final fetcher.
   */
  private buildMiddlewareChain(
    userMiddleware: readonly FetchMiddleware[] | undefined,
    fetchFn: typeof globalThis.fetch,
  ): (request: FetchRequest) => Promise<FetchResult> {
    const middlewares = [
      ...(userMiddleware ?? []),
      ...this.globalMiddleware,
    ];

    // The final handler is the actual fetch execution
    const finalHandler = async (request: FetchRequest): Promise<FetchResult> => {
      return this.executeFetch(request, fetchFn);
    };

    if (middlewares.length === 0) {
      return finalHandler;
    }

    let index = 0;
    const next = (request: FetchRequest): Promise<FetchResult> => {
      if (index >= middlewares.length) {
        return finalHandler(request);
      }
      const middleware = middlewares[index]!;
      index++;
      return middleware(request, next);
    };

    return next;
  }

  /**
   * Execute Fetch (Stage 5)
   *
   * Calls the actual fetch function and measures timing.
   */
  private async executeFetch(
    request: FetchRequest,
    fetchFn: typeof globalThis.fetch,
  ): Promise<FetchResult> {
    const init: RequestInit = {
      method: request.method,
      headers: request.headers,
      signal: request.signal ?? null,
    };

    if (request.body !== undefined) {
      init.body = request.body;
    }

    const response = await fetchFn(request.url, init);
    const data = await this.handleResponse(response, request);
    const startTime = (request as unknown as { _startTime: number })._startTime;
    const duration = Date.now() - startTime;

    return {
      data,
      status: response.status,
      headers: response.headers,
      duration,
      request,
    };
  }

  /**
   * Handle Response (Stage 6)
   *
   * Parses the response body based on the expected response type.
   */
  private async handleResponse(response: Response, request: FetchRequest): Promise<unknown> {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const error = new Error(`HTTP ${response.status}: ${text || response.statusText}`);
      Object.defineProperty(error, 'name', { value: 'FetchError', configurable: true });
      Object.defineProperty(error, 'type', { value: 'http' as const, configurable: true });
      Object.defineProperty(error, 'status', { value: response.status, configurable: true });
      throw error;
    }

    switch (request.responseType) {
      case 'json':
        return response.json();
      case 'text':
        return response.text();
      case 'blob':
        return response.blob();
      case 'stream':
        return response.body;
      default: {
        const contentType = response.headers.get('content-type') ?? '';
        if (contentType.includes('application/json')) {
          return response.json();
        }
        return response.text();
      }
    }
  }

  /**
   * With Timeout
   *
   * Wraps a promise with timeout enforcement using AbortSignal.
   */
  private async withTimeout<T>(
    promise: Promise<T>,
    signal: AbortSignal | undefined,
    timeoutMs: number,
    request: FetchRequest,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        const startTime = (request as unknown as { _startTime: number })._startTime;
        reject(this.createAbortError(request, Date.now() - startTime));
        return;
      }

      const timer = setTimeout(() => {
        const startTime = (request as unknown as { _startTime: number })._startTime;
        reject(this.createTimeoutError(timeoutMs, request, Date.now() - startTime));
      }, timeoutMs);

      const onAbort = () => {
        clearTimeout(timer);
        const startTime = (request as unknown as { _startTime: number })._startTime;
        reject(this.createAbortError(request, Date.now() - startTime));
      };

      if (signal !== undefined) {
        signal.addEventListener('abort', onAbort, { once: true });
      }

      promise.then(
        (value) => {
          clearTimeout(timer);
          if (signal !== undefined) {
            signal.removeEventListener('abort', onAbort);
          }
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          if (signal !== undefined) {
            signal.removeEventListener('abort', onAbort);
          }
          reject(error);
        },
      );
    });
  }

  // ─── Deduplication (Stage 4) ──────────────────────────────────────

  /**
   * Deduplicate
   *
   * If an identical request is in-flight, returns the shared promise.
   * Otherwise, executes and registers the promise.
   */
  private async deduplicate<T>(
    key: string,
    fn: () => Promise<FetchResult<T>>,
  ): Promise<FetchResult<T>> {
    const existing = this.inFlight.get(key);

    if (existing !== undefined) {
      existing.refCount++;
      this.emit('fetch:dedup', { id: key, queryKey: [], timeout: 0, responseType: 'json', headers: {}, method: 'GET', url: '' } as FetchRequest);
      return existing.promise as Promise<FetchResult<T>>;
    }

    const promise = fn().finally(() => {
      const entry = this.inFlight.get(key);
      if (entry !== undefined && --entry.refCount <= 0) {
        this.inFlight.delete(key);
      }
    });

    this.inFlight.set(key, {
      promise: promise as unknown as Promise<FetchResult>,
      refCount: 1,
    });

    return promise;
  }

  /**
   * Get Dedup Key
   *
   * Computes a deduplication key from QueryKey + method + URL.
   */
  private getDedupKey(queryKey: QueryKey, options: FetchOptions): string {
    const method = options.method ?? 'GET';
    const url = options.url ?? this.buildUrl(queryKey);
    return `${method}:${url}`;
  }

  // ─── Error Classification (Stage 7/8) ─────────────────────────────

  /**
   * Classify Error
   *
   * Wraps raw errors into typed FetchError with category.
   */
  private classifyError(
    error: unknown,
    request: FetchRequest,
    duration: number,
  ): FetchError {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return this.createAbortError(request, duration);
    }

    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return this.createTimeoutError(request.timeout, request, duration);
    }

    // Already-classified FetchError from handleResponse (http errors)
    if (this.isFetchError(error)) {
      return error;
    }

    // Pre-classified via Object.defineProperty (http errors from handleResponse)
    if (
      error instanceof Error &&
      error.name === 'FetchError' &&
      'type' in error
    ) {
      Object.defineProperty(error, 'duration', { value: duration, configurable: true });
      Object.defineProperty(error, 'request', { value: request, configurable: true });
      return error as FetchError;
    }

    // Network errors (TypeError from fetch, DNS failures, etc.)
    if (error instanceof TypeError) {
      const fetchError = new Error(error.message) as FetchError;
      Object.defineProperty(fetchError, 'type', { value: 'network' as const, configurable: true });
      Object.defineProperty(fetchError, 'cause', { value: error, configurable: true });
      Object.defineProperty(fetchError, 'duration', { value: duration, configurable: true });
      Object.defineProperty(fetchError, 'request', { value: request, configurable: true });
      fetchError.name = 'FetchError';
      return fetchError;
    }

    // Unknown errors
    const message = error instanceof Error ? error.message : String(error);
    const fetchError = new Error(message) as FetchError;
    Object.defineProperty(fetchError, 'type', { value: 'network' as const, configurable: true });
    Object.defineProperty(fetchError, 'cause', { value: error, configurable: true });
    Object.defineProperty(fetchError, 'duration', { value: duration, configurable: true });
    Object.defineProperty(fetchError, 'request', { value: request, configurable: true });
    fetchError.name = 'FetchError';
    return fetchError;
  }

  private createAbortError(request: FetchRequest, duration: number): FetchError {
    const error = new Error('Request was aborted') as FetchError;
    Object.defineProperty(error, 'type', { value: 'abort' as const, configurable: true });
    Object.defineProperty(error, 'duration', { value: duration, configurable: true });
    Object.defineProperty(error, 'request', { value: request, configurable: true });
    error.name = 'FetchError';
    return error;
  }

  private createTimeoutError(timeoutMs: number, request: FetchRequest, duration: number): FetchError {
    const error = new Error(`Request timed out after ${timeoutMs}ms`) as FetchError;
    Object.defineProperty(error, 'type', { value: 'timeout' as const, configurable: true });
    Object.defineProperty(error, 'duration', { value: duration, configurable: true });
    Object.defineProperty(error, 'request', { value: request, configurable: true });
    error.name = 'FetchError';
    return error;
  }

  private isFetchError(error: unknown): error is FetchError {
    return (
      error instanceof Error &&
      error.name === 'FetchError' &&
      'type' in error
    );
  }

  // ─── Events ────────────────────────────────────────────────────────

  private emit(type: FetchEventType, request: FetchRequest, data?: unknown): void {
    if (this.onEvent === undefined) return;

    const event: FetchEvent = {
      type,
      requestId: request.id,
      queryKey: request.queryKey,
      timestamp: Date.now(),
    };

    if (type === 'fetch:success' && typeof data === 'number') {
      Object.defineProperty(event, 'duration', { value: data, configurable: true });
    }
    if (type === 'fetch:error' && data instanceof Error) {
      Object.defineProperty(event, 'error', { value: data, configurable: true });
    }

    this.onEvent(event);
  }

  // ─── Cleanup (Stage 9) ────────────────────────────────────────────

  private cleanup(requestId: string): void {
    this.controllers.delete(requestId);
  }
}
