import { describe, it, expect } from 'vitest';
import { hashQueryKey, isQueryKeyEqual, deepEqual, generateId, shallowEqual } from '../src/utils/query.utils';

describe('Query Utilities', () => {
  describe('hashQueryKey', () => {
    it('should produce deterministic hash for same input', () => {
      const key = ['users', 123];
      const hash1 = hashQueryKey(key);
      const hash2 = hashQueryKey(key);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different keys', () => {
      const key1 = ['users', 123];
      const key2 = ['users', 456];
      expect(hashQueryKey(key1)).not.toBe(hashQueryKey(key2));
    });

    it('should handle nested keys', () => {
      const key = ['users', { id: 123, role: 'admin' }];
      const hash = hashQueryKey(key);
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('isQueryKeyEqual', () => {
    it('should return true for identical keys', () => {
      expect(isQueryKeyEqual(['users'], ['users'])).toBe(true);
    });

    it('should return true for same reference', () => {
      const key = ['users'];
      expect(isQueryKeyEqual(key, key)).toBe(true);
    });

    it('should return false for different keys', () => {
      expect(isQueryKeyEqual(['users'], ['posts'])).toBe(false);
    });

    it('should return false for different lengths', () => {
      expect(isQueryKeyEqual(['users'], ['users', 123])).toBe(false);
    });

    it('should handle nested objects', () => {
      const key1 = ['users', { id: 123 }];
      const key2 = ['users', { id: 123 }];
      expect(isQueryKeyEqual(key1, key2)).toBe(true);
    });
  });

  describe('deepEqual', () => {
    it('should return true for identical primitives', () => {
      expect(deepEqual(1, 1)).toBe(true);
      expect(deepEqual('a', 'a')).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
    });

    it('should return true for same reference', () => {
      const obj = { a: 1 };
      expect(deepEqual(obj, obj)).toBe(true);
    });

    it('should return true for deeply equal objects', () => {
      expect(deepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true);
    });

    it('should return false for different values', () => {
      expect(deepEqual(1, 2)).toBe(false);
    });

    it('should handle arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });
  });

  describe('generateId', () => {
    it('should generate unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should return string type', () => {
      const id = generateId();
      expect(typeof id).toBe('string');
    });
  });

  describe('shallowEqual', () => {
    it('should return true for identical objects', () => {
      expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    });

    it('should return true for same reference', () => {
      const obj = { a: 1 };
      expect(shallowEqual(obj, obj)).toBe(true);
    });

    it('should return false for different values', () => {
      expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    });

    it('should return false for different keys', () => {
      expect(shallowEqual({ a: 1 }, { b: 1 })).toBe(false);
    });

    it('should return false for different lengths', () => {
      expect(shallowEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });
  });
});
