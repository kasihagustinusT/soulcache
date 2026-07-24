import { describe, it, expect } from 'vitest';
import {
  SoulCacheError,
  ConfigurationError,
  QueryError,
  CacheError,
  RuntimeError,
  ErrorCode,
} from '../src/errors';

describe('Error System', () => {
  describe('ErrorCode', () => {
    it('should have all required error codes', () => {
      expect(ErrorCode.INVALID_QUERY_KEY).toBe('SC_INVALID_QUERY_KEY');
      expect(ErrorCode.INVALID_CONFIGURATION).toBe('SC_INVALID_CONFIGURATION');
      expect(ErrorCode.FETCH_FAILED).toBe('SC_FETCH_FAILED');
      expect(ErrorCode.CACHE_ERROR).toBe('SC_CACHE_ERROR');
      expect(ErrorCode.INTERNAL_ERROR).toBe('SC_INTERNAL_ERROR');
    });
  });

  describe('SoulCacheError', () => {
    it('should create error with code and message', () => {
      const error = new SoulCacheError({
        code: ErrorCode.INVALID_QUERY_KEY,
        message: 'Invalid query key',
      });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(SoulCacheError);
      expect(error.code).toBe('SC_INVALID_QUERY_KEY');
      expect(error.message).toBe('Invalid query key');
      expect(error.name).toBe('SoulCacheError');
    });

    it('should preserve cause', () => {
      const cause = new Error('original');
      const error = new SoulCacheError({
        code: ErrorCode.FETCH_FAILED,
        message: 'Fetch failed',
        cause,
      });

      expect(error.cause).toBe(cause);
    });

    it('should preserve metadata', () => {
      const error = new SoulCacheError({
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal error',
        metadata: { queryId: '123' },
      });

      expect(error.metadata).toEqual({ queryId: '123' });
    });
  });

  describe('ConfigurationError', () => {
    it('should create configuration error', () => {
      const error = new ConfigurationError({
        message: 'Invalid configuration',
      });

      expect(error).toBeInstanceOf(SoulCacheError);
      expect(error).toBeInstanceOf(ConfigurationError);
      expect(error.code).toBe('SC_INVALID_CONFIGURATION');
      expect(error.name).toBe('ConfigurationError');
    });
  });

  describe('QueryError', () => {
    it('should create query error with default code', () => {
      const error = new QueryError({
        message: 'Query failed',
      });

      expect(error).toBeInstanceOf(SoulCacheError);
      expect(error).toBeInstanceOf(QueryError);
      expect(error.code).toBe('SC_FETCH_FAILED');
      expect(error.name).toBe('QueryError');
    });

    it('should create query error with custom code', () => {
      const error = new QueryError({
        message: 'Query cancelled',
        code: ErrorCode.CANCELLED,
      });

      expect(error.code).toBe('SC_CANCELLED');
    });
  });

  describe('CacheError', () => {
    it('should create cache error', () => {
      const error = new CacheError({
        message: 'Cache operation failed',
      });

      expect(error).toBeInstanceOf(SoulCacheError);
      expect(error).toBeInstanceOf(CacheError);
      expect(error.code).toBe('SC_CACHE_ERROR');
      expect(error.name).toBe('CacheError');
    });
  });

  describe('RuntimeError', () => {
    it('should create runtime error with default code', () => {
      const error = new RuntimeError({
        message: 'Internal error',
      });

      expect(error).toBeInstanceOf(SoulCacheError);
      expect(error).toBeInstanceOf(RuntimeError);
      expect(error.code).toBe('SC_INTERNAL_ERROR');
      expect(error.name).toBe('RuntimeError');
    });
  });
});
