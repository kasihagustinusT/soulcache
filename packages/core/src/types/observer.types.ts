import type { QueryStatus, FetchStatus } from './query.types';

/**
 * Query Snapshot
 *
 * Immutable representation of runtime state used by observers.
 * @readonly
 */
export interface QuerySnapshot<T> {
  /** Unique query identifier */
  readonly queryId: string;

  /** Current query status */
  readonly status: QueryStatus;

  /** Current fetch status */
  readonly fetchStatus: FetchStatus;

  /** The query data */
  readonly data: T | undefined;

  /** The error if query failed */
  readonly error: Error | null;

  /** Last update timestamp */
  readonly updatedAt: number;
}

/**
 * Observer
 *
 * A subscription to query state changes.
 */
export interface Observer<T> {
  /** Subscribe to state changes */
  subscribe(callback: (snapshot: QuerySnapshot<T>) => void): () => void;

  /** Get current snapshot */
  getSnapshot(): QuerySnapshot<T>;

  /** Destroy the observer */
  destroy(): void;
}
