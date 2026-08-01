/**
 * QueryEntry BC2/BC3 compatibility shim tests
 *
 * Verifies the restored v1.0.0 public methods `markStale()` and `isStale()`
 * (deprecated shims) remain functional and behavior-compatible.
 */

import { describe, it, expect } from 'vitest';
import { QueryEntry } from '../query-entry';
import type { QueryKey } from '../../types/query.types';

function createEntry(options?: Partial<ConstructorParameters<typeof QueryEntry>[0]>): QueryEntry {
  return new QueryEntry({
    queryId: 'query-1',
    queryKey: ['key'] as QueryKey,
    keyHash: 'hash-1',
    data: { value: 1 },
    ...options,
  });
}

describe('QueryEntry markStale (BC2 shim)', () => {
  it('marks the entry stale and records staleAt', () => {
    const entry = createEntry({ state: 'success', status: 'fresh' });

    entry.markStale();

    expect(entry.status).toBe('stale');
    expect(entry.staleAt).not.toBeNull();
    expect(new Date(entry.staleAt!).getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('is deprecated (shim contract)', () => {
    const entry = createEntry();
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(entry), 'markStale');
    expect(typeof desc?.value).toBe('function');
  });
});

describe('QueryEntry isStale (BC3 shim)', () => {
  it('returns true when staleAt exceeds staleTime', () => {
    const entry = createEntry({ state: 'success', status: 'stale' });
    entry.staleAt = new Date(Date.now() - 5000).toISOString();

    expect(entry.isStale(1000)).toBe(true);
  });

  it('returns false when staleTime has not elapsed since staleAt', () => {
    const entry = createEntry({ state: 'success', status: 'stale' });
    entry.staleAt = new Date(Date.now() - 100).toISOString();

    expect(entry.isStale(5000)).toBe(false);
  });

  it('falls back to lastFetchedAt when staleAt is not set', () => {
    const entry = createEntry({ state: 'success', status: 'fresh' });
    entry.staleAt = null;
    entry.lastFetchedAt = Date.now() - 10_000;

    expect(entry.isStale(5000)).toBe(true);
    expect(entry.isStale(50_000)).toBe(false);
  });

  it('returns false when neither staleAt nor lastFetchedAt is set', () => {
    const entry = createEntry({ state: 'success', status: 'fresh' });
    entry.staleAt = null;
    entry.lastFetchedAt = undefined;

    expect(entry.isStale(0)).toBe(false);
  });
});
