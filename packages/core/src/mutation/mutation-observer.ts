import type { MutationStatus } from '../types/query.types';
import type { MutationEntry } from './mutation-entry';
import { generateId } from '../utils/query.utils';

/**
 * Mutation Observer Options
 */
export interface MutationObserverOptions<TData = unknown> {
  /** Mutation identifier */
  readonly mutationId: string;

  /** Initial state */
  readonly initialState?: MutationStatus;

  /** Initial data */
  readonly initialData?: TData;

  /** Initial error */
  readonly initialError?: Error | null;
}

/**
 * Mutation Observer Snapshot
 */
export interface MutationSnapshot<TData = unknown, TVariables = unknown> {
  /** Mutation identifier */
  readonly mutationId: string;

  /** Current status */
  readonly status: MutationStatus;

  /** Mutation data */
  readonly data: TData | undefined;

  /** Mutation error */
  readonly error: Error | null;

  /** Current variables */
  readonly variables: TVariables | undefined;

  /** Whether mutation is pending */
  readonly isPending: boolean;

  /** Whether mutation succeeded */
  readonly isSuccess: boolean;

  /** Whether mutation failed */
  readonly isError: boolean;
}

/**
 * Mutation Observer
 *
 * Subscribes to mutation state changes with typed callbacks.
 * Framework-independent, memory-safe subscription model.
 *
 * Prevents duplicate notifications when state hasn't changed.
 *
 * @example
 * ```ts
 * const observer = new MutationObserver({
 *   mutationId: 'mut-1',
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
export class MutationObserver<TData = unknown, TVariables = unknown> {
  private readonly _id: string;
  private readonly _mutationId: string;
  private readonly _callbacks: Set<(snapshot: MutationSnapshot<TData, TVariables>) => void>;
  private _snapshot: MutationSnapshot<TData, TVariables>;
  private _destroyed: boolean;
  private _mutation: MutationEntry<TData, TVariables> | null;
  private _unsubMutation: (() => void) | null;

  constructor(options: MutationObserverOptions<TData>) {
    this._id = generateId();
    this._mutationId = options.mutationId;
    this._callbacks = new Set();
    this._destroyed = false;
    this._mutation = null;
    this._unsubMutation = null;
    this._snapshot = {
      mutationId: options.mutationId,
      status: options.initialState ?? 'idle',
      data: options.initialData,
      error: options.initialError ?? null,
      variables: undefined,
      isPending: false,
      isSuccess: false,
      isError: false,
    };
  }

  /**
   * Unique observer identifier.
   */
  get id(): string {
    return this._id;
  }

  /**
   * The mutation identifier this observer watches.
   */
  get mutationId(): string {
    return this._mutationId;
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
   * Bind to a mutation entry.
   * Subscribes to the mutation's state changes and forwards them to observers.
   *
   * @param mutation - The mutation entry to observe
   */
  bind(mutation: MutationEntry<TData, TVariables>): void {
    this.assertNotDestroyed();

    // Unbind from previous mutation
    this.unbind();

    this._mutation = mutation;

    // Subscribe to mutation changes
    this._unsubMutation = mutation.subscribe(() => {
      this.syncFromMutation();
    });

    // Sync initial state
    this.syncFromMutation();
  }

  /**
   * Unbind from the current mutation.
   */
  unbind(): void {
    this._unsubMutation?.();
    this._unsubMutation = null;
    this._mutation = null;
  }

  /**
   * Subscribe to state changes.
   *
   * The callback is invoked only when the snapshot has actually changed.
   *
   * @param callback - Function called with each new snapshot
   * @returns Unsubscribe function
   */
  subscribe(callback: (snapshot: MutationSnapshot<TData, TVariables>) => void): () => void {
    if (this._destroyed) {
      return () => {};
    }

    this._callbacks.add(callback);

    // Deliver current snapshot immediately
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
  getSnapshot(): MutationSnapshot<TData, TVariables> {
    return { ...this._snapshot };
  }

  /**
   * Update the observer's snapshot.
   * Notifies subscribers only if the snapshot has changed.
   *
   * @param update - Partial snapshot update
   */
  update(update: Partial<Omit<MutationSnapshot<TData, TVariables>, 'mutationId'>>): void {
    if (this._destroyed) return;

    const prev = this._snapshot;
    const next: MutationSnapshot<TData, TVariables> = {
      ...prev,
      ...update,
      mutationId: this._mutationId,
      isPending: (update.status ?? prev.status) === 'pending',
      isSuccess: (update.status ?? prev.status) === 'success',
      isError: (update.status ?? prev.status) === 'error',
    };

    // Prevent duplicate notifications
    if (this.snapshotsEqual(prev, next)) return;

    this._snapshot = next;
    this.notifyCallbacks(next);
  }

  /**
   * Destroy the observer.
   * Clears all callbacks, unbinds from mutation, and marks as destroyed.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    this.unbind();
    this._callbacks.clear();
  }

  private syncFromMutation(): void {
    if (!this._mutation) return;

    const snapshot = this._mutation.getSnapshot();
    this.update({
      status: snapshot.status,
      data: snapshot.data,
      error: snapshot.error,
      variables: snapshot.variables,
    });
  }

  private notifyCallbacks(snapshot: MutationSnapshot<TData, TVariables>): void {
    for (const callback of this._callbacks) {
      try {
        callback(snapshot);
      } catch (_error) {
        // Callback errors must not crash the runtime.
      }
    }
  }

  private snapshotsEqual(
    a: MutationSnapshot<TData, TVariables>,
    b: MutationSnapshot<TData, TVariables>,
  ): boolean {
    if (a.status !== b.status) return false;
    if (a.data !== b.data) return false;
    if (a.error !== b.error) return false;
    if (a.variables !== b.variables) return false;
    return true;
  }

  private assertNotDestroyed(): void {
    if (this._destroyed) {
      throw new Error('MutationObserver has been destroyed');
    }
  }
}
