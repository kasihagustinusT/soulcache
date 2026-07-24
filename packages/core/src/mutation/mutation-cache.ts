import type { MutationEntryOptions } from './mutation-entry';
import type { MutationEntry } from './mutation-entry';
import { MutationEntry as MutationEntryImpl } from './mutation-entry';

/**
 * Mutation Cache Options
 */
export interface MutationCacheOptions {
  /** Maximum number of mutations to keep in history */
  readonly maxSize?: number;
}

/**
 * Mutation Cache
 *
 * Stores and manages mutation entries. Provides O(1) lookup by mutation ID
 * and supports finding mutations by various criteria.
 *
 * @example
 * ```ts
 * const cache = new MutationCache({ maxSize: 100 });
 *
 * // Create a mutation
 * const entry = cache.create({
 *   mutationId: 'mut-1',
 *   mutationFn: async (vars) => {
 *     const res = await fetch('/api/users', { method: 'POST', body: JSON.stringify(vars) });
 *     return res.json();
 *   },
 * });
 *
 * // Find mutations
 * const pending = cache.findAll({ status: 'pending' });
 * ```
 */
export class MutationCache {
  private readonly _mutations: Map<string, MutationEntry<unknown, unknown>> = new Map();
  private readonly _maxSize: number;
  private readonly _listeners: Set<() => void> = new Set();

  constructor(options?: MutationCacheOptions) {
    this._maxSize = options?.maxSize ?? 1000;
  }

  /**
   * Number of mutations in cache.
   */
  get size(): number {
    return this._mutations.size;
  }

  /**
   * Create a new mutation entry.
   *
   * @param options - Mutation configuration
   * @returns The created mutation entry
   */
  create<TData = unknown, TVariables = unknown>(
    options: MutationEntryOptions<TData, TVariables>,
  ): MutationEntry<TData, TVariables> {
    const entry = new MutationEntryImpl(options);

    // Enforce size limit
    if (this._mutations.size >= this._maxSize) {
      this.evictOldest();
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this._mutations.set(entry.id, entry as MutationEntry<unknown, unknown>);

    // Subscribe to entry changes to notify cache listeners
    entry.subscribe(() => {
      this.notifyListeners();
    });

    this.notifyListeners();

    return entry;
  }

  /**
   * Get a mutation by ID.
   *
   * @param mutationId - The mutation ID
   * @returns The mutation entry if found, undefined otherwise
   */
  get<TData = unknown, TVariables = unknown>(
    mutationId: string,
  ): MutationEntry<TData, TVariables> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this._mutations.get(mutationId) as MutationEntry<TData, TVariables> | undefined;
  }

  /**
   * Find all mutations matching criteria.
   *
   * @param filters - Filter criteria
   * @returns Array of matching mutations
   */
  findAll(filters?: {
    status?: 'idle' | 'pending' | 'success' | 'error';
    mutationId?: string;
  }): MutationEntry[] {
    const results: MutationEntry[] = [];

    for (const entry of this._mutations.values()) {
      if (filters?.status !== undefined && entry.status !== filters.status) {
        continue;
      }
      if (filters?.mutationId !== undefined && entry.id !== filters.mutationId) {
        continue;
      }
      results.push(entry);
    }

    return results;
  }

  /**
   * Remove a mutation by ID.
   *
   * @param mutationId - The mutation ID to remove
   * @returns true if removed, false if not found
   */
  remove(mutationId: string): boolean {
    const entry = this._mutations.get(mutationId);
    if (!entry) return false;

    entry.destroy();
    this._mutations.delete(mutationId);
    this.notifyListeners();

    return true;
  }

  /**
   * Clear all mutations.
   */
  clear(): void {
    for (const entry of this._mutations.values()) {
      entry.destroy();
    }
    this._mutations.clear();
    this.notifyListeners();
  }

  /**
   * Subscribe to cache changes.
   *
   * @param listener - Function called on cache changes
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Get all mutations as an array.
   */
  entries(): MutationEntry<unknown, unknown>[] {
    return Array.from(this._mutations.values());
  }

  /**
   * Destroy the mutation cache.
   */
  destroy(): void {
    this.clear();
    this._listeners.clear();
  }

  private evictOldest(): void {
    let oldestId: string | undefined;
    let oldestTime = Infinity;

    for (const [id, entry] of this._mutations.entries()) {
      // Don't evict pending mutations
      if (entry.isPending) continue;

      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestId = id;
      }
    }

    if (oldestId) {
      const entry = this._mutations.get(oldestId);
      entry?.destroy();
      this._mutations.delete(oldestId);
    }
  }

  private notifyListeners(): void {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (_error) {
        // Listener errors must not crash the runtime.
      }
    }
  }
}
