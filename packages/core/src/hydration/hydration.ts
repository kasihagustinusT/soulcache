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
  const includeStack = options?.includeStack ?? false;
  const includeStale = options?.includeStale ?? false;

  const queries: DehydratedQuery[] = [];

  for (const entry of entries) {
    if (queries.length >= maxQueries) break;

    // Skip stale or invalidated entries unless explicitly included
    if (!includeStale && (entry.state === 'stale' || entry.state === 'invalidated')) continue;

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
      // `stack` exposes internal file paths when the dehydrated state is sent
      // to a client. It is opt-in to avoid leaking server implementation
      // details (SLC-HYDRATE-003).
      if (includeStack && entry.error.stack !== undefined) {
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

    // Reject malformed entries before they can corrupt the cache
    if (!isValidHydrationQuery(query)) {
      throw new TypeError('Invalid dehydrated state: query must be an object with an array "queryKey"');
    }

    // Check if query already exists
    const existing = cache.get(query.queryKey);

    if (existing && mergeStrategy === 'skip') {
      continue;
    }

    // 'merge': preserve existing data; only hydrate entries without data
    if (existing && mergeStrategy === 'merge' && existing.data !== undefined) {
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
 * Is Valid Hydration Query
 *
 * Structural guard for `hydrate()`. Hydration input is application-influenced
 * (and, in some deployments, client-influenced); malformed entries must not be
 * written into the cache. Mirrors the validation performed by `deserialize()`.
 *
 * @param query - Candidate dehydrated query
 * @returns Whether the entry is structurally valid
 */
function isValidHydrationQuery(query: unknown): query is DehydratedQuery {
  if (query === null || typeof query !== 'object' || Array.isArray(query)) {
    return false;
  }
  const q = query as Record<string, unknown>;
  return Array.isArray(q.queryKey);
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
 * Validates the parsed structure so that malformed or hostile input cannot
 * crash hydration or corrupt the cache.
 *
 * @param json - The JSON string to parse
 * @returns The dehydrated state
 * @throws {SyntaxError} If the input is not valid JSON
 * @throws {TypeError} If the parsed shape is not a valid DehydratedState
 */
export function deserialize(json: string): DehydratedState {
  const parsed = JSON.parse(json) as unknown;

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Invalid dehydrated state: expected an object');
  }

  const state = parsed as Record<string, unknown>;

  if (state.queries !== undefined) {
    if (!Array.isArray(state.queries)) {
      throw new TypeError('Invalid dehydrated state: "queries" must be an array');
    }
    for (let i = 0; i < state.queries.length; i++) {
      const query = state.queries[i] as Record<string, unknown> | undefined;
      if (query === null || typeof query !== 'object' || Array.isArray(query)) {
        throw new TypeError(`Invalid dehydrated state: query at index ${i} must be an object`);
      }
      if (!Array.isArray(query.queryKey)) {
        throw new TypeError(`Invalid dehydrated state: query at index ${i} must have an array "queryKey"`);
      }
    }
  }

  // Reconstruct errors
  if (Array.isArray(state.queries)) {
    for (const query of state.queries as Array<Record<string, unknown>>) {
      const error = query.error;
      const message = (error as { message?: unknown } | undefined)?.message;
      if (error && typeof error === 'object' && typeof message === 'string' && message.length > 0) {
        const err = new Error(message);
        err.name = (error as { name?: unknown }).name as string;
        if (typeof (error as { stack?: unknown }).stack === 'string') {
          err.stack = (error as { stack: string }).stack;
        }
        query.error = err;
      }
    }
  }

  return state as unknown as DehydratedState;
}
