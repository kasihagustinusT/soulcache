import type { QueryKey, Updater } from '../types/query.types';
import type { QueryClientConfig } from '../types/client.types';
import type { QuerySnapshot } from '../types/observer.types';
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
import { hashQueryKey, generateId, isKeyPrefixOf, mapStateToStatus } from '../utils/query.utils';

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
  private readonly _pendingFetches: Map<
    string,
    {
      fetchPromise: Promise<unknown>;
      abortPromise: Promise<unknown>;
      abortReject: (error: Error) => void;
    }
  > = new Map();
  private static readonly _SNAPSHOT_CACHE_MAX = 10000;
  private readonly _snapshotCache: Map<string, QuerySnapshot<unknown>> = new Map();
  private readonly _snapshotCacheOrder: string[] = [];
  private _destroyed: boolean;

  constructor(config?: QueryClientConfig) {
    this._config = config ?? {};
    const cacheOptions: { staleTime?: number; gcTime?: number; gcInterval?: number } = {};
    if (this._config.defaultOptions?.staleTime !== undefined) {
      cacheOptions.staleTime = this._config.defaultOptions.staleTime;
    }
    if (this._config.defaultOptions?.gcTime !== undefined) {
      cacheOptions.gcTime = this._config.defaultOptions.gcTime;
    }
    if (this._config.defaultOptions?.gcInterval !== undefined) {
      cacheOptions.gcInterval = this._config.defaultOptions.gcInterval;
    }
    this._cache = new CacheEngine({
      ...cacheOptions,
      onEvict: (keyHash: string) => {
        const sm = this._stateMachines.get(keyHash);
        if (sm) {
          sm.destroy();
          this._stateMachines.delete(keyHash);
        }
        this._snapshotCache.delete(keyHash);
        const observerSet = this._observers.get(keyHash);
        if (observerSet) {
          for (const observer of observerSet) {
            try {
              observer.destroy();
            } catch {
              /* isolate */
            }
          }
          this._observers.delete(keyHash);
        }
        this._rejectPendingFetchForKey(keyHash);
      },
    });
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
    readonly onSettled?: (
      data: TData | undefined,
      error: Error | null,
      variables: TVariables,
    ) => void;
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

    // Prefer state machine state (unless 'idle') to prevent status divergence
    // between subscribeToQuery and subscribe. After invalidateQueries, the
    // entry.state may still be 'stale' while the SM is 'invalidated', which
    // would otherwise return status 'fetching' vs 'loading'.
    // When the SM is 'idle' but the entry has meaningful state (e.g.
    // setQueryData pre-populated the cache without a fetch lifecycle), prefer
    // entry state so getQuerySnapshot doesn't report 'idle' for existing data.
    const effectiveState = sm && sm.state !== 'idle' ? sm.state : (entry?.state ?? 'idle');
    const status: QueryStatus = mapStateToStatus(effectiveState);
    const fetchStatus: FetchStatus = entry?.fetchStatus ?? 'idle';
    const data = entry?.data;
    const error = entry?.error ?? null;
    // Convert ISO-8601 string to number for public API
    const updatedAt = entry?.updatedAt ? new Date(entry.updatedAt).getTime() : Date.now();

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
    this._snapshotCacheOrder.push(keyHash);
    if (this._snapshotCache.size > QueryClient._SNAPSHOT_CACHE_MAX) {
      const oldest = this._snapshotCacheOrder.shift();
      if (oldest !== undefined) {
        this._snapshotCache.delete(oldest);
      }
    }

    // Compaction: if stale entries accumulate from individual deletions
    // (onEvict, removeQuery, getQuerySnapshot miss), drain them in bulk.
    if (this._snapshotCacheOrder.length > QueryClient._SNAPSHOT_CACHE_MAX * 2) {
      const valid = this._snapshotCacheOrder.filter((h) => this._snapshotCache.has(h));
      this._snapshotCacheOrder.splice(0, this._snapshotCacheOrder.length, ...valid);
    }
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
  subscribeToQuery(queryKey: QueryKey, listener: () => void): () => void {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);
    this._ensureStateMachine(keyHash, queryKey);

    // Increment observerCount so LRU eviction and GC protect actively-used
    // entries from React useQuery subscriptions. Without this,
    // subscribeToQuery never incremented observerCount, so evict() saw
    // observerCount=0 for mounted queries.
    const entry = this._cache.get(queryKey);
    if (entry) {
      entry.observerCount++;
    }

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

      // Decrement observer count on the ORIGINAL cache entry captured at
      // subscribe time. A fresh lookup could return a different entry if
      // the original was destroyed and re-created (removeQuery + fetchQuery),
      // which would corrupt the new entry's observerCount.
      if (entry && entry.observerCount > 0) {
        entry.observerCount--;
      }

      // If no cache entry exists for this key, the state machine was created
      // solely for this subscription's transition listening. Clean it up to
      // prevent orphaned state machine accumulation.
      if (!this._cache.has(queryKey)) {
        const orphanSm = this._stateMachines.get(keyHash);
        if (orphanSm) {
          orphanSm.destroy();
          this._stateMachines.delete(keyHash);
        }
      }
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
  async fetchQuery<T>(options: { queryKey: QueryKey; queryFn: () => Promise<T> }): Promise<T> {
    this.assertNotDestroyed();

    const { queryKey, queryFn } = options;

    if (!queryFn) {
      throw new SoulCacheError({
        code: ErrorCode.INVALID_CONFIGURATION,
        message: 'queryFn is required for fetchQuery',
      });
    }

    const keyHash = hashQueryKey(queryKey);

    // Deduplicate in-flight requests — race against shared abort signal
    const pending = this._pendingFetches.get(keyHash);
    if (pending) {
      return Promise.race([pending.fetchPromise, pending.abortPromise]) as Promise<T>;
    }

    // Create abort signal that can be rejected externally by clear/destroy
    let abortReject!: (error: Error) => void;
    const abortPromise = new Promise<unknown>((_resolve, reject) => {
      abortReject = reject;
    });

    const fetchPromise = this._executeFetch<T>(queryKey, queryFn);
    const entry = { fetchPromise, abortPromise, abortReject };
    this._pendingFetches.set(keyHash, entry);

    try {
      // Race the internal fetch against the abort signal
      return (await Promise.race([fetchPromise, abortPromise])) as T;
    } finally {
      if (this._pendingFetches.get(keyHash) === entry) {
        this._pendingFetches.delete(keyHash);
      }
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
      typeof updater === 'function' ? (updater as (prev: T | undefined) => T)(prevData) : updater;

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
  subscribe<T>(queryKey: QueryKey, callback: (snapshot: QuerySnapshot<T>) => void): () => void {
    this.assertNotDestroyed();

    const keyHash = hashQueryKey(queryKey);
    const queryId = this._ensureStateMachine(keyHash, queryKey);

    // Get existing data for initial snapshot.
    // Capture entry reference for the unsubscribe callback — a fresh lookup
    // at unsubscribe time would return a DIFFERENT entry if the original was
    // destroyed and re-created (via removeQuery + fetchQuery), corrupting
    // the new entry's observerCount.
    const entry = this._cache.get<T>(queryKey);

    const observerOptions: {
      queryId: string;
      queryKey: readonly unknown[];
      initialState?:
        | 'idle'
        | 'pending'
        | 'success'
        | 'error'
        | 'fetching'
        | 'stale'
        | 'invalidated'
        | 'destroyed';
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
        fetchStatus?: 'idle';
      } = {};
      // Re-fetch entry from cache — the original may have been deleted and re-created
      const currentEntry = this._cache.get<T>(queryKey);
      if (currentEntry?.data !== undefined) {
        updateOptions.data = currentEntry.data;
      }
      if (currentEntry?.error !== undefined && currentEntry.error !== null) {
        updateOptions.error = currentEntry.error;
      }
      if (to === 'success' || to === 'error') {
        updateOptions.fetchStatus = 'idle';
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

      // Decrement observer count on the ORIGINAL cache entry captured at
      // subscribe time. A fresh lookup could return a different entry if
      // the original was destroyed and re-created (removeQuery + fetchQuery),
      // which would corrupt the new entry's observerCount.
      if (entry && entry.observerCount > 0) {
        entry.observerCount--;
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

    for (const entry of this._cache.entries()) {
      // Match exact key or structural query-key prefix
      if (isKeyPrefixOf(queryKey, entry.queryKey)) {
        this._cache.invalidate(entry.queryKey);

        const sm = this._stateMachines.get(entry.keyHash);
        if (sm && sm.canTransition('invalidated')) {
          sm.transition('invalidated');
        }

        this._eventBus.emit({
          type: 'query.invalidated',
          source: 'internal',
          payload: { queryId: entry.keyHash, queryKey: entry.queryKey },
        });
      }
    }
  }

  /**
   * Remove a query from the cache entirely.
   *
   * Destroys the state machine and all observers for the query.
   * Also rejects any pending fetch for the removed key.
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
        try {
          observer.destroy();
        } catch {
          /* isolate */
        }
      }
      this._observers.delete(keyHash);
    }

    // Destroy state machine
    const sm = this._stateMachines.get(keyHash);
    if (sm) {
      try {
        sm.destroy();
      } catch {
        /* isolate */
      }
      this._stateMachines.delete(keyHash);
    }

    // Reject pending fetches for this key to prevent ghost entries
    this._rejectPendingFetchForKey(keyHash);

    // Remove snapshot cache entry to prevent memory leak
    this._snapshotCache.delete(keyHash);

    // Notify external cleanup hooks (e.g. QueryEngine) so refetch timers,
    // abort controllers, and refetch functions are cleaned up.
    this._config.onRemoveQuery?.(keyHash, queryKey);

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
        try {
          observer.destroy();
        } catch {
          /* isolate */
        }
      }
    }
    this._observers.clear();

    // Destroy all state machines
    for (const sm of this._stateMachines.values()) {
      try {
        sm.destroy();
      } catch {
        /* isolate */
      }
    }
    this._stateMachines.clear();

    // Reject all pending fetches before clearing
    this._rejectPendingFetches(
      new RuntimeError({
        code: ErrorCode.CANCELLED,
        message: 'Fetch was cancelled by client clear()',
      }),
    );

    // Clear snapshot cache
    this._snapshotCache.clear();
    this._snapshotCacheOrder.length = 0;

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
        try {
          observer.destroy();
        } catch {
          /* isolate */
        }
      }
    }
    this._observers.clear();

    // Destroy all state machines
    for (const sm of this._stateMachines.values()) {
      try {
        sm.destroy();
      } catch {
        /* isolate */
      }
    }
    this._stateMachines.clear();

    // Reject all pending fetches before clearing
    this._rejectPendingFetches(
      new RuntimeError({
        code: ErrorCode.CANCELLED,
        message: 'Fetch was cancelled by client destroy()',
      }),
    );

    // Clear snapshot cache
    this._snapshotCache.clear();
    this._snapshotCacheOrder.length = 0;

    // Destroy cache (clears entries AND stops GC timer) and mutation cache
    this._cache.destroy();
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

  /**
   * Reject all pending fetch operations with the given error.
   * Must be called before clearing the pending fetches map.
   */
  private _rejectPendingFetches(error: Error): void {
    for (const [, entry] of this._pendingFetches) {
      try {
        entry.abortReject(error);
      } catch (_error) {
        // Reject handlers must not crash the runtime
      }
    }
    this._pendingFetches.clear();
  }

  /**
   * Reject pending fetch for a specific key.
   */
  private _rejectPendingFetchForKey(keyHash: string): void {
    const pending = this._pendingFetches.get(keyHash);
    if (pending) {
      try {
        pending.abortReject(
          new RuntimeError({
            code: ErrorCode.CANCELLED,
            message: 'Fetch was cancelled by removeQuery()',
          }),
        );
      } catch (_error) {
        // Reject handlers must not crash the runtime
      }
      this._pendingFetches.delete(keyHash);
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

  private async _executeFetch<T>(queryKey: QueryKey, queryFn: () => Promise<T>): Promise<T> {
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

    // Create the cache entry before SM transitions so getQuerySnapshot() can
    // read fetchStatus 'fetching' when SM transition listeners call it.
    // Without this, brand-new queries return status 'idle' throughout the
    // entire fetch lifecycle.
    if (!this._cache.has(queryKey)) {
      this._cache.set({ queryKey, state: 'pending' });
    }
    const entry = this._cache.get(queryKey);
    const capturedVersion = entry?.version ?? -1;
    if (entry) {
      entry.fetchStatus = 'fetching';
    }

    // Capture SM reference before the async fetch. If the query is removed and
    // re-added during the fetch, a NEW state machine is created at the same hash.
    // Writing to the new SM would silently corrupt its initial state.
    const smRef = sm;

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

    // Notify observers of loading state
    this._notifyObservers(keyHash, (observer) => {
      (observer as QueryObserver<T>).setFetchStatus('fetching');
    });

    try {
      const data = await queryFn();

      // Guard: if the state machine was removed during the fetch (removeQuery),
      // or replaced by a new entry with the same key (remove + re-add),
      // do not write to the now-stale state machine.
      if (this._stateMachines.get(keyHash) !== smRef) {
        return data;
      }

      if (entry && entry.version !== capturedVersion) {
        return data;
      }

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

      // Guard: if the state machine was removed during the fetch (removeQuery),
      // or replaced by a new entry with the same key (remove + re-add),
      // do not write to the now-stale state machine.
      if (this._stateMachines.get(keyHash) !== smRef) {
        throw err;
      }

      if (entry && entry.version !== capturedVersion) {
        throw err;
      }

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
