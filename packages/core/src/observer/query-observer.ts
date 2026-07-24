import type { QuerySnapshot, Observer } from '../types/observer.types';
import type { QueryRecordState } from '../types/internal.types';
import type { QueryStatus, FetchStatus } from '../types/query.types';
import type { EventBus } from '../events/event-bus';
import { RuntimeError } from '../errors/soulcache-error';
import { ErrorCode } from '../errors/error-codes';
import { generateId } from '../utils/query.utils';

/**
 * Map internal QueryRecordState to public QueryStatus.
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
 * Query Observer Options
 */
export interface QueryObserverOptions<T> {
  /** Query identifier */
  readonly queryId: string;

  /** Query key */
  readonly queryKey: readonly unknown[];

  /** Initial state */
  initialState?: QueryRecordState;

  /** Initial data */
  initialData?: T;

  /** Initial error */
  initialError?: Error | null;

  /** Event bus for lifecycle events */
  eventBus?: EventBus;
}

/**
 * Query Observer
 *
 * Subscribes to query state changes with typed callbacks.
 * Framework-independent, memory-safe subscription model.
 *
 * Prevents duplicate notifications when state hasn't changed.
 * Supports selective notification via comparator.
 *
 * @example
 * ```ts
 * const observer = new QueryObserver({
 *   queryId: 'q-1',
 *   queryKey: ['users', 1],
 * });
 *
 * const unsubscribe = observer.subscribe((snapshot) => {
 *   console.log(snapshot.status, snapshot.data);
 * });
 *
 * // Later
 * unsubscribe();
 * observer.destroy();
 * ```
 */
export class QueryObserver<T = unknown> implements Observer<T> {
  private readonly _id: string;
  private readonly _queryId: string;
  private readonly _queryKey: readonly unknown[];
  private readonly _callbacks: Set<(snapshot: QuerySnapshot<T>) => void>;
  private _snapshot: QuerySnapshot<T>;
  private _destroyed: boolean;

  constructor(options: QueryObserverOptions<T>) {
    this._id = generateId();
    this._queryId = options.queryId;
    this._queryKey = options.queryKey;
    this._callbacks = new Set();
    this._destroyed = false;
    this._snapshot = {
      queryId: options.queryId,
      status: mapStateToStatus(options.initialState ?? 'idle'),
      fetchStatus: 'idle',
      data: options.initialData,
      error: options.initialError ?? null,
      updatedAt: Date.now(),
    };
  }

  /**
   * Unique observer identifier.
   */
  get id(): string {
    return this._id;
  }

  /**
   * The query identifier this observer watches.
   */
  get queryId(): string {
    return this._queryId;
  }

  /**
   * The query key this observer watches.
   */
  get queryKey(): readonly unknown[] {
    return this._queryKey;
  }

  /**
   * Whether this observer has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Number of active subscriptions.
   */
  get listenerCount(): number {
    return this._callbacks.size;
  }

  /**
   * Subscribe to state changes.
   *
   * The callback is invoked only when the snapshot has actually changed.
   * Duplicate notifications are prevented via shallow comparison.
   *
   * @param callback - Function called with each new snapshot
   * @returns Unsubscribe function
   */
  subscribe(callback: (snapshot: QuerySnapshot<T>) => void): () => void {
    if (this._destroyed) {
      throw new RuntimeError({
        code: ErrorCode.QUERY_DESTROYED,
        message: `Cannot subscribe to destroyed observer for query "${this._queryId}"`,
        metadata: { queryId: this._queryId, observerId: this._id },
      });
    }

    this._callbacks.add(callback);

    // Deliver current snapshot immediately (swallow errors to match update behavior)
    try {
      callback(this._snapshot);
    } catch (_error) {
      // Initial callback errors must not crash the runtime.
    }

    return () => {
      this._callbacks.delete(callback);
    };
  }

  /**
   * Get current snapshot.
   * Returns a new object reference each call to ensure immutability.
   */
  getSnapshot(): QuerySnapshot<T> {
    return { ...this._snapshot };
  }

  /**
   * Update the observer's snapshot.
   * Notifies subscribers only if the snapshot has changed.
   *
   * @param update - Partial snapshot update
   */
  update(update: Partial<Omit<QuerySnapshot<T>, 'queryId'>>): void {
    if (this._destroyed) return;

    const prev = this._snapshot;
    const next: QuerySnapshot<T> = {
      ...prev,
      ...update,
      queryId: this._queryId,
      updatedAt: update.updatedAt ?? Date.now(),
    };

    // Prevent duplicate notifications
    if (this.snapshotsEqual(prev, next)) return;

    this._snapshot = next;
    this.notifyCallbacks(next);
  }

  /**
   * Update query state. Maps internal state to public status and updates.
   *
   * @param state - New internal state
   * @param additional - Additional partial snapshot fields
   */
  setState(
    state: QueryRecordState,
    additional?: Partial<Omit<QuerySnapshot<T>, 'queryId' | 'status'>>,
  ): void {
    this.update({
      status: mapStateToStatus(state),
      ...additional,
    });
  }

  /**
   * Set fetch status.
   *
   * @param fetchStatus - New fetch status
   */
  setFetchStatus(fetchStatus: FetchStatus): void {
    this.update({ fetchStatus });
  }

  /**
   * Set data and transition to success.
   *
   * @param data - New data
   */
  setData(data: T): void {
    this.update({
      data,
      status: 'success',
      error: null,
      fetchStatus: 'idle',
    });
  }

  /**
   * Set error and transition to error.
   *
   * @param error - New error
   */
  setError(error: Error): void {
    this.update({
      error,
      status: 'error',
      fetchStatus: 'idle',
    });
  }

  /**
   * Destroy the observer.
   * Clears all callbacks and marks as destroyed.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._callbacks.clear();
  }

  private notifyCallbacks(snapshot: QuerySnapshot<T>): void {
    for (const callback of this._callbacks) {
      try {
        callback(snapshot);
      } catch (_error) {
        // Callback errors must not crash the runtime.
      }
    }
  }

  private snapshotsEqual(a: QuerySnapshot<T>, b: QuerySnapshot<T>): boolean {
    if (a.status !== b.status) return false;
    if (a.fetchStatus !== b.fetchStatus) return false;
    if (a.data !== b.data) return false;
    if (a.error !== b.error) return false;
    return true;
  }
}
