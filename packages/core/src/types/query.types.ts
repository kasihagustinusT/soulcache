/**
 * Query Key
 *
 * A serializable array that uniquely identifies cached data.
 * @see https://docs.soulcache.dev/api/query-key
 */
export type QueryKey = readonly unknown[];

/**
 * Query Status
 *
 * Represents the lifecycle state of a query.
 */
export type QueryStatus = 'idle' | 'loading' | 'success' | 'error' | 'fetching';

/**
 * Fetch Status
 *
 * Represents the current fetch operation state.
 */
export type FetchStatus = 'idle' | 'fetching' | 'paused';

/**
 * Mutation Status
 *
 * Represents the lifecycle state of a mutation.
 */
export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

/**
 * Updater Function
 *
 * A function that receives the previous value and returns the next value.
 */
export type Updater<T> = T | ((previous: T | undefined) => T);
