import type { QueryKey } from '../types/query.types';
import type { QueryRecordState, CacheStatus } from '../types/internal.types';
import { hashQueryKey } from '../utils/query.utils';
import { generateId } from '../utils/query.utils';
import { DEFAULT_STALE_TIME, DEFAULT_GC_TIME, MAX_CACHE_SIZE } from '../constants/defaults';
import { QueryEntry } from './query-entry';

/**
 * Cache Engine Options
 */
export interface CacheEngineOptions {
  /** Default stale time in milliseconds */
  staleTime?: number;
  /** Default garbage collection time in milliseconds */
  gcTime?: number;
  /** Maximum cache size */
  maxSize?: number;
  /** Auto-GC interval in ms (0 = disabled, default 0) */
  gcInterval?: number;
  /** Called when an entry is removed by GC or LRU eviction (not by explicit delete/clear/destroy) */
  onEvict?: (keyHash: string) => void;
}

/**
 * Cache Statistics
 */
export interface CacheStats {
  /** Total entries in cache */
  size: number;
  /** Entries with active observers */
  activeEntries: number;
  /** Entries eligible for GC */
  gcEligibleEntries: number;
  /** Total access count across all entries */
  totalAccesses: number;
}

/**
 * Cache Write Conflict
 *
 * Thrown when a write is rejected due to version mismatch (RFC-000).
 */
export class CacheWriteConflict extends Error {
  constructor(keyHash: string, incomingVersion: number, currentVersion: number) {
    super(
      `Cache write conflict for key "${keyHash}": ` +
        `incoming version ${incomingVersion} < current version ${currentVersion}`,
    );
    this.name = 'CacheWriteConflict';
  }
}

/**
 * Cache Engine
 *
 * Deterministic in-memory cache for query records.
 * Provides O(1) lookups by key hash.
 * Implements RFC-000 Cache Protocol.
 *
 * @example
 * ```ts
 * const cache = new CacheEngine({ staleTime: 60000 });
 *
 * // Store a query result
 * cache.set({
 *   queryKey: ['users', 123],
 *   data: { id: 123, name: 'Alice' },
 *   state: 'success',
 * });
 *
 * // Retrieve by key
 * const entry = cache.get(['users', 123]);
 * console.log(entry?.data); // { id: 123, name: 'Alice' }
 * ```
 */
export class CacheEngine {
  private readonly store: Map<string, QueryEntry> = new Map();
  private readonly _staleTime: number;
  private readonly gcTime: number;
  private readonly maxSize: number;
  private readonly _gcInterval: number;
  private readonly _onEvict: (keyHash: string) => void;
  private _gcTimer: ReturnType<typeof setInterval> | undefined;

  constructor(options?: CacheEngineOptions) {
    this._staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
    this.gcTime = options?.gcTime ?? DEFAULT_GC_TIME;
    this.maxSize = options?.maxSize ?? MAX_CACHE_SIZE;
    this._gcInterval = options?.gcInterval ?? 0;
    this._onEvict = options?.onEvict ?? (() => {});
    if (this._gcInterval > 0 && typeof setInterval !== 'undefined') {
      this._gcTimer = setInterval(() => {
        this.collectGarbage();
      }, this._gcInterval);
      if (typeof this._gcTimer === 'object' && 'unref' in this._gcTimer) {
        this._gcTimer.unref();
      }
    }
  }

  /**
   * Get an entry by query key.
   * Updates access metadata for LRU tracking.
   *
   * @param queryKey - The query key to look up
   * @returns The entry if found, undefined otherwise
   */
  get<T = unknown>(queryKey: QueryKey): QueryEntry<T> | undefined {
    const keyHash = hashQueryKey(queryKey);
    const entry = this.store.get(keyHash) as QueryEntry<T> | undefined;

    if (entry) {
      entry.touch();
    }

    return entry;
  }

  /**
   * Get an entry by key hash directly.
   *
   * @param keyHash - The key hash to look up
   * @returns The entry if found, undefined otherwise
   */
  getByHash<T = unknown>(keyHash: string): QueryEntry<T> | undefined {
    const entry = this.store.get(keyHash) as QueryEntry<T> | undefined;

    if (entry) {
      entry.touch();
    }

    return entry;
  }

  /**
   * Store or update a query entry.
   *
   * @param options - Entry data
   * @returns The stored entry
   */
  set<T = unknown>(options: {
    queryKey: QueryKey;
    data?: T;
    state?: QueryRecordState;
    status?: CacheStatus;
    error?: Error | null;
    meta?: Record<string, unknown>;
    dependencies?: string[];
  }): QueryEntry<T> {
    const keyHash = hashQueryKey(options.queryKey);
    const existing = this.store.get(keyHash) as QueryEntry<T> | undefined;

    if (existing) {
      if (options.data !== undefined) {
        const now = Date.now();
        existing.updateData(options.data, options.state, now);
        existing.fetchStatus = 'idle';
        existing.lastFetchedAt = now;
        existing.staleAt = new Date(now + this._staleTime).toISOString();
        existing.expiresAt = new Date(now + this.gcTime).toISOString();
      }
      if ('error' in options) {
        if (options.error != null) {
          existing.updateError(options.error, options.state);
          existing.fetchStatus = 'idle';
        } else {
          existing.error = null;
          existing.updatedAt = new Date().toISOString();
          existing.touch();
        }
      }
      if (options.meta !== undefined) {
        existing.meta = { ...existing.meta, ...options.meta };
      }
      existing.touch();
      return existing;
    }

    // Check size limit before insert. Eviction is best-effort: if all entries
    // are active, temporary overflow is permitted (see evict() invariant).
    if (this.store.size >= this.maxSize) {
      this.evict();
    }

    const entry = new QueryEntry<T>({
      queryId: generateId(),
      queryKey: options.queryKey,
      keyHash,
      data: options.data as T,
    });

    if (options.state !== undefined) entry.state = options.state;
    if (options.status !== undefined) entry.status = options.status;
    if (options.error !== undefined) entry.error = options.error;
    if (options.meta !== undefined) entry.meta = options.meta;
    if (options.dependencies !== undefined) entry.dependencies = [...options.dependencies];

    entry.lastFetchedAt = Date.now();
    entry.staleAt = new Date(Date.now() + this._staleTime).toISOString();
    entry.expiresAt = new Date(Date.now() + this.gcTime).toISOString();

    this.store.set(keyHash, entry);

    // Opportunistic GC: clean up expired entries when cache is near capacity
    if (this.store.size >= this.maxSize * 0.75) {
      this.collectGarbage();
    }

    return entry;
  }

  /**
   * Delete an entry by query key.
   *
   * @param queryKey - The query key to delete
   * @returns true if deleted, false if not found
   */
  delete(queryKey: QueryKey): boolean {
    const keyHash = hashQueryKey(queryKey);
    return this.store.delete(keyHash);
  }

  /**
   * Invalidate an entry by query key.
   * Marks entry as invalidated without removing it (RFC-000).
   * Propagates to dependent entries.
   *
   * @param queryKey - The query key to invalidate
   * @returns true if invalidated, false if not found
   */
  invalidate(queryKey: QueryKey): boolean {
    const keyHash = hashQueryKey(queryKey);
    const entry = this.store.get(keyHash);

    if (!entry) {
      return false;
    }

    entry.markInvalidated();
    this.propagateInvalidation(keyHash);
    return true;
  }

  /**
   * Propagate invalidation through dependency graph (RFC-000).
   * Max propagation depth: 8 levels.
   */
  private propagateInvalidation(sourceKeyHash: string, depth: number = 0): void {
    if (depth >= 8) return;

    for (const entry of this.store.values()) {
      if (entry.hasDependency(sourceKeyHash) && entry.status !== 'invalidated') {
        entry.markInvalidated();
        this.propagateInvalidation(entry.keyHash, depth + 1);
      }
    }
  }

  /**
   * Invalidate all entries matching an optional predicate (RFC-000).
   *
   * @param predicate - Optional filter function
   * @returns Number of entries invalidated
   */
  invalidateAll(predicate?: (key: string, entry: QueryEntry) => boolean): number {
    let count = 0;

    for (const [keyHash, entry] of this.store.entries()) {
      if (predicate && !predicate(keyHash, entry)) {
        continue;
      }
      entry.markInvalidated();
      count++;
    }

    return count;
  }

  /**
   * Clear all entries from cache.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): CacheStats {
    let activeEntries = 0;
    let gcEligibleEntries = 0;
    let totalAccesses = 0;

    for (const entry of this.store.values()) {
      if (entry.observerCount > 0) {
        activeEntries++;
      }
      if (entry.gcEligible) {
        gcEligibleEntries++;
      }
      totalAccesses += entry.accessCount;
    }

    return {
      size: this.store.size,
      activeEntries,
      gcEligibleEntries,
      totalAccesses,
    };
  }

  /**
   * Run garbage collection.
   * Removes entries that are expired and have no active observers.
   *
   * @returns Number of entries removed
   */
  collectGarbage(): number {
    const toRemove: string[] = [];

    for (const [hash, entry] of this.store.entries()) {
      if (entry.observerCount > 0) {
        continue;
      }
      if (!entry.gcEligible) {
        continue;
      }
      // Never GC an entry that has an active in-flight fetch
      if (entry.fetchStatus === 'fetching') {
        continue;
      }
      if (entry.isExpired(this.gcTime)) {
        toRemove.push(hash);
      }
    }

    for (const hash of toRemove) {
      this.store.delete(hash);
      // Isolate eviction failures: one entry's _onEvict exception must not
      // prevent subsequent eligible entries from being evicted.
      try {
        this._onEvict(hash);
      } catch {
        /* isolate */
      }
    }

    return toRemove.length;
  }

  /**
   * Evict least recently used entry.
   *
   * Active entries (observerCount > 0) are protected from eviction.
   * Inactive entries are eligible for LRU eviction when cache exceeds maxSize.
   * If all entries are active, eviction is a no-op and temporary overflow is
   * permitted. Capacity is restored when entries become inactive and subsequent
   * evictions occur.
   */
  private evict(): void {
    let lruHash: string | undefined;
    let lruScore = Infinity;

    for (const [hash, entry] of this.store.entries()) {
      // Active entries are protected from eviction.
      // If all entries are active, no candidate is found and temporary overflow
      // is permitted. Capacity restores when entries become inactive.
      if (entry.observerCount > 0) {
        continue;
      }
      // Never evict an entry that has an active in-flight fetch, consistent
      // with the collectGarbage() guard.
      if (entry.fetchStatus === 'fetching') {
        continue;
      }

      const score = entry.getLRUScore();
      if (score < lruScore) {
        lruScore = score;
        lruHash = hash;
      }
    }

    if (lruHash) {
      this.store.delete(lruHash);
      try {
        this._onEvict(lruHash);
      } catch {
        /* isolate */
      }
    }
  }

  /**
   * Check if a query key exists in cache.
   *
   * @param queryKey - The query key to check
   * @returns true if exists
   */
  has(queryKey: QueryKey): boolean {
    const keyHash = hashQueryKey(queryKey);
    return this.store.has(keyHash);
  }

  /**
   * Get all entries as an array.
   * Useful for debugging and testing.
   */
  entries(): QueryEntry[] {
    return Array.from(this.store.values());
  }

  /**
   * Get entry count.
   */
  get size(): number {
    return this.store.size;
  }

  /**
   * Destroy the cache engine.
   * Stops any GC timer and clears all entries.
   */
  destroy(): void {
    if (this._gcTimer !== undefined) {
      clearInterval(this._gcTimer);
      this._gcTimer = undefined;
    }
    this.store.clear();
  }
}
