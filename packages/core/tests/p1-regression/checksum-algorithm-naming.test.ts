import { describe, it, expect } from 'vitest';
import { JsonSerializer, isSupportedAlgorithm } from '../../src/storage/serializer/json-serializer';
import { JsonDeserializer } from '../../src/storage/deserializer/json-deserializer';
import type { PersistedState } from '../../src/storage/types';

function createTestState(): PersistedState {
  return {
    version: 1,
    timestamp: Date.now(),
    queryCache: {
      entries: {},
      metadata: { entryCount: 0, totalSize: 0 },
    },
    mutationCache: {
      entries: {},
      metadata: { entryCount: 0, totalSize: 0 },
    },
    metadata: {
      lastUpdated: Date.now(),
      schemaVersion: 1,
    },
  };
}

describe('hash algorithm naming', () => {
  it('1. checksum uses fast-32 algorithm', () => {
    const serializer = new JsonSerializer({ checksum: { algorithm: 'fast-32' } });
    const state = createTestState();
    const { checksum } = serializer.serializeWithChecksum(state);

    expect(checksum).toBeDefined();
    expect(checksum?.algorithm).toBe('fast-32');
  });

  it('2. serialize + checksum + deserialize round-trip', () => {
    const serializer = new JsonSerializer({ checksum: { algorithm: 'fast-32' } });
    const deserializer = new JsonDeserializer({ validateChecksum: true });
    const state = createTestState();

    const { serialized, checksum } = serializer.serializeWithChecksum(state);
    const restored = deserializer.deserializeWithChecksum(serialized, checksum);

    expect(restored.version).toBe(state.version);
    expect(restored.queryCache).toEqual(state.queryCache);
  });

  it('3. fast-32 and all legacy labels are supported (BC1 superset restore)', () => {
    for (const algorithm of ['fast-32', 'sha-256', 'sha-384', 'sha-512', 'md5']) {
      expect(isSupportedAlgorithm(algorithm)).toBe(true);
    }
    expect(isSupportedAlgorithm('sha-1')).toBe(false);
    expect(isSupportedAlgorithm('bogus-64')).toBe(false);
  });
});
