import type { CacheEngine } from '../cache/cache-engine';
import type {
  DehydratedQuery,
  DehydratedState,
  HydrationOptions,
  DehydrationOptions,
} from '../types/hydration.types';

/**
 * Dehydrate
 *
 * Serializes the current state of a CacheEngine into a transportable format.
 * The resulting DehydratedState can be serialized to JSON and sent to the client.
 *
 * @param cache - The cache engine to serialize
 * @param options - Dehydration options
 * @returns The dehydrated state
 *
 * @example
 * ```ts
 * // Server-side
 * const state = dehydrate(queryClient.getCache(), {
 *   filter: (query) => query.queryKey[0] === 'user',
 * });
 * const json = JSON.stringify(state);
 * // Send to client...
 * ```
 */
export function dehydrate(
  cache: CacheEngine,
  options?: DehydrationOptions,
): DehydratedState {
  const entries = cache.entries();
  const maxQueries = options?.maxQueries ?? entries.length;
  const includeErrors = options?.includeErrors ?? true;
  const includeStale = options?.includeStale ?? false;

  const queries: DehydratedQuery[] = [];

  for (const entry of entries) {
    if (queries.length >= maxQueries) break;

    // Skip stale entries unless explicitly included
    if (!includeStale && entry.state === 'stale') continue;

    // Skip error entries unless explicitly included
    if (!includeErrors && entry.state === 'error') continue;

    const dehydrated: DehydratedQuery = {
      queryKey: entry.queryKey,
      keyHash: entry.keyHash,
      data: entry.data,
      state: entry.state === 'stale' || entry.state === 'invalidated' || entry.state === 'destroyed'
        ? 'success'
        : entry.state as 'idle' | 'pending' | 'success' | 'error',
      updatedAt: new Date(entry.updatedAt).getTime(),
    };

    if (entry.lastFetchedAt !== undefined) {
      (dehydrated as { lastFetchedAt?: number }).lastFetchedAt = entry.lastFetchedAt;
    }
    if (entry.staleAt !== null) {
      (dehydrated as { staleAt?: number }).staleAt = new Date(entry.staleAt).getTime();
    }

    if (entry.error && includeErrors) {
      const errorEntry: { message: string; name: string; stack?: string } = {
        message: entry.error.message,
        name: entry.error.name,
      };
      if (entry.error.stack !== undefined) {
        errorEntry.stack = entry.error.stack;
      }
      (dehydrated as { error?: typeof errorEntry }).error = errorEntry;
    }

    // Apply custom filter
    if (options?.filter && !options.filter(dehydrated)) continue;

    queries.push(dehydrated);
  }

  return {
    version: 1,
    timestamp: Date.now(),
    queries,
  };
}

/**
 * Hydrate
 *
 * Restores query state from a DehydratedState into a CacheEngine.
 * Typically used on the client to restore server-rendered state.
 *
 * @param cache - The cache engine to populate
 * @param state - The dehydrated state to restore
 * @param options - Hydration options
 *
 * @example
 * ```ts
 * // Client-side
 * const state = JSON.parse(serializedState);
 * hydrate(queryClient.getCache(), state);
 * ```
 */
export function hydrate(
  cache: CacheEngine,
  state: DehydratedState,
  options?: HydrationOptions,
): void {
  if (!state?.queries) return;

  const maxQueries = options?.maxQueries ?? state.queries.length;
  const mergeStrategy = options?.mergeStrategy ?? 'overwrite';

  let hydratedCount = 0;

  for (const query of state.queries) {
    if (hydratedCount >= maxQueries) break;

    // Apply custom filter
    if (options?.filter && !options.filter(query)) continue;

    // Check if query already exists
    const existing = cache.get(query.queryKey);

    if (existing && mergeStrategy === 'skip') {
      continue;
    }

    // Hydrate the query
    const hydratedData = query.data;
    const error = query.error
      ? Object.assign(new Error(query.error.message), {
          name: query.error.name,
          stack: query.error.stack,
        })
      : undefined;

    cache.set({
      queryKey: query.queryKey,
      data: hydratedData,
      state: query.state,
      error: error ?? null,
    });

    hydratedCount++;
  }
}

/**
 * Serialize
 *
 * Converts a DehydratedState to a JSON string.
 * Handles Date serialization and error reconstruction.
 *
 * @param state - The dehydrated state to serialize
 * @returns JSON string
 */
export function serialize(state: DehydratedState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize
 *
 * Parses a JSON string back into a DehydratedState.
 * Reconstructs Error objects from serialized form.
 *
 * @param json - The JSON string to parse
 * @returns The dehydrated state
 */
export function deserialize(json: string): DehydratedState {
  const parsed = JSON.parse(json) as DehydratedState;

  // Reconstruct errors
  if (parsed.queries) {
    for (const query of parsed.queries) {
      if (query.error && query.error.message) {
        const error = new Error(query.error.message);
        error.name = query.error.name;
        if (query.error.stack) {
          error.stack = query.error.stack;
        }
        (query as { error: Error }).error = error;
      }
    }
  }

  return parsed;
}
