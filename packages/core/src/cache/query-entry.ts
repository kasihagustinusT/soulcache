import type {
  QueryRecord,
  QueryRecordState,
  QueryRecordFetchStatus,
  CacheStatus,
} from '../types/internal.types';
import type { QueryKey } from '../types/query.types';

/**
 * Query Entry
 *
 * Represents a single cached query record.
 * Aligns with RFC-000 CacheEntry interface.
 * Tracks access metadata for LRU eviction.
 */
export class QueryEntry<T = unknown> implements QueryRecord<T> {
  readonly queryId: string;
  readonly queryKey: QueryKey;
  readonly keyHash: string;
  state: QueryRecordState;
  status: CacheStatus;
  data: T;
  updatedAt: string;
  staleAt: string | null;
  expiresAt: string | null;
  version: number;
  dependencies: string[];
  meta: Record<string, unknown>;
  error: Error | null;
  readonly createdAt: number;
  lastFetchedAt: number | undefined;
  observerCount: number;
  retryCount: number;
  fetchStatus: QueryRecordFetchStatus;

  /** Internal metadata (not part of RFC-000) */
  gcEligible: boolean;
  readonly persistent: boolean;
  readonly prefetched: boolean;
  readonly manual: boolean;

  /** Last access timestamp for LRU */
  private _lastAccessedAt: number;

  /** Total access count */
  private _accessCount: number;

  constructor(options: {
    queryId: string;
    queryKey: QueryKey;
    keyHash: string;
    state?: QueryRecordState;
    status?: CacheStatus;
    data?: T;
    error?: Error | null;
    createdAt?: number;
    observerCount?: number;
    gcEligible?: boolean;
    persistent?: boolean;
    prefetched?: boolean;
    manual?: boolean;
    meta?: Record<string, unknown>;
    dependencies?: string[];
  }) {
    const now = Date.now();
    const nowISO = new Date(now).toISOString();

    this.queryId = options.queryId;
    this.queryKey = options.queryKey;
    this.keyHash = options.keyHash;
    this.state = options.state ?? 'idle';
    this.status = options.status ?? 'fresh';
    this.data = (options.data ?? undefined) as T;
    this.error = options.error ?? null;
    this.createdAt = options.createdAt ?? now;
    this.updatedAt = nowISO;
    this._lastAccessedAt = now;
    this._accessCount = 0;
    this.lastFetchedAt = undefined;
    this.staleAt = null;
    this.expiresAt = null;
    this.version = 0;
    this.dependencies = options.dependencies ?? [];
    this.meta = options.meta ?? {};
    this.observerCount = options.observerCount ?? 0;
    this.retryCount = 0;
    this.fetchStatus = 'idle';
    this.gcEligible = options.gcEligible ?? true;
    this.persistent = options.persistent ?? false;
    this.prefetched = options.prefetched ?? false;
    this.manual = options.manual ?? false;
  }

  /**
   * Last access timestamp for LRU tracking.
   */
  get lastAccessedAt(): number {
    return this._lastAccessedAt;
  }

  /**
   * Total access count for frequency tracking.
   */
  get accessCount(): number {
    return this._accessCount;
  }

  /**
   * Record an access event.
   * Updates lastAccessedAt and increments accessCount.
   */
  touch(): void {
    this._lastAccessedAt = Date.now();
    this._accessCount++;
  }

  /**
   * Update the query data and state.
   * Increments version for optimistic concurrency (RFC-000).
   */
  updateData(data: T, state: QueryRecordState = 'success', now?: number): void {
    this.data = data;
    this.state = state;
    this.status = 'fresh';
    this.updatedAt = new Date(now ?? Date.now()).toISOString();
    this.version++;
    this.touch();
  }

  /**
   * Update the query error and state.
   */
  updateError(error: Error, state: QueryRecordState = 'error'): void {
    this.error = error;
    this.state = state;
    this.updatedAt = new Date().toISOString();
    this.touch();
  }

  /**
   * Mark the entry as stale (RFC-000).
   */
  markStale(): void {
    this.state = 'stale';
    this.status = 'stale';
    this.staleAt = new Date().toISOString();
  }

  /**
   * Mark the entry as invalidated (RFC-000).
   */
  markInvalidated(): void {
    this.state = 'stale';
    this.status = 'invalidated';
    this.staleAt = new Date().toISOString();
  }

  /**
   * Check if entry is expired based on gcTime.
   */
  isExpired(gcTime: number): boolean {
    if (this.expiresAt !== null) {
      return Date.now() > new Date(this.expiresAt).getTime();
    }
    if (this._accessCount === 0 && this.observerCount === 0) {
      return Date.now() - this.createdAt > gcTime;
    }
    return false;
  }

  /**
   * Check if entry is stale based on staleTime.
   */
  isStale(staleTime: number): boolean {
    if (this.staleAt !== null) {
      return Date.now() > new Date(this.staleAt).getTime() + staleTime;
    }
    if (this.lastFetchedAt !== undefined) {
      return Date.now() - this.lastFetchedAt > staleTime;
    }
    return false;
  }

  /**
   * Check if a given keyHash is in this entry's dependency list.
   */
  hasDependency(keyHash: string): boolean {
    return this.dependencies.includes(keyHash);
  }

  /**
   * Add a dependency (another key hash that should invalidate this entry).
   */
  addDependency(keyHash: string): void {
    if (!this.dependencies.includes(keyHash)) {
      this.dependencies.push(keyHash);
    }
  }

  /**
   * Remove a dependency.
   */
  removeDependency(keyHash: string): void {
    const idx = this.dependencies.indexOf(keyHash);
    if (idx !== -1) {
      this.dependencies.splice(idx, 1);
    }
  }

  /**
   * Calculate LRU score for eviction.
   * Lower score = more eligible for eviction.
   */
  getLRUScore(): number {
    const recency = Date.now() - this._lastAccessedAt;
    const frequency = this._accessCount;
    const observerBonus = this.observerCount * 1000000;
    return recency - frequency * 1000 - observerBonus;
  }
}
