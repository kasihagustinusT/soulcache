import type { QueryKey } from '../types/query.types';

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
 * @param a - First value
 * @param b - Second value
 * @returns Whether the values are deeply equal
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;

  if (a === null || b === null) return false;
  if (a === undefined || b === undefined) return false;

  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') return false;

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a as Record<string, unknown>);
  const keysB = Object.keys(b as Record<string, unknown>);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (
      !deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key],
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
 * Generates a unique identifier.
 *
 * @returns A unique string identifier
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${random}`;
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
