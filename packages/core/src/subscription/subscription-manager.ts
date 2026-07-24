/**
 * Subscription Manager
 *
 * Framework-agnostic subscription system compatible with React's
 * useSyncExternalStore(subscribe, getSnapshot) API.
 *
 * Provides bare-notification subscriptions (no arguments) that frameworks
 * can bridge to their reactivity systems.
 *
 * @example
 * ```ts
 * const manager = new SubscriptionManager<{ count: number }>();
 *
 * // Get current snapshot (for useSyncExternalStore's getSnapshot)
 * const snapshot = manager.getSnapshot();
 *
 * // Subscribe to changes (for useSyncExternalStore's subscribe)
 * const unsubscribe = manager.subscribe(() => {
 *   const next = manager.getSnapshot();
 *   // React will compare snapshots and re-render if changed
 * });
 *
 * // Notify listeners when state changes (called by runtime)
 * manager.notify();
 *
 * // Cleanup
 * unsubscribe();
 * manager.destroy();
 * ```
 */
export class SubscriptionManager<T = void> {
  private _listeners: Set<() => void>;
  private _snapshot: T;
  private _version: number;
  private _destroyed: boolean;
  private _getSnapshotFn: (() => T) | null;
  private _equalityFn: ((prev: T, next: T) => boolean) | null;

  constructor(options?: {
    /** Initial snapshot value */
    readonly initialValue?: T;
    /** Custom snapshot getter. If not provided, returns the last notified value. */
    readonly getSnapshot?: () => T;
    /** Custom equality check. Defaults to Object.is. */
    readonly equalityFn?: (prev: T, next: T) => boolean;
  }) {
    this._listeners = new Set();
    this._snapshot = (options?.initialValue ?? undefined) as T;
    this._version = 0;
    this._destroyed = false;
    this._getSnapshotFn = options?.getSnapshot ?? null;
    this._equalityFn = options?.equalityFn ?? null;
  }

  /**
   * Current version number. Increments on each state change.
   * Useful for detecting stale snapshots.
   */
  get version(): number {
    return this._version;
  }

  /**
   * Number of active listeners.
   */
  get listenerCount(): number {
    return this._listeners.size;
  }

  /**
   * Whether the manager has been destroyed.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * Subscribe to state changes.
   *
   * The listener is called with no arguments (compatible with
   * useSyncExternalStore's subscribe parameter).
   *
   * @param listener - Function called on each state change
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    if (this._destroyed) {
      return () => {};
    }

    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Get the current snapshot.
   *
   * If a custom getSnapshot function was provided, it is called.
   * Otherwise, returns the last value set via setSnapshot() or update().
   *
   * Returns a new object reference if using default snapshot tracking.
   * Compatible with useSyncExternalStore's getSnapshot parameter.
   *
   * @returns The current snapshot
   */
  getSnapshot(): T {
    if (this._getSnapshotFn) {
      return this._getSnapshotFn();
    }
    return this._snapshot;
  }

  /**
   * Set the snapshot value directly.
   *
   * Does not notify listeners. Use notify() after setting if you want
   * listeners to be informed.
   *
   * @param value - The new snapshot value
   */
  setSnapshot(value: T): void {
    this._snapshot = value;
    this._version++;
  }

  /**
   * Update the snapshot using an updater function.
   *
   * Only updates if the new value differs from the old (using equality check).
   * Does not notify listeners. Use notify() after updating.
   *
   * @param updater - Function that receives current value and returns new value
   * @returns true if value changed, false if equal
   */
  update(updater: (current: T) => T): boolean {
    const prev = this._snapshot;
    const next = updater(prev);

    if (this._equalityFn) {
      if (this._equalityFn(prev, next)) return false;
    } else if (Object.is(prev, next)) {
      return false;
    }

    this._snapshot = next;
    this._version++;
    return true;
  }

  /**
   * Notify all listeners of a state change.
   *
   * Should be called after setSnapshot() or update() to inform subscribers.
   * Deduplicates concurrent notifications within the same microtask.
   *
   * @param getSnapshot - Optional function to get the new snapshot value.
   *   If provided, updates the internal snapshot before notifying.
   */
  notify(getSnapshot?: () => T): void {
    if (this._destroyed) return;

    if (getSnapshot) {
      const newSnapshot = getSnapshot();
      const changed = this.update(() => newSnapshot);
      if (!changed) return;
    }

    for (const listener of this._listeners) {
      try {
        listener();
      } catch (_error) {
        // Listener errors must not crash the runtime.
      }
    }
  }

  /**
   * Destroy the manager.
   * Clears all listeners and marks as destroyed.
   */
  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;
    this._listeners.clear();
    this._getSnapshotFn = null;
    this._equalityFn = null;
  }
}
