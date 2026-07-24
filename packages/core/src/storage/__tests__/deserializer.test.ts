/**
 * JsonDeserializer Tests
 */

import { describe, it, expect } from 'vitest';
import { JsonDeserializer } from '../deserializer/json-deserializer';
import { JsonSerializer } from '../serializer/json-serializer';
import type { PersistedState } from '../types';

describe('JsonDeserializer', () => {
  const createTestState = (version: number = 1): PersistedState => ({
    version,
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
      metadata: { entryCount: 1, totalSize: 1024 },
    },
    mutationCache: {
      entries: {},
      metadata: { entryCount: 0, totalSize: 0 },
    },
    metadata: { lastUpdated: 1690000000000, schemaVersion: 1 },
  });

  describe('Deserialization', () => {
    it('should deserialize valid JSON', () => {
      const deserializer = new JsonDeserializer();
      const state = createTestState();
      const json = JSON.stringify(state);

      const result = deserializer.deserialize(json);
      expect(result.version).toBe(1);
      expect(result.timestamp).toBe(1690000000000);
    });

    it('should throw on invalid JSON', () => {
      const deserializer = new JsonDeserializer();
      expect(() => deserializer.deserialize('not json')).toThrow();
    });

    it('should throw on empty string', () => {
      const deserializer = new JsonDeserializer();
      expect(() => deserializer.deserialize('')).toThrow();
    });

    it('should throw when required fields missing', () => {
      const deserializer = new JsonDeserializer();
      const invalid = JSON.stringify({ version: 1 });
      expect(() => deserializer.deserialize(invalid)).toThrow();
    });
  });

  describe('Structure Validation', () => {
    it('should validate correct structure', () => {
      const deserializer = new JsonDeserializer();
      const state = createTestState();
      const json = JSON.stringify(state);

      const result = deserializer.deserialize(json);
      expect(result.queryCache).toBeDefined();
      expect(result.mutationCache).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should detect corrupted query cache', () => {
      const deserializer = new JsonDeserializer();
      const corrupted = {
        version: 1,
        timestamp: 0,
        queryCache: 'not-an-object',
        mutationCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
        metadata: { lastUpdated: 0, schemaVersion: 1 },
      };
      const json = JSON.stringify(corrupted);
      expect(() => deserializer.deserialize(json)).toThrow();
    });
  });

  describe('Version Validation', () => {
    it('should accept valid version', () => {
      const deserializer = new JsonDeserializer({ acceptedVersions: [1] });
      const state = createTestState(1);
      const json = JSON.stringify(state);

      const result = deserializer.deserialize(json);
      expect(result.version).toBe(1);
    });

    it('should throw for incompatible version when validateVersion is on', () => {
      const deserializer = new JsonDeserializer({ acceptedVersions: [1] });
      const state = createTestState(2);
      const json = JSON.stringify(state);

      expect(() => deserializer.deserialize(json)).toThrow();
    });

    it('should skip version validation when disabled', () => {
      const deserializer = new JsonDeserializer({ validateVersion: false });
      const state = createTestState(999);
      const json = JSON.stringify(state);

      const result = deserializer.deserialize(json);
      expect(result.version).toBe(999);
    });
  });

  describe('Checksum Validation', () => {
    it('should validate checksum via deserializeWithChecksum', () => {
      const serializer = new JsonSerializer({ checksum: { algorithm: 'sha-256' } });
      const deserializer = new JsonDeserializer({ validateChecksum: true });

      const state = createTestState();
      const { serialized, checksum } = serializer.serializeWithChecksum(state);

      const result = deserializer.deserializeWithChecksum(serialized, checksum);
      expect(result.version).toBe(1);
    });

    it('should reject mismatched checksum via deserializeWithChecksum', () => {
      const deserializer = new JsonDeserializer({ validateChecksum: true });
      const state = createTestState();
      const json = JSON.stringify(state);

      const fakeChecksum = { algorithm: 'sha-256' as const, value: 'invalid-hash' };
      expect(() => deserializer.deserializeWithChecksum(json, fakeChecksum)).toThrow();
    });

    it('should skip checksum validation when disabled', () => {
      const deserializer = new JsonDeserializer({ validateChecksum: false });
      const state = createTestState();
      const json = JSON.stringify(state);

      const fakeChecksum = { algorithm: 'sha-256' as const, value: 'invalid-hash' };
      const result = deserializer.deserializeWithChecksum(json, fakeChecksum);
      expect(result.version).toBe(1);
    });
  });
});
