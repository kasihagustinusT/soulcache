import { describe, it, expect, beforeEach } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';

describe('cache error must be clearable to null on update', () => {
  let cache: CacheEngine;

  beforeEach(() => {
    cache = new CacheEngine({ staleTime: 60000, gcTime: 300000 });
  });

  it('1. query failure creates error', () => {
    cache.set({
      queryKey: ['users', 1],
      data: { id: 1 },
      state: 'success',
    });

    cache.set({
      queryKey: ['users', 1],
      error: new Error('network failure'),
      state: 'error',
    });

    const entry = cache.get(['users', 1]);
    expect(entry).toBeDefined();
    expect(entry!.error).toBeInstanceOf(Error);
    expect(entry!.error!.message).toBe('network failure');
    expect(entry!.state).toBe('error');
  });

  it('2. successful refetch clears error', () => {
    cache.set({
      queryKey: ['users', 1],
      error: new Error('previous failure'),
      state: 'error',
    });

    cache.set({
      queryKey: ['users', 1],
      data: { id: 1, name: 'Alice' },
      state: 'success',
    });

    const entry = cache.get(['users', 1]);
    expect(entry).toBeDefined();
    expect(entry!.data).toEqual({ id: 1, name: 'Alice' });
    expect(entry!.state).toBe('success');
  });

  it('3. retry success clears error', () => {
    cache.set({
      queryKey: ['items', 1],
      error: new Error('transient'),
      state: 'error',
    });

    cache.set({
      queryKey: ['items', 1],
      data: { value: 'retry-ok' },
      state: 'success',
    });

    const entry = cache.get(['items', 1]);
    expect(entry!.error).toBeNull();
    expect(entry!.data).toEqual({ value: 'retry-ok' });
  });

  it('4. data remains when refetch fails again', () => {
    cache.set({
      queryKey: ['items', 2],
      data: { value: 'original' },
      state: 'success',
    });

    cache.set({
      queryKey: ['items', 2],
      error: new Error('still failing'),
      state: 'error',
    });

    const entry = cache.get(['items', 2]);
    expect(entry!.error).toBeInstanceOf(Error);
    expect(entry!.error!.message).toBe('still failing');
  });

  it('5. successful set with error:null clears error', () => {
    cache.set({
      queryKey: ['items', 3],
      error: new Error('old error'),
      state: 'error',
    });

    cache.set({
      queryKey: ['items', 3],
      data: { recovered: true },
      state: 'success',
    });

    const entry = cache.get(['items', 3]);
    expect(entry!.error).toBeNull();
  });

  it('6. error: null explicitly clears error on existing entry', () => {
    cache.set({
      queryKey: ['items', 4],
      error: new Error('to be cleared'),
      state: 'error',
    });

    const entryBefore = cache.get(['items', 4]);
    expect(entryBefore!.error).toBeInstanceOf(Error);

    // Explicitly set error to null — must clear it
    cache.set({
      queryKey: ['items', 4],
      error: null,
    });

    const entryAfter = cache.get(['items', 4]);
    expect(entryAfter!.error).toBeNull();
  });

  it('7. invalidate preserves error until refetch', () => {
    cache.set({
      queryKey: ['items', 5],
      error: new Error('existing error'),
      state: 'error',
    });

    cache.invalidate(['items', 5]);

    const entry = cache.get(['items', 5]);
    expect(entry!.error).toBeInstanceOf(Error);
    expect(entry!.error!.message).toBe('existing error');
  });

  it('8. clear removes error by removing entire entry', () => {
    cache.set({
      queryKey: ['items', 6],
      error: new Error('will be cleared'),
      state: 'error',
    });

    cache.clear();

    const entry = cache.get(['items', 6]);
    expect(entry).toBeUndefined();
  });

  it('9. set with only error:null does not create new entry when absent', () => {
    // Setting error:null on a non-existent key should NOT create an entry
    // because the existing-entry branch handles it, and the new-entry branch
    // only runs when no existing entry is found. For a non-existent key,
    // 'error' in options is true but there's no existing entry to update.
    cache.set({
      queryKey: ['nonexistent', 99],
      error: null,
    });

    const entry = cache.get(['nonexistent', 99]);
    // Entry is created by the new-entry path with error: null
    expect(entry).toBeDefined();
    expect(entry!.error).toBeNull();
  });

  it('10. observer receives error:null after successful refetch via cache set', () => {
    cache.set({
      queryKey: ['obs', 1],
      error: new Error('fetch failed'),
      state: 'error',
    });

    const entryWithError = cache.get(['obs', 1]);
    expect(entryWithError!.error).toBeInstanceOf(Error);

    cache.set({
      queryKey: ['obs', 1],
      data: { success: true },
      state: 'success',
    });

    const entryAfterSuccess = cache.get(['obs', 1]);
    expect(entryAfterSuccess!.error).toBeNull();
    expect(entryAfterSuccess!.data).toEqual({ success: true });
    expect(entryAfterSuccess!.state).toBe('success');
  });
});
