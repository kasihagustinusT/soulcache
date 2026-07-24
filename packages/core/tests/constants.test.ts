import { describe, it, expect } from 'vitest';
import {
  DEFAULT_STALE_TIME,
  DEFAULT_GC_TIME,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_DELAY,
  DEFAULT_RETRY_BACKOFF,
  MAX_QUERY_KEY_DEPTH,
  MAX_OBSERVER_COUNT,
  MIN_CACHE_SIZE,
  MAX_CACHE_SIZE,
  RUNTIME_VERSION,
} from '../src/constants';

describe('Constants', () => {
  describe('Default Times', () => {
    it('should have correct stale time (5 minutes)', () => {
      expect(DEFAULT_STALE_TIME).toBe(300000);
    });

    it('should have correct GC time (30 minutes)', () => {
      expect(DEFAULT_GC_TIME).toBe(1800000);
    });
  });

  describe('Retry Defaults', () => {
    it('should have correct retry count', () => {
      expect(DEFAULT_RETRY_COUNT).toBe(3);
    });

    it('should have correct retry delay', () => {
      expect(DEFAULT_RETRY_DELAY).toBe(1000);
    });

    it('should have correct retry backoff', () => {
      expect(DEFAULT_RETRY_BACKOFF).toBe(2);
    });
  });

  describe('Limits', () => {
    it('should have correct max query key depth', () => {
      expect(MAX_QUERY_KEY_DEPTH).toBe(10);
    });

    it('should have correct max observer count', () => {
      expect(MAX_OBSERVER_COUNT).toBe(10000);
    });

    it('should have correct min cache size', () => {
      expect(MIN_CACHE_SIZE).toBe(100);
    });

    it('should have correct max cache size', () => {
      expect(MAX_CACHE_SIZE).toBe(100000);
    });
  });

  describe('Version', () => {
    it('should have valid version string', () => {
      expect(RUNTIME_VERSION).toBe('0.1.0');
    });
  });
});
