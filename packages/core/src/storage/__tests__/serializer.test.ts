/**
 * JsonSerializer Tests
 */

import { describe, it, expect } from 'vitest';
import { JsonSerializer, isSupportedAlgorithm } from '../serializer/json-serializer';
import type { PersistedState } from '../types';

describe('JsonSerializer', () => {
  const createTestState = (): PersistedState => ({
    version: 1,
    timestamp: 1690000000000,
    queryCache: {
      entries: {
        'query-key-1': {
          data: { users: [1, 2, 3] },
          timestamp: 1690000000000,
          status: 'fresh',
          fetchCount: 1,
          GCCount: 0,
        },
      },
      metadata: {
        entryCount: 1,
        totalSize: 1024,
      },
    },
    mutationCache: {
      entries: {},
      metadata: {
        entryCount: 0,
        totalSize: 0,
      },
    },
    metadata: {
      lastUpdated: 1690000000000,
      schemaVersion: 1,
    },
  });

  describe('Serialization', () => {
    it('should serialize state to JSON string', () => {
      const serializer = new JsonSerializer();
      const state = createTestState();
      const result = serializer.serialize(state);

      expect(typeof result).toBe('string');
      const parsed = JSON.parse(result);
      expect(parsed.version).toBe(1);
      expect(parsed.timestamp).toBe(1690000000000);
    });

    it('should produce deterministic output', () => {
      const serializer = new JsonSerializer();
      const state = createTestState();

      const result1 = serializer.serialize(state);
      const result2 = serializer.serialize(state);

      expect(result1).toBe(result2);
    });

    it('should sort object keys for determinism', () => {
      const serializer = new JsonSerializer();
      const state = createTestState();

      const result = serializer.serialize(state);
      const parsed = JSON.parse(result);

      // Keys should be sorted
      const keys = Object.keys(parsed);
      expect(keys).toEqual([...keys].sort());
    });

    it('should handle empty state', () => {
      const serializer = new JsonSerializer();
      const state: PersistedState = {
        version: 1,
        timestamp: 0,
        queryCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
        mutationCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
        metadata: { lastUpdated: 0, schemaVersion: 1 },
      };

      const result = serializer.serialize(state);
      expect(typeof result).toBe('string');
    });

    it('should throw SerializationError for circular references', () => {
      const serializer = new JsonSerializer();
      const state = createTestState() as Record<string, unknown>;
      state['circular'] = state;

      expect(() => serializer.serialize(state as PersistedState)).toThrow();
    });
  });

  describe('Checksum', () => {
    it('should serialize with checksum when configured', () => {
      const serializer = new JsonSerializer({
        checksum: { algorithm: 'sha-256' },
      });

      const state = createTestState();
      const { serialized, checksum } = serializer.serializeWithChecksum(state);

      expect(typeof serialized).toBe('string');
      expect(checksum).toBeDefined();
      expect(checksum?.algorithm).toBe('sha-256');
      expect(typeof checksum?.value).toBe('string');
    });

    it('should not include checksum when not configured', () => {
      const serializer = new JsonSerializer();
      const state = createTestState();
      const { checksum } = serializer.serializeWithChecksum(state);

      expect(checksum).toBeUndefined();
    });
  });

  describe('isSupportedAlgorithm', () => {
    it('should return true for supported algorithms', () => {
      expect(isSupportedAlgorithm('sha-256')).toBe(true);
      expect(isSupportedAlgorithm('sha-384')).toBe(true);
      expect(isSupportedAlgorithm('sha-512')).toBe(true);
      expect(isSupportedAlgorithm('md5')).toBe(true);
    });

    it('should return false for unsupported algorithms', () => {
      expect(isSupportedAlgorithm('sha-1')).toBe(false);
      expect(isSupportedAlgorithm('crc32')).toBe(false);
      expect(isSupportedAlgorithm('')).toBe(false);
    });
  });
});
