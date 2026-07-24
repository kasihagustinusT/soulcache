import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CacheEngine } from '../../src/cache/cache-engine';
import { QueryEntry } from '../../src/cache/query-entry';

describe('QueryEntry', () => {
  it('should create entry with required fields', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users', 123],
      keyHash: '["users",123]',
    });

    expect(entry.queryId).toBe('test-123');
    expect(entry.queryKey).toEqual(['users', 123]);
    expect(entry.keyHash).toBe('["users",123]');
    expect(entry.state).toBe('idle');
    expect(entry.data).toBeUndefined();
    expect(entry.error).toBeNull();
    expect(entry.createdAt).toBeTypeOf('number');
    expect(entry.updatedAt).toBeTypeOf('string');
    expect(entry.accessCount).toBe(0);
    expect(entry.observerCount).toBe(0);
  });

  it('should track access metadata', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users'],
      keyHash: '["users"]',
    });

    expect(entry.accessCount).toBe(0);

    entry.touch();
    expect(entry.accessCount).toBe(1);

    entry.touch();
    expect(entry.accessCount).toBe(2);
  });

  it('should update data and state', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users'],
      keyHash: '["users"]',
    });

    entry.updateData({ name: 'Alice' }, 'success');

    expect(entry.data).toEqual({ name: 'Alice' });
    expect(entry.state).toBe('success');
  });

  it('should update error and state', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users'],
      keyHash: '["users"]',
    });

    const error = new Error('fetch failed');
    entry.updateError(error, 'error');

    expect(entry.error).toBe(error);
    expect(entry.state).toBe('error');
  });

  it('should mark as stale', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users'],
      keyHash: '["users"]',
    });

    entry.markStale();

    expect(entry.state).toBe('stale');
    expect(entry.staleAt).toBeTypeOf('string');
  });

  it('should calculate LRU score', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users'],
      keyHash: '["users"]',
    });

    const score1 = entry.getLRUScore();
    entry.touch();
    const score2 = entry.getLRUScore();

    // Score should decrease with access (more recently accessed = lower score)
    expect(score2).toBeLessThan(score1);
  });

  it('should implement QueryRecord interface', () => {
    const entry = new QueryEntry({
      queryId: 'test-123',
      queryKey: ['users'],
      keyHash: '["users"]',
    });

    // Verify all required QueryRecord fields exist
    expect(entry.queryId).toBeDefined();
    expect(entry.queryKey).toBeDefined();
    expect(entry.keyHash).toBeDefined();
    expect(entry.state).toBeDefined();
    expect(entry).toHaveProperty('data');
    expect(entry.error).toBeDefined();
    expect(entry.createdAt).toBeDefined();
    expect(entry.updatedAt).toBeDefined();
    expect(entry.accessCount).toBeDefined();
    expect(entry.observerCount).toBeDefined();
  });
});

describe('CacheEngine', () => {
  let cache: CacheEngine;

  beforeEach(() => {
    cache = new CacheEngine({
      staleTime: 1000,
      gcTime: 5000,
      maxSize: 1000,
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent key', () => {
      expect(cache.get(['nonexistent'])).toBeUndefined();
    });

    it('should retrieve stored entry', () => {
      cache.set({ queryKey: ['users', 123], data: { name: 'Alice' } });
      const entry = cache.get(['users', 123]);

      expect(entry).toBeDefined();
      expect(entry?.data).toEqual({ name: 'Alice' });
    });

    it('should update access count on get', () => {
      cache.set({ queryKey: ['users', 123] });
      const entry1 = cache.get(['users', 123]);
      const count1 = entry1?.accessCount;

      cache.get(['users', 123]);
      const entry2 = cache.get(['users', 123]);

      expect(entry2?.accessCount).toBeGreaterThan(count1 ?? 0);
    });
  });

  describe('set', () => {
    it('should create new entry', () => {
      const entry = cache.set({ queryKey: ['users', 123], data: { name: 'Alice' } });

      expect(entry).toBeDefined();
      expect(entry.data).toEqual({ name: 'Alice' });
      expect(cache.size).toBe(1);
    });

    it('should update existing entry', () => {
      cache.set({ queryKey: ['users', 123], data: { name: 'Alice' } });
      cache.set({ queryKey: ['users', 123], data: { name: 'Bob' } });

      const entry = cache.get(['users', 123]);
      expect(entry?.data).toEqual({ name: 'Bob' });
      expect(cache.size).toBe(1);
    });

    it('should handle different keys separately', () => {
      cache.set({ queryKey: ['users', 123], data: { name: 'Alice' } });
      cache.set({ queryKey: ['posts', 456], data: { title: 'Post 1' } });

      expect(cache.size).toBe(2);
    });
  });

  describe('delete', () => {
    it('should remove entry', () => {
      cache.set({ queryKey: ['users', 123] });
      const deleted = cache.delete(['users', 123]);

      expect(deleted).toBe(true);
      expect(cache.get(['users', 123])).toBeUndefined();
      expect(cache.size).toBe(0);
    });

    it('should return false for non-existent key', () => {
      expect(cache.delete(['nonexistent'])).toBe(false);
    });
  });

  describe('invalidate', () => {
    it('should mark entry as stale', () => {
      cache.set({ queryKey: ['users', 123], state: 'success' });
      const invalidated = cache.invalidate(['users', 123]);

      expect(invalidated).toBe(true);
      const entry = cache.get(['users', 123]);
      expect(entry?.state).toBe('stale');
    });

    it('should return false for non-existent key', () => {
      expect(cache.invalidate(['nonexistent'])).toBe(false);
    });

    it('should not remove entry', () => {
      cache.set({ queryKey: ['users', 123] });
      cache.invalidate(['users', 123]);

      expect(cache.has(['users', 123])).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set({ queryKey: ['users', 1] });
      cache.set({ queryKey: ['users', 2] });
      cache.set({ queryKey: ['posts', 1] });

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.entries()).toHaveLength(0);
    });
  });

  describe('has', () => {
    it('should return true for existing entry', () => {
      cache.set({ queryKey: ['users', 123] });
      expect(cache.has(['users', 123])).toBe(true);
    });

    it('should return false for non-existent entry', () => {
      expect(cache.has(['nonexistent'])).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      cache.set({ queryKey: ['users', 1] });
      cache.set({ queryKey: ['users', 2], state: 'success' });

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.activeEntries).toBe(0);
      expect(stats.gcEligibleEntries).toBe(2);
      expect(stats.totalAccesses).toBe(0);
    });

    it('should count active entries', () => {
      const entry = cache.set({ queryKey: ['users', 1] });
      entry.observerCount = 1;

      const stats = cache.getStats();
      expect(stats.activeEntries).toBe(1);
    });
  });

  describe('collectGarbage', () => {
    it('should not remove active entries', () => {
      const entry = cache.set({ queryKey: ['users', 1] });
      entry.observerCount = 1;
      // Force expired by manipulating expiresAt
      (entry as any).expiresAt = new Date(Date.now() - 100000).toISOString();

      const removed = cache.collectGarbage();
      expect(removed).toBe(0);
      expect(cache.size).toBe(1);
    });

    it('should remove expired entries', () => {
      const entry = cache.set({ queryKey: ['users', 1] });
      // Force expired by manipulating expiresAt
      (entry as any).expiresAt = new Date(Date.now() - 100000).toISOString();

      const removed = cache.collectGarbage();
      expect(removed).toBe(1);
      expect(cache.size).toBe(0);
    });
  });

  describe('LRU eviction', () => {
    it('should evict LRU entry when cache is full', () => {
      const smallCache = new CacheEngine({ maxSize: 3 });

      smallCache.set({ queryKey: ['users', 1] });
      smallCache.set({ queryKey: ['users', 2] });
      smallCache.set({ queryKey: ['users', 3] });

      // Access first entry to make it more recent
      smallCache.get(['users', 1]);

      // This should trigger eviction
      smallCache.set({ queryKey: ['users', 4] });

      expect(smallCache.size).toBe(3);
    });

    it('should not evict active entries', () => {
      const smallCache = new CacheEngine({ maxSize: 2 });

      const entry1 = smallCache.set({ queryKey: ['users', 1] });
      entry1.observerCount = 1; // Mark as active

      smallCache.set({ queryKey: ['users', 2] });

      // This should trigger eviction but keep active entry
      smallCache.set({ queryKey: ['users', 3] });

      expect(smallCache.has(['users', 1])).toBe(true);
    });
  });

  describe('entries', () => {
    it('should return all entries', () => {
      cache.set({ queryKey: ['users', 1] });
      cache.set({ queryKey: ['users', 2] });

      const entries = cache.entries();
      expect(entries).toHaveLength(2);
    });
  });
});
