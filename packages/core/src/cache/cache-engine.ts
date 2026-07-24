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

  constructor(options?: CacheEngineOptions) {
    this._staleTime = options?.staleTime ?? DEFAULT_STALE_TIME;
    this.gcTime = options?.gcTime ?? DEFAULT_GC_TIME;
    this.maxSize = options?.maxSize ?? MAX_CACHE_SIZE;
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
        existing.lastFetchedAt = now;
        existing.staleAt = new Date(now + this._staleTime).toISOString();
        existing.expiresAt = new Date(now + this.gcTime).toISOString();
      }
      if (options.error !== undefined && options.error !== null) {
        existing.updateError(options.error, options.state);
      }
      if (options.meta !== undefined) {
        existing.meta = { ...existing.meta, ...options.meta };
      }
      existing.touch();
      return existing;
    }

    // Check size limit before insert
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
    if (options.dependencies !== undefined) entry.dependencies = options.dependencies;

    entry.lastFetchedAt = Date.now();
    entry.staleAt = new Date(Date.now() + this._staleTime).toISOString();
    entry.expiresAt = new Date(Date.now() + this.gcTime).toISOString();

    this.store.set(keyHash, entry);
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
      if (entry.isExpired(this.gcTime)) {
        toRemove.push(hash);
      }
    }

    for (const hash of toRemove) {
      this.store.delete(hash);
    }

    return toRemove.length;
  }

  /**
   * Evict least recently used entry.
   */
  private evict(): void {
    let lruHash: string | undefined;
    let lruScore = Infinity;

    for (const [hash, entry] of this.store.entries()) {
      // Don't evict active entries
      if (entry.observerCount > 0) {
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
}
