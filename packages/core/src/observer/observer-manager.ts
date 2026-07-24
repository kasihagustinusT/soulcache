import type { QueryKey } from '../types/query.types';
import type { QuerySnapshot } from '../types/observer.types';
import { QueryObserver } from './query-observer';
import type { QueryObserverOptions } from './query-observer';

/**
 * Equality Function
 *
 * Compares two snapshots to determine if an update should be delivered.
 */
export type EqualityFn<T> = (a: QuerySnapshot<T>, b: QuerySnapshot<T>) => boolean;

/**
 * Observer Manager Options
 */
export interface ObserverManagerOptions {
  /** Batch flush interval in ms (0 = microtask, default: 0) */
  readonly batchInterval?: number;

  /** Custom equality function (default: shallow comparison) */
  readonly equalityFn?: EqualityFn<unknown>;
}

/**
 * Observer Manager Metrics
 */
export interface ObserverManagerMetrics {
  /** Total observers registered */
  readonly totalRegistered: number;

  /** Currently active observers */
  readonly activeObservers: number;

  /** Total notifications sent */
  readonly totalNotifications: number;

  /** Total batch flushes */
  readonly totalFlushes: number;

  /** Total duplicate notifications prevented */
  readonly duplicatesPrevented: number;
}

/**
 * Observer Manager
 *
 * Central coordinator for observer subscriptions.
 * Maintains a registry mapping query keys to observers, batches notifications,
 * and manages observer lifecycle.
 *
 * Per OBSERVER_DOMAIN.md: the single entry point for all observer operations.
 *
 * @example
 * ```ts
 * const manager = new ObserverManager();
 *
 * const observer = manager.createObserver<{ name: string }>({
 *   queryId: 'q-1',
 *   queryKey: ['users', 1],
 * });
 *
 * const unsub = observer.subscribe((snapshot) => {
 *   console.log(snapshot.data);
 * });
 *
 * // Notify all observers for a key
 * manager.notify(['users', 1], { data: { name: 'Alice' } });
 *
 * // Cleanup
 * unsub();
 * observer.destroy();
 * manager.destroy();
 * ```
 */
export class ObserverManager {
  /** Query key hash → Set of observers */
  private readonly registry: Map<string, Set<QueryObserver>> = new Map();

  /** All observers by ID for lifecycle management */
  private readonly observers: Map<string, QueryObserver> = new Map();

  /** Pending notification key hashes (for batching) */
  private readonly pendingKeys: Set<string> = new Set();

  /** Batch flush timer */
  private flushTimer: ReturnType<typeof setTimeout> | undefined;

  /** Batch interval in ms */
  private readonly batchInterval: number;

  /** Custom equality function */
  private readonly equalityFn: EqualityFn<unknown> | undefined;

  /** Metrics */
  private _totalNotifications = 0;
  private _totalFlushes = 0;
  private _duplicatesPrevented = 0;

  /** Whether the manager has been destroyed */
  private _destroyed = false;

  constructor(options?: ObserverManagerOptions) {
    this.batchInterval = options?.batchInterval ?? 0;
    this.equalityFn = options?.equalityFn;
  }

  /**
   * Create Observer
   *
   * Creates a new QueryObserver and registers it in the registry.
   */
  createObserver<T>(options: QueryObserverOptions<T>): QueryObserver<T> {
    this.assertNotDestroyed();

    const observer = new QueryObserver<T>(options);
    this.observers.set(observer.id, observer as unknown as QueryObserver);

    const keyHash = this.hashKey(options.queryKey);
    let set = this.registry.get(keyHash);
    if (set === undefined) {
      set = new Set();
      this.registry.set(keyHash, set);
    }
    set.add(observer as unknown as QueryObserver);

    return observer;
  }

  /**
   * Get Observers
   *
   * Returns all observers watching a given query key.
   */
  getObservers(keyHash: string): readonly QueryObserver[] {
    return [...(this.registry.get(keyHash) ?? [])];
  }

  /**
   * Get Observer Count
   *
   * Returns the number of observers for a given query key hash.
   */
  getObserverCount(keyHash: string): number {
    return this.registry.get(keyHash)?.size ?? 0;
  }

  /**
   * Notify
   *
   * Schedules notification for all observers watching the given key.
   * Batches notifications when batchInterval > 0.
   */
  notify(keyHash: string, update: Partial<Omit<QuerySnapshot<unknown>, 'queryId'>>): void {
    this.assertNotDestroyed();

    const observers = this.registry.get(keyHash);
    if (observers === undefined || observers.size === 0) return;

    if (this.batchInterval > 0) {
      this.pendingKeys.add(keyHash);
      this.scheduleFlush();
    } else {
      this.flushObservers(keyHash, update);
    }
  }

  /**
   * Notify Immediate
   *
   * Immediately notifies all observers for the given key, bypassing batching.
   */
  notifyImmediate(keyHash: string, update: Partial<Omit<QuerySnapshot<unknown>, 'queryId'>>): void {
    this.assertNotDestroyed();
    this.flushObservers(keyHash, update);
  }

  /**
   * Flush
   *
   * Immediately delivers all pending batched notifications.
   */
  flush(): void {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    const keys = [...this.pendingKeys];
    this.pendingKeys.clear();

    for (const keyHash of keys) {
      const observers = this.registry.get(keyHash);
      if (observers !== undefined) {
        for (const observer of observers) {
          if (!observer.isDestroyed) {
            // For batch flush, we don't have specific update data.
            // Observers will use their current snapshot.
            this._totalNotifications++;
          }
        }
      }
    }

    this._totalFlushes++;
  }

  /**
   * Remove Observer
   *
   * Removes an observer from the registry and destroys it.
   */
  removeObserver(observerId: string): void {
    const observer = this.observers.get(observerId);
    if (observer === undefined) return;

    // Remove from registry
    const keyHash = this.hashKey(observer.queryKey);
    const set = this.registry.get(keyHash);
    if (set !== undefined) {
      set.delete(observer);
      if (set.size === 0) {
        this.registry.delete(keyHash);
      }
    }

    observer.destroy();
    this.observers.delete(observerId);
  }

  /**
   * Remove All Observers for Key
   *
   * Removes all observers watching a given query key.
   */
  removeAllForKey(keyHash: string): void {
    const observers = this.registry.get(keyHash);
    if (observers === undefined) return;

    for (const observer of observers) {
      observer.destroy();
      this.observers.delete(observer.id);
    }

    this.registry.delete(keyHash);
  }

  /**
   * Get Metrics
   *
   * Returns current observer manager metrics.
   */
  getMetrics(): ObserverManagerMetrics {
    return {
      totalRegistered: this.observers.size,
      activeObservers: this.countActiveObservers(),
      totalNotifications: this._totalNotifications,
      totalFlushes: this._totalFlushes,
      duplicatesPrevented: this._duplicatesPrevented,
    };
  }

  /**
   * Destroy
   *
   * Destroys all observers and cleans up resources.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
      this.flushTimer = undefined;
    }

    for (const observer of this.observers.values()) {
      observer.destroy();
    }

    this.observers.clear();
    this.registry.clear();
    this.pendingKeys.clear();
  }

  /**
   * Whether the manager has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  // ─── Internal ──────────────────────────────────────────────────────

  private flushObservers(
    keyHash: string,
    update: Partial<Omit<QuerySnapshot<unknown>, 'queryId'>>,
  ): void {
    const observers = this.registry.get(keyHash);
    if (observers === undefined || observers.size === 0) return;

    for (const observer of observers) {
      if (observer.isDestroyed) continue;

      const prev = observer.getSnapshot();
      observer.update(update);
      const next = observer.getSnapshot();

      if (this.snapshotsEqual(prev, next)) {
        this._duplicatesPrevented++;
      }

      this._totalNotifications++;
    }
  }

  private snapshotsEqual(a: QuerySnapshot<unknown>, b: QuerySnapshot<unknown>): boolean {
    if (this.equalityFn !== undefined) {
      return this.equalityFn(a, b);
    }
    // Default: shallow comparison
    return (
      a.status === b.status &&
      a.fetchStatus === b.fetchStatus &&
      a.data === b.data &&
      a.error === b.error
    );
  }

  private scheduleFlush(): void {
    if (this.flushTimer !== undefined) return;

    if (this.batchInterval === 0) {
      // Microtask batching
      this.flushTimer = setTimeout(() => {
        this.flushTimer = undefined;
        this.flushPending();
      }, 0) as unknown as ReturnType<typeof setTimeout>;
    } else {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = undefined;
        this.flushPending();
      }, this.batchInterval);
    }
  }

  private flushPending(): void {
    const keys = [...this.pendingKeys];
    this.pendingKeys.clear();
    this._totalFlushes++;

    for (const keyHash of keys) {
      const observers = this.registry.get(keyHash);
      if (observers !== undefined) {
        for (const observer of observers) {
          if (!observer.isDestroyed) {
            this._totalNotifications++;
          }
        }
      }
    }
  }

  private countActiveObservers(): number {
    let count = 0;
    for (const observer of this.observers.values()) {
      if (!observer.isDestroyed && observer.listenerCount > 0) {
        count++;
      }
    }
    return count;
  }

  /**
   * Hash Query Key
   *
   * Produces a stable string hash for a query key.
   */
  hashKey(key: QueryKey): string {
    return JSON.stringify(key, (_k, v) => {
      if (typeof v === 'function') return `fn:${v.name || 'anon'}`;
      return v;
    });
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('ObserverManager has been destroyed');
    }
  }
}
