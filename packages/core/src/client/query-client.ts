import type { QueryKey, Updater } from '../types/query.types';
import type { QueryClientConfig } from '../types/client.types';
import type { QuerySnapshot } from '../types/observer.types';
import type { QueryRecordState } from '../types/internal.types';
import type { QueryStatus, FetchStatus } from '../types/query.types';
import type { CacheEventPayload } from '../types/events.types';
import { CacheEngine } from '../cache/cache-engine';
import { QueryStateMachine } from '../query/state-machine';
import { QueryObserver } from '../observer/query-observer';
import { MutationCache } from '../mutation/mutation-cache';
import { Scheduler } from '../scheduler/scheduler';
import { EventBus } from '../events/event-bus';
import { SoulCacheError, RuntimeError } from '../errors/soulcache-error';
import { ErrorCode } from '../errors/error-codes';
import { hashQueryKey, generateId } from '../utils/query.utils';

/**
 * Map internal QueryRecordState to public QueryStatus.
 * Shared between QueryClient and QueryObserver.
 */
function mapStateToStatus(state: QueryRecordState): QueryStatus {
  switch (state) {
    case 'idle':
      return 'idle';
    case 'pending':
    case 'fetching':
      return 'loading';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'stale':
      return 'fetching';
    case 'invalidated':
      return 'loading';
    case 'destroyed':
      return 'idle';
    default:
      return 'idle';
  }
}

/**
 * Query Client
 *
 * Central orchestration layer connecting CacheEngine, QueryStateMachine,
 * and QueryObserver. Owns the lifecycle coordination only — storage is
 * delegated to CacheEngine, transitions to QueryStateMachine, and
 * subscriptions to QueryObserver.
 *
 * @example
 * ```ts
 * const client = new QueryClient();
 *
 * // Manual data management
 * client.setQueryData(['users', 1], { id: 1, name: 'Alice' });
 * const user = client.getQueryData<{ id: number; name: string }>(['users', 1]);
 *
 * // Fetch with cache coordination
 * const data = await client.fetchQuery({
 *   queryKey: ['users', 1],
 *   queryFn: () => fetch('/api/users/1').then(r => r.json()),
 * });
 *
 * // Subscribe to changes
 * const unsubscribe = client.subscribe(['users', 1], (snapshot) => {
 *   console.log(snapshot.data);
 * });
 *
 * // Cleanup
 * client.destroy();
 * ```
 */
export class QueryClient {
  private readonly _cache: CacheEngine;
  private readonly _mutationCache: MutationCache;
  private readonly _scheduler: Scheduler;
  private readonly _eventBus: EventBus;
  private readonly _config: QueryClientConfig;
  private readonly _stateMachines: Map<string, QueryStateMachine> = new Map();
  private readonly _observers: Map<string, Set<QueryObserver<unknown>>> = new Map();
  private readonly _pendingFetches: Map<string, Promise<unknown>> = new Map();
  private readonly _snapshotCache: Map<string, QuerySnapshot<unknown>> = new Map();
  private _destroyed: boolean;

  constructor(config?: QueryClientConfig) {
    this._config = config ?? {};
    const cacheOptions: { staleTime?: number; gcTime?: number } = {};
    if (this._config.defaultOptions?.staleTime !== undefined) {
      cacheOptions.staleTime = this._config.defaultOptions.staleTime;
    }
    if (this._config.defaultOptions?.gcTime !== undefined) {
      cacheOptions.gcTime = this._config.defaultOptions.gcTime;
    }
    this._cache = new CacheEngine(cacheOptions);
    this._mutationCache = new MutationCache();
    this._eventBus = new EventBus();
    this._scheduler = new Scheduler({ eventBus: this._eventBus });
    this._destroyed = false;
  }

  /**
   * Whether the client has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Number of tracked queries.
   */
  get queryCount(): number {
    return this._stateMachines.size;
  }

  /**
   * Get the underlying cache engine.
   * Used by hydration and framework adapters.
   */
  getCache(): CacheEngine {
    return this._cache;
  }

  /**
   * Get the mutation cache.
   * Used by framework adapters to access mutation state.
   */
  getMutationCache(): MutationCache {
    return this._mutationCache;
  }

  /**
   * Get the scheduler.
   * Used for advanced scheduling control and observability.
   */
  getScheduler(): Scheduler {
    return this._scheduler;
  }

  /**
   * Execute a mutation through the client.
   *
   * Creates a mutation entry in the MutationCache, executes it,
   * and returns the result.
   *
   * @param options - Mutation configuration (variables are required for immediate execution)
   * @returns The mutation result
   */
  async mutate<TData, TVariables = void>(options: {
    readonly mutationId?: string;
    readonly mutationFn: (variables: TVariables) => Promise<TData>;
    readonly variables: TVariables;
    readonly onMutate?: (variables: TVariables) => unknown;
    readonly onSuccess?: (data: TData, variables: TVariables) => void;
    readonly onError?: (error: Error, variables: TVariables) => void;
    readonly onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
    readonly retry?: number;
    readonly retryDelay?: number;
  }): Promise<TData> {
    this.assertNotDestroyed();

    const mutationId = options.mutationId ?? generateId();
    const entry = this._mutationCache.create({
      ...options,
      mutationId,
    });
    return entry.mutate(options.variables);
  }

  /**
   * Get the current snapshot for a query.
   *
   * Returns an immutable snapshot suitable for use with
   * useSyncExternalStore's getSnapshot parameter.
   *
   * @param queryKey - The query key
   * @returns The current query snapshot, or undefined if no query exists
   */
  getQuerySnapshot<T>(queryKey: QueryKey): QuerySnapshot<T> | undefined {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);
    const entry = this._cache.get<T>(queryKey);
    const sm = this._stateMachines.get(keyHash);

    if (!entry && !sm) {
      this._snapshotCache.delete(keyHash);
      return undefined;
    }

    const status: QueryStatus = mapStateToStatus(entry?.state ?? 'idle');
    const fetchStatus: FetchStatus = entry?.fetchStatus ?? 'idle';
    const data = entry?.data;
    const error = entry?.error ?? null;
    // Convert ISO-8601 string to number for public API
    const updatedAt = entry?.updatedAt
      ? new Date(entry.updatedAt).getTime()
      : Date.now();

    // Return cached snapshot if nothing changed (structural sharing for useSyncExternalStore)
    const cached = this._snapshotCache.get(keyHash) as QuerySnapshot<T> | undefined;
    if (
      cached &&
      cached.status === status &&
      cached.fetchStatus === fetchStatus &&
      cached.data === data &&
      cached.error === error
    ) {
      return cached;
    }

    const snapshot: QuerySnapshot<T> = Object.freeze({
      queryId: keyHash,
      status,
      fetchStatus,
      data,
      error,
      updatedAt,
    }) as QuerySnapshot<T>;

    this._snapshotCache.set(keyHash, snapshot);
    return snapshot;
  }

  /**
   * Subscribe to query state changes with bare notification.
   *
   * Compatible with useSyncExternalStore's subscribe parameter.
   * The callback receives no arguments and should call getQuerySnapshot()
   * to get the current state.
   *
   * @param queryKey - The query key to observe
   * @param listener - Function called on each state change (no arguments)
   * @returns Unsubscribe function
   */
  subscribeToQuery(
    queryKey: QueryKey,
    listener: () => void,
  ): () => void {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);
    this._ensureStateMachine(keyHash, queryKey);

    // Wire state machine transitions to notify the bare listener.
    const sm = this._stateMachines.get(keyHash);
    const unsubTransition = sm?.onTransition(() => {
      listener();
    });

    // Also listen for cache updates (setQueryData, invalidateQueries)
    const unsubCache = this._eventBus.subscribe<CacheEventPayload>('cache.updated', (event) => {
      const eventHash = hashQueryKey(event.payload.queryKey as QueryKey);
      if (eventHash === keyHash) {
        listener();
      }
    });

    return () => {
      unsubTransition?.();
      unsubCache();
    };
  }

  /**
   * Fetch data for a query key, managing the full cache lifecycle.
   *
   * If a fetch is already in progress for this key, the existing promise
   * is returned to prevent duplicate requests.
   *
   * @param options - Query key and fetch function
   * @returns The fetched data
   * @throws {RuntimeError} if client is destroyed
   * @throws {SoulCacheError} if fetchFn is not provided
   */
  async fetchQuery<T>(options: {
    queryKey: QueryKey;
    queryFn: () => Promise<T>;
  }): Promise<T> {
    this.assertNotDestroyed();

    const { queryKey, queryFn } = options;

    if (!queryFn) {
      throw new SoulCacheError({
        code: ErrorCode.INVALID_CONFIGURATION,
        message: 'queryFn is required for fetchQuery',
      });
    }

    const keyHash = hashQueryKey(queryKey);

    // Deduplicate in-flight requests
    const pending = this._pendingFetches.get(keyHash);
    if (pending) {
      return pending as Promise<T>;
    }

    const fetchPromise = this._executeFetch<T>(queryKey, queryFn);
    this._pendingFetches.set(keyHash, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this._pendingFetches.delete(keyHash);
    }
  }

  /**
   * Read cached data for a query key.
   *
   * @param queryKey - The query key to look up
   * @returns The cached data, or undefined if not found
   */
  getQueryData<T>(queryKey: QueryKey): T | undefined {
    this.assertNotDestroyed();

    const entry = this._cache.get<T>(queryKey);
    return entry?.data;
  }

  /**
   * Update cached data manually.
   *
   * Notifies all observers of the query.
   *
   * @param queryKey - The query key to update
   * @param updater - New data or updater function
   */
  setQueryData<T>(queryKey: QueryKey, updater: Updater<T>): void {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);
    const existing = this._cache.get<T>(queryKey);

    const prevData = existing?.data;
    const nextData =
      typeof updater === 'function'
        ? (updater as (prev: T | undefined) => T)(prevData)
        : updater;

    // Update cache
    this._cache.set({
      queryKey,
      data: nextData,
      state: 'success',
    });

    // Ensure state machine exists
    this._ensureStateMachine(keyHash, queryKey);

    // Transition state machine to success if possible
    const sm = this._stateMachines.get(keyHash);
    if (sm && sm.canTransition('success')) {
      sm.transition('success');
    }

    // Notify observers
    this._notifyObservers(keyHash, (observer) => {
      (observer as QueryObserver<T>).setData(nextData);
    });

    this._eventBus.emit({
      type: 'cache.updated',
      source: 'internal',
      payload: { queryId: keyHash, queryKey },
    });
  }

  /**
   * Subscribe to query state changes.
   *
   * Creates an observer for the query key and invokes the callback
   * on each state change. Returns an unsubscribe function.
   *
   * @param queryKey - The query key to observe
   * @param callback - Invoked with each new snapshot
   * @returns Unsubscribe function
   */
  subscribe<T>(
    queryKey: QueryKey,
    callback: (snapshot: QuerySnapshot<T>) => void,
  ): () => void {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);
    const queryId = this._ensureStateMachine(keyHash, queryKey);

    // Get existing data for initial snapshot
    const entry = this._cache.get<T>(queryKey);

    const observerOptions: {
      queryId: string;
      queryKey: readonly unknown[];
      initialState?: 'idle' | 'pending' | 'success' | 'error' | 'fetching' | 'stale' | 'invalidated' | 'destroyed';
      initialData?: T;
      initialError?: Error | null;
      eventBus: EventBus;
    } = {
      queryId,
      queryKey,
      eventBus: this._eventBus,
    };
    if (entry?.state !== undefined) {
      observerOptions.initialState = entry.state;
    }
    if (entry?.data !== undefined) {
      observerOptions.initialData = entry.data;
    }
    if (entry?.error !== undefined && entry.error !== null) {
      observerOptions.initialError = entry.error;
    }

    const observer = new QueryObserver<T>(observerOptions);

    // Track observer
    let observerSet = this._observers.get(keyHash);
    if (!observerSet) {
      observerSet = new Set();
      this._observers.set(keyHash, observerSet);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    observerSet.add(observer as any);

    // Increment observer count on cache entry
    if (entry) {
      entry.observerCount++;
    }

    // Wire state machine transitions to observer updates
    const sm = this._stateMachines.get(keyHash);
    const unsubTransition = sm?.onTransition((_from, to) => {
      const updateOptions: {
        data?: T;
        error?: Error | null;
      } = {};
      if (entry?.data !== undefined) {
        updateOptions.data = entry.data;
      }
      if (entry?.error !== undefined && entry.error !== null) {
        updateOptions.error = entry.error;
      }
      observer.setState(to, updateOptions);
    });

    // Subscribe callback to observer
    const unsubObserver = observer.subscribe(
      callback as (snapshot: QuerySnapshot<unknown>) => void,
    );

    // Return combined unsubscribe
    return () => {
      unsubObserver();
      unsubTransition?.();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      observerSet?.delete(observer as any);
      if (observerSet?.size === 0) {
        this._observers.delete(keyHash);
      }

      observer.destroy();

      // Decrement observer count on cache entry
      const cacheEntry = this._cache.get(queryKey);
      if (cacheEntry && cacheEntry.observerCount > 0) {
        cacheEntry.observerCount--;
      }
    };
  }

  /**
   * Invalidate queries matching a key prefix.
   *
   * Marks matching entries as invalidated. Observers are notified.
   * Propagates through dependency graph per RFC-000.
   *
   * @param queryKey - The query key prefix to invalidate
   */
  async invalidateQueries(queryKey: QueryKey): Promise<void> {
    this.assertNotDestroyed();

    const targetHash = hashQueryKey(queryKey);

    for (const entry of this._cache.entries()) {
      const entryHash = entry.keyHash;

      // Match exact or prefix
      if (entryHash === targetHash || entryHash.startsWith(targetHash.slice(0, -1))) {
        this._cache.invalidate(entry.queryKey);

        const sm = this._stateMachines.get(entryHash);
        if (sm && sm.canTransition('invalidated')) {
          sm.transition('invalidated');
        }

        this._eventBus.emit({
          type: 'query.invalidated',
          source: 'internal',
          payload: { queryId: entryHash, queryKey: entry.queryKey },
        });
      }
    }
  }

  /**
   * Remove a query from the cache entirely.
   *
   * Destroys the state machine and all observers for the query.
   *
   * @param queryKey - The query key to remove
   */
  removeQuery(queryKey: QueryKey): void {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);

    // Destroy all observers for this query
    const observerSet = this._observers.get(keyHash);
    if (observerSet) {
      for (const observer of observerSet) {
        observer.destroy();
      }
      this._observers.delete(keyHash);
    }

    // Destroy state machine
    const sm = this._stateMachines.get(keyHash);
    if (sm) {
      sm.destroy();
      this._stateMachines.delete(keyHash);
    }

    // Remove from cache
    this._cache.delete(queryKey);

    this._eventBus.emit({
      type: 'query.removed',
      source: 'internal',
      payload: { queryId: keyHash, queryKey },
    });
  }

  /**
   * Clear the entire cache.
   *
   * Destroys all state machines and observers.
   */
  clear(): void {
    this.assertNotDestroyed();

    // Flush pending scheduler tasks first
    this._scheduler.flush();

    // Destroy all observers
    for (const observerSet of this._observers.values()) {
      for (const observer of observerSet) {
        observer.destroy();
      }
    }
    this._observers.clear();

    // Destroy all state machines
    for (const sm of this._stateMachines.values()) {
      sm.destroy();
    }
    this._stateMachines.clear();

    // Clear pending fetches
    this._pendingFetches.clear();

    // Clear snapshot cache
    this._snapshotCache.clear();

    // Clear cache
    this._cache.clear();

    // Clear mutation cache
    this._mutationCache.clear();

    this._eventBus.emit({
      type: 'cache.removed',
      source: 'internal',
      payload: { queryId: '*', queryKey: [] },
    });
  }

  /**
   * Release all runtime resources.
   *
   * After destruction, all operations throw.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Destroy scheduler first (cancels pending tasks)
    this._scheduler.destroy();

    // Destroy all observers
    for (const observerSet of this._observers.values()) {
      for (const observer of observerSet) {
        observer.destroy();
      }
    }
    this._observers.clear();

    // Destroy all state machines
    for (const sm of this._stateMachines.values()) {
      sm.destroy();
    }
    this._stateMachines.clear();

    // Clear pending fetches
    this._pendingFetches.clear();

    // Clear snapshot cache
    this._snapshotCache.clear();

    // Clear cache and event bus
    this._cache.clear();
    this._mutationCache.destroy();
    this._eventBus.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new RuntimeError({
        code: ErrorCode.ALREADY_DESTROYED,
        message: 'QueryClient has been destroyed',
      });
    }
  }

  private _ensureStateMachine(keyHash: string, queryKey: QueryKey): string {
    let sm = this._stateMachines.get(keyHash);
    if (!sm) {
      sm = new QueryStateMachine(keyHash, 'idle');
      this._stateMachines.set(keyHash, sm);

      this._eventBus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: keyHash, queryKey },
      });
    }
    return sm.queryId;
  }

  private async _executeFetch<T>(
    queryKey: QueryKey,
    queryFn: () => Promise<T>,
  ): Promise<T> {
    const keyHash = hashQueryKey(queryKey);

    // Ensure state machine exists
    this._ensureStateMachine(keyHash, queryKey);

    const sm = this._stateMachines.get(keyHash);
    if (!sm) {
      throw new RuntimeError({
        code: ErrorCode.INTERNAL_ERROR,
        message: `Failed to create state machine for query "${keyHash}"`,
      });
    }

    // Transition: idle/stale/error -> pending -> fetching
    if (sm.canTransition('pending')) {
      sm.transition('pending');
    }
    if (sm.canTransition('fetching')) {
      sm.transition('fetching');
    }

    this._eventBus.emit({
      type: 'fetch.started',
      source: 'fetch-engine',
      payload: { queryId: keyHash, queryKey },
    });

    // Update cache entry to fetching state
    const entry = this._cache.get(queryKey);
    if (entry) {
      entry.fetchStatus = 'fetching';
    }

    // Notify observers of loading state
    this._notifyObservers(keyHash, (observer) => {
      (observer as QueryObserver<T>).setFetchStatus('fetching');
    });

    try {
      const data = await queryFn();

      // Store in cache
      this._cache.set({
        queryKey,
        data,
        state: 'success',
        status: 'fresh',
      });

      // Transition: fetching -> success
      if (sm.canTransition('success')) {
        sm.transition('success');
      }

      this._eventBus.emit({
        type: 'fetch.completed',
        source: 'fetch-engine',
        payload: { queryId: keyHash, queryKey },
      });

      this._eventBus.emit({
        type: 'query.success',
        source: 'query-runtime',
        payload: { queryId: keyHash, queryKey },
      });

      // Notify observers with data
      this._notifyObservers(keyHash, (observer) => {
        (observer as QueryObserver<T>).setData(data);
      });

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      // Store error in cache
      this._cache.set({
        queryKey,
        error: err,
        state: 'error',
        status: 'stale',
      });

      // Transition: fetching -> error
      if (sm.canTransition('error')) {
        sm.transition('error');
      }

      this._eventBus.emit({
        type: 'fetch.failed',
        source: 'fetch-engine',
        payload: { queryId: keyHash, queryKey },
      });

      this._eventBus.emit({
        type: 'query.error',
        source: 'query-runtime',
        payload: { queryId: keyHash, queryKey },
      });

      // Notify observers of error
      this._notifyObservers(keyHash, (observer) => {
        (observer as QueryObserver<T>).setError(err);
      });

      throw err;
    }
  }

  private _notifyObservers(
    keyHash: string,
    updater: (observer: QueryObserver<unknown>) => void,
  ): void {
    const observerSet = this._observers.get(keyHash);
    if (!observerSet) return;

    for (const observer of observerSet) {
      try {
        updater(observer);
      } catch (_error) {
        // Observer update errors must not crash the runtime.
      }
    }
  }
}
