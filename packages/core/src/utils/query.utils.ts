import type { QueryKey, QueryStatus } from '../types/query.types';
import type { QueryRecordState } from '../types/internal.types';

/**
 * Map internal QueryRecordState to public QueryStatus.
 * Single canonical implementation shared by QueryClient and QueryObserver.
 */
export function mapStateToStatus(state: QueryRecordState): QueryStatus {
  switch (state) {
    case 'idle':
      return 'idle';
    case 'pending':
    case 'fetching':
      return 'loading';
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'stale':
      return 'success';
    case 'invalidated':
      return 'loading';
    case 'destroyed':
      return 'idle';
    default:
      return 'idle';
  }
}

/**
 * Hash Query Key
 *
 * Creates a deterministic hash from a query key.
 * Same input always produces same output.
 *
 * @param queryKey - The query key to hash
 * @returns A deterministic string hash
 */
export function hashQueryKey(queryKey: QueryKey): string {
  return JSON.stringify(queryKey, (_key, value) => {
    if (typeof value === 'function') {
      return `fn:${value.name || 'anonymous'}`;
    }
    return value;
  });
}

/**
 * Is Query Key Equal
 *
 * Compares two query keys for equality.
 *
 * @param a - First query key
 * @param b - Second query key
 * @returns Whether the keys are equal
 */
export function isQueryKeyEqual(a: QueryKey, b: QueryKey): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (!deepEqual(a[i], b[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Deep Equal
 *
 * Performs deep equality comparison.
 *
 * Guards against pathological recursion (e.g. deeply nested or cyclic
 * structures) by bounding the traversal depth. Exceeding the depth limit
 * throws a RangeError rather than risking a stack overflow.
 *
 * @param a - First value
 * @param b - Second value
 * @returns Whether the values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  return deepEqualInternal(a, b, 0);
}

/** Maximum recursion depth before deepEqual aborts. */
const MAX_DEPTH = 100;

function deepEqualInternal(a: unknown, b: unknown, depth: number): boolean {
  if (Object.is(a, b)) return true;

  if (depth > MAX_DEPTH) {
    throw new RangeError(
      `deepEqual exceeded maximum depth of ${MAX_DEPTH}; possible cyclic or pathological structure`,
    );
  }

  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualInternal(a[i], b[i], depth + 1)) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !deepEqualInternal(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
        depth + 1,
      )
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Generate Unique ID
 *
 * Generates a unique identifier using a cryptographically secure random
 * source (`crypto.randomUUID`) when available. Falls back to a
 * timestamp + `Math.random` scheme only in environments without Web Crypto
 * (legacy browsers), matching the pre-1.1.1 behavior.
 *
 * These IDs are internal request/task/observer identifiers and carry no
 * security meaning today; the CSPRNG is defense-in-depth so the function is
 * safe to use for any future token-like purpose.
 *
 * @returns A unique string identifier
 */
export function generateId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
}

/**
 * Is Query Key Prefix
 *
 * Checks whether `prefix` is a structural array prefix of `key`.
 * Uses deep equality for element comparison.
 *
 * @example
 * ```ts
 * isKeyPrefixOf(['users'], ['users', 1])    // true
 * isKeyPrefixOf(['user'], ['users'])         // false
 * isKeyPrefixOf([], ['users', 1])            // true (empty prefix matches all)
 * ```
 *
 * @param prefix - The candidate prefix
 * @param key - The full query key to test against
 * @returns Whether prefix is a structural prefix of key
 */
export function isKeyPrefixOf(prefix: QueryKey, key: QueryKey): boolean {
  if (prefix.length > key.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i++) {
    if (!deepEqual(prefix[i], key[i])) {
      return false;
    }
  }

  return true;
}

/**
 * Is Equal
 *
 * Shallow equality comparison for objects.
 *
 * @param a - First object
 * @param b - Second object
 * @returns Whether objects are shallowly equal
 */
export function shallowEqual(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): boolean {
  if (a === b) return true;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (Object.is(a[key], b[key])) continue;
    return false;
  }

  return true;
}
