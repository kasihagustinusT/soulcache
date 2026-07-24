import type { QueryStatus, FetchStatus } from '../types/query.types';

/**
 * Query Snapshot
 *
 * An immutable snapshot of query state. Each snapshot is frozen
 * and never mutated after creation.
 */
export interface QuerySnapshotState<T = unknown> {
  /** The query identifier */
  readonly queryId: string;

  /** The query key */
  readonly queryKey: readonly unknown[];

  /** Current status */
  readonly status: QueryStatus;

  /** Current fetch status */
  readonly fetchStatus: FetchStatus;

  /** Query data */
  readonly data: T | undefined;

  /** Query error */
  readonly error: Error | null;

  /** When this snapshot was created */
  readonly updatedAt: number;

  /** Snapshot version number */
  readonly version: number;
}

/**
 * Structural sharing result
 */
export interface StructuralShareResult<T> {
  /** The new snapshot */
  readonly snapshot: QuerySnapshotState<T>;

  /** Whether any fields actually changed */
  readonly changed: boolean;
}

/**
 * Query Snapshot Manager
 *
 * Manages immutable query snapshots with structural sharing and version tracking.
 * Ensures that unchanged snapshots reuse the same object reference, enabling
 * efficient equality checks in frameworks like React.
 *
 * @example
 * ```ts
 * const manager = new QuerySnapshotManager<User>();
 *
 * // Create initial snapshot
 * const snap1 = manager.create({
 *   queryId: 'q-1',
 *   queryKey: ['user', 1],
 *   status: 'idle',
 *   fetchStatus: 'idle',
 *   data: undefined,
 *   error: null,
 * });
 *
 * // Update with structural sharing - reuses unchanged fields
 * const snap2 = manager.update(snap1, {
 *   status: 'success',
 *   data: { name: 'Alice' },
 * });
 *
 * // snap1 and snap2 share references for queryId, queryKey, error, etc.
 * // Only status, data, updatedAt, version are new
 * ```
 */
export class QuerySnapshotManager<T = unknown> {
  private _versionCounter: number;

  constructor() {
    this._versionCounter = 0;
  }

  /**
   * Current global version counter.
   */
  get version(): number {
    return this._versionCounter;
  }

  /**
   * Create a new immutable snapshot.
   *
   * @param state - Initial snapshot state
   * @returns A frozen snapshot
   */
  create(state: {
    readonly queryId: string;
    readonly queryKey: readonly unknown[];
    readonly status: QueryStatus;
    readonly fetchStatus: FetchStatus;
    readonly data?: T;
    readonly error?: Error | null;
  }): QuerySnapshotState<T> {
    this._versionCounter++;

    const snapshot: QuerySnapshotState<T> = {
      queryId: state.queryId,
      queryKey: state.queryKey,
      status: state.status,
      fetchStatus: state.fetchStatus,
      data: state.data,
      error: state.error ?? null,
      updatedAt: Date.now(),
      version: this._versionCounter,
    };

    return Object.freeze(snapshot);
  }

  /**
   * Update a snapshot with structural sharing.
   *
   * Only creates a new object if the data has actually changed.
   * Unchanged fields are reused by reference.
   *
   * @param previous - The previous snapshot
   * @param updates - Partial updates to apply
   * @returns Structural sharing result with new snapshot and change indicator
   */
  update<U extends T>(
    previous: QuerySnapshotState<T>,
    updates: {
      readonly status?: QueryStatus;
      readonly fetchStatus?: FetchStatus;
      readonly data?: U;
      readonly error?: Error | null;
    },
  ): StructuralShareResult<T> {
    const status = updates.status ?? previous.status;
    const fetchStatus = updates.fetchStatus ?? previous.fetchStatus;
    const data = ('data' in updates ? updates.data : previous.data) as T;
    const error = 'error' in updates ? (updates.error ?? null) : previous.error;

    // Check if anything actually changed
    const changed =
      status !== previous.status ||
      fetchStatus !== previous.fetchStatus ||
      data !== previous.data ||
      error !== previous.error;

    if (!changed) {
      return { snapshot: previous, changed: false };
    }

    this._versionCounter++;

    const snapshot: QuerySnapshotState<T> = {
      queryId: previous.queryId,
      queryKey: previous.queryKey,
      status,
      fetchStatus,
      data,
      error,
      updatedAt: Date.now(),
      version: this._versionCounter,
    };

    return { snapshot: Object.freeze(snapshot), changed: true };
  }

  /**
   * Compare two snapshots for equality.
   *
   * Compares all fields by value. Uses reference equality for objects.
   *
   * @param a - First snapshot
   * @param b - Second snapshot
   * @returns true if snapshots are equal
   */
  equals(a: QuerySnapshotState<T>, b: QuerySnapshotState<T>): boolean {
    return (
      a.queryId === b.queryId &&
      a.status === b.status &&
      a.fetchStatus === b.fetchStatus &&
      a.data === b.data &&
      a.error === b.error &&
      a.version === b.version
    );
  }

  /**
   * Check if two snapshots have the same data.
   *
   * Only compares the data field, ignoring metadata.
   *
   * @param a - First snapshot
   * @param b - Second snapshot
   * @returns true if data is identical
   */
  dataEquals(a: QuerySnapshotState<T>, b: QuerySnapshotState<T>): boolean {
    return a.data === b.data;
  }

  /**
   * Get the difference between two snapshots.
   *
   * Returns an object describing which fields changed.
   *
   * @param previous - The old snapshot
   * @param current - The new snapshot
   * @returns Object describing changed fields
   */
  diff(
    previous: QuerySnapshotState<T>,
    current: QuerySnapshotState<T>,
  ): {
    readonly status: boolean;
    readonly fetchStatus: boolean;
    readonly data: boolean;
    readonly error: boolean;
    readonly version: boolean;
  } {
    return {
      status: previous.status !== current.status,
      fetchStatus: previous.fetchStatus !== current.fetchStatus,
      data: previous.data !== current.data,
      error: previous.error !== current.error,
      version: previous.version !== current.version,
    };
  }
}
