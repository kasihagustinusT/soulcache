import type { QueryKey } from '../types/query.types';
import type { QueryClientConfig } from '../types/client.types';
import type { QuerySnapshot } from '../types/observer.types';
import { QueryClient } from '../client/query-client';
import { RetryEngine } from '../retry/retry-engine';
import type { RetryConfig } from '../retry/types';
import { hashQueryKey } from '../utils/query.utils';

/**
 * Query Engine Options
 */
export interface QueryEngineOptions {
  readonly clientConfig?: QueryClientConfig;
  readonly refetchOnWindowFocus?: boolean;
  readonly refetchInterval?: number;
  readonly staleTime?: number;
  readonly gcTime?: number;
}

/**
 * Query Engine Metrics
 */
export interface QueryEngineMetrics {
  readonly totalExecuted: number;
  readonly cacheHits: number;
  readonly cacheMisses: number;
  readonly totalRetries: number;
  readonly totalCancellations: number;
  readonly activeQueries: number;
  readonly activeRefetches: number;
}

/**
 * Query Engine
 *
 * Orchestration layer that coordinates QueryClient, RetryEngine, and
 * background synchronization.
 */
export class QueryEngine {
  private readonly _client: QueryClient;
  private readonly _retryEngine: RetryEngine;

  private readonly _refetchInterval: number;
  private readonly _staleTime: number;

  private readonly _abortControllers: Map<string, AbortController> = new Map();
  private readonly _refetchTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly _refetchFns: Map<string, { queryFn: (signal: AbortSignal) => Promise<unknown>; retry?: Partial<RetryConfig> }> = new Map();

  private _totalExecuted = 0;
  private _cacheHits = 0;
  private _cacheMisses = 0;
  private _totalRetries = 0;
  private _totalCancellations = 0;
  private _destroyed = false;

  constructor(options?: QueryEngineOptions) {
    this._refetchInterval = options?.refetchInterval ?? 0;
    this._staleTime = options?.staleTime ?? 0;

    this._client = new QueryClient(options?.clientConfig);
    this._retryEngine = new RetryEngine();
  }

  get client(): QueryClient {
    return this._client;
  }

  get isDestroyed(): boolean {
    return this._destroyed;
  }

  async executeQuery<T>(options: {
    readonly queryKey: QueryKey;
    readonly queryFn: (signal: AbortSignal) => Promise<T>;
    readonly retry?: Partial<RetryConfig>;
    readonly staleTime?: number;
  }): Promise<T> {
    this.assertNotDestroyed();

    const { queryKey, queryFn, staleTime } = options;
    const keyHash = hashQueryKey(queryKey);

    const cached = this._client.getQueryData<T>(queryKey);
    const entry = this._client.getCache().get(queryKey);
    if (cached !== undefined && entry) {
      const age = Date.now() - new Date(entry.updatedAt).getTime();
      const maxAge = staleTime ?? this._staleTime;
      if (maxAge > 0 && age < maxAge) {
        this._cacheHits++;
        return cached;
      }
    }

    this._cacheMisses++;

    this.cancelExistingFetch(queryKey);

    const controller = new AbortController();
    this._abortControllers.set(keyHash, controller);

    this._totalExecuted++;

    try {
      const retryConfig: Partial<RetryConfig> = { ...options.retry };

      const result = await this._retryEngine.execute(
        async (_attempt, signal) => {
          return queryFn(signal);
        },
        {
          maxRetries: retryConfig.maxRetries ?? 3,
          baseDelay: retryConfig.baseDelay ?? 1000,
          maxDelay: retryConfig.maxDelay ?? 30_000,
          backoff: retryConfig.backoff ?? 'exponential',
          jitter: retryConfig.jitter ?? true,
        },
        queryKey,
        controller.signal,
      );

      if (!result.success) {
        throw result.error;
      }

      const retries = result.attempts > 0 ? result.attempts - 1 : 0;
      this._totalRetries += retries;

      this._client.setQueryData(queryKey, result.data);

      if (this._refetchInterval > 0) {
        this.scheduleRefetch(queryKey, queryFn, options.retry);
      }

      return result.data as T;
    } finally {
      this._abortControllers.delete(keyHash);
    }
  }

  cancelQuery(queryKey: QueryKey): void {
    this.cancelExistingFetch(queryKey);
    this.cancelRefetch(queryKey);
  }

  async invalidateQueries(queryKey: QueryKey): Promise<void> {
    this.assertNotDestroyed();
    await this._client.invalidateQueries(queryKey);
  }

  setQueryData<T>(queryKey: QueryKey, data: T | ((prev: T | undefined) => T)): void {
    this.assertNotDestroyed();
    this._client.setQueryData(queryKey, data);
  }

  getQueryData<T>(queryKey: QueryKey): T | undefined {
    this.assertNotDestroyed();
    return this._client.getQueryData<T>(queryKey);
  }

  subscribe<T>(queryKey: QueryKey, callback: (snapshot: QuerySnapshot<T>) => void): () => void {
    this.assertNotDestroyed();
    return this._client.subscribe(queryKey, callback);
  }

  getMetrics(): QueryEngineMetrics {
    return {
      totalExecuted: this._totalExecuted,
      cacheHits: this._cacheHits,
      cacheMisses: this._cacheMisses,
      totalRetries: this._totalRetries,
      totalCancellations: this._totalCancellations,
      activeQueries: this._abortControllers.size,
      activeRefetches: this._refetchTimers.size,
    };
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    for (const controller of this._abortControllers.values()) {
      controller.abort();
    }
    this._abortControllers.clear();

    for (const timer of this._refetchTimers.values()) {
      clearTimeout(timer);
    }
    this._refetchTimers.clear();
    this._refetchFns.clear();

    this._client.destroy();
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private cancelExistingFetch(queryKey: QueryKey): void {
    const keyHash = hashQueryKey(queryKey);
    const controller = this._abortControllers.get(keyHash);
    if (controller) {
      controller.abort();
      this._abortControllers.delete(keyHash);
      this._totalCancellations++;
    }
  }

  private scheduleRefetch<T>(
    queryKey: QueryKey,
    queryFn: (signal: AbortSignal) => Promise<T>,
    retry?: Partial<RetryConfig>,
  ): void {
    const keyHash = hashQueryKey(queryKey);

    const existing = this._refetchTimers.get(keyHash);
    if (existing !== undefined) {
      clearTimeout(existing);
    }

    this._refetchFns.set(keyHash, {
      queryFn: queryFn as (signal: AbortSignal) => Promise<unknown>,
      ...(retry !== undefined ? { retry } : {}),
    });

    const timer = setTimeout(() => {
      this._refetchTimers.delete(keyHash);

      if (this._destroyed) return;

      const refetch = this._refetchFns.get(keyHash);
      if (refetch) {
        const opts: {
          queryKey: QueryKey;
          queryFn: (signal: AbortSignal) => Promise<T>;
          retry?: Partial<RetryConfig>;
        } = {
          queryKey,
          queryFn: refetch.queryFn as (signal: AbortSignal) => Promise<T>,
        };
        if (refetch.retry !== undefined) {
          opts.retry = refetch.retry;
        }
        this.executeQuery(opts).catch(() => {});
      }
    }, this._refetchInterval);

    this._refetchTimers.set(keyHash, timer);
  }

  private cancelRefetch(queryKey: QueryKey): void {
    const keyHash = hashQueryKey(queryKey);
    const timer = this._refetchTimers.get(keyHash);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._refetchTimers.delete(keyHash);
      this._refetchFns.delete(keyHash);
    }
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('QueryEngine has been destroyed');
    }
  }
}
