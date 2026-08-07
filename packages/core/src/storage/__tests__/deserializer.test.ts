/**
 * JsonDeserializer Tests
 */

import { describe, it, expect } from 'vitest';
import { JsonDeserializer } from '../deserializer/json-deserializer';
import { JsonSerializer } from '../serializer/json-serializer';
import type { PersistedState, ChecksumAlgorithm } from '../types';

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
      const serializer = new JsonSerializer({ checksum: { algorithm: 'fast-32' } });
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

      const fakeChecksum = { algorithm: 'fast-32' as const, value: 'invalid-hash' };
      expect(() => deserializer.deserializeWithChecksum(json, fakeChecksum)).toThrow();
    });

    it('should skip checksum validation when disabled', () => {
      const deserializer = new JsonDeserializer({ validateChecksum: false });
      const state = createTestState();
      const json = JSON.stringify(state);

      const fakeChecksum = { algorithm: 'fast-32' as const, value: 'invalid-hash' };
      const result = deserializer.deserializeWithChecksum(json, fakeChecksum);
      expect(result.version).toBe(1);
    });

    it('should accept every legacy checksum algorithm label on read (BC1 superset restore)', () => {
      // 1.0.0/1.1.0 wrote the 32-bit djb2 value under every label. Those
      // payloads MUST keep validating regardless of the label they carry.
      const serializer = new JsonSerializer({ checksum: { algorithm: 'fast-32' } });
      const deserializer = new JsonDeserializer({ validateChecksum: true });

      const state = createTestState();
      const { serialized, checksum } = serializer.serializeWithChecksum(state);

      for (const algorithm of ['md5', 'sha-256', 'sha-384', 'sha-512', 'fast-32'] as const) {
        const labeled = { ...checksum!, algorithm };
        const result = deserializer.deserializeWithChecksum(serialized, labeled);
        expect(result.version).toBe(1, `label ${algorithm} readable`);
      }
    });

    it('should accept a legacy djb2 digest under the sha-256 label (1.0.0/1.1.0 payloads)', () => {
      // Legacy payloads carry an 8-char djb2 value labeled "sha-256".
      const serializer = new JsonSerializer({ checksum: { algorithm: 'fast-32' } });
      const deserializer = new JsonDeserializer({ validateChecksum: true });

      const state = createTestState();
      const { serialized, checksum } = serializer.serializeWithChecksum(state);

      const legacySha256 = { algorithm: 'sha-256' as const, value: checksum!.value };
      const result = deserializer.deserializeWithChecksum(serialized, legacySha256);
      expect(result.version).toBe(1);
    });

    it('should reject a legacy djb2 digest under the sha-256 label when data differs', () => {
      const serializer = new JsonSerializer({ checksum: { algorithm: 'fast-32' } });
      const deserializer = new JsonDeserializer({ validateChecksum: true });

      const state = createTestState();
      const { checksum } = serializer.serializeWithChecksum(state);

      const tampered = JSON.stringify(createTestState()).replace('"users": [1, 2, 3]', '"users": [9, 9, 9]');
      const legacySha256 = { algorithm: 'sha-256' as const, value: checksum!.value };
      expect(() => deserializer.deserializeWithChecksum(tampered, legacySha256)).toThrow();
    });

    it('should round-trip payloads written under the sha-256 label (real SHA-256)', () => {
      const serializer = new JsonSerializer({ checksum: { algorithm: 'sha-256' } });
      const deserializer = new JsonDeserializer({ validateChecksum: true });

      const state = createTestState();
      const { serialized, checksum } = serializer.serializeWithChecksum(state);

      const result = deserializer.deserializeWithChecksum(serialized, checksum);
      expect(result.version).toBe(1);
      expect(checksum!.algorithm).toBe('sha-256');
      expect(checksum!.value).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should reject legacy-only write labels (sha-384, sha-512, md5)', () => {
      for (const algorithm of ['sha-384', 'sha-512', 'md5'] as const) {
        const serializer = new JsonSerializer({ checksum: { algorithm } });
        expect(() => serializer.serializeWithChecksum(createTestState())).toThrow(
          /never implemented and is deprecated/,
        );
      }
    });

    it('should reject an unsupported algorithm label', () => {
      const deserializer = new JsonDeserializer({ validateChecksum: true });
      const json = JSON.stringify(createTestState());

      const bogus = { algorithm: 'bogus-64' as ChecksumAlgorithm, value: 'abc' };
      expect(() => deserializer.deserializeWithChecksum(json, bogus)).toThrow();
    });
  });
});
