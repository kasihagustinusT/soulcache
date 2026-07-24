/**
 * RestoreManager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RestoreManager } from '../restore-manager';
import { MemoryAdapter } from '../adapters/memory-adapter';
import type { PersistedState } from '../types';

describe('RestoreManager', () => {
  let manager: RestoreManager;
  let adapter: MemoryAdapter;

  const createTestState = (version: number = 1): PersistedState => ({
    version,
    timestamp: 1690000000000,
    queryCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
    mutationCache: { entries: {}, metadata: { entryCount: 0, totalSize: 0 } },
    metadata: { lastUpdated: 1690000000000, schemaVersion: version },
  });

  const defaultDeserialize = (data: string): PersistedState => JSON.parse(data);

  beforeEach(async () => {
    manager = new RestoreManager({ prefix: 'test' });
    adapter = new MemoryAdapter();
    await adapter.initialize();
  });

  describe('Restore', () => {
    it('should restore state from adapter', async () => {
      const state = createTestState();
      const serialized = JSON.stringify(state);
      await adapter.set('test:state', serialized);

      const result = await manager.restore(adapter, defaultDeserialize);

      expect(result).toBeDefined();
      expect(result?.version).toBe(1);
    });

    it('should return null when no data exists', async () => {
      const result = await manager.restore(adapter, defaultDeserialize);
      expect(result).toBeNull();
    });

    it('should return null for deserialization errors', async () => {
      await adapter.set('test:state', 'not-valid-json');

      const { DeserializationError } = await import('../errors');
      const result = await manager.restore(adapter, () => {
        throw new DeserializationError('parse error');
      });

      expect(result).toBeNull();
    });

    it('should throw for non-deserialization errors', async () => {
      await adapter.set('test:state', 'data');

      await expect(
        manager.restore(adapter, () => {
          throw new Error('unexpected error');
        })
      ).rejects.toThrow('unexpected error');
    });
  });

  describe('Has Data', () => {
    it('should return false when no data', async () => {
      const has = await manager.hasData(adapter);
      expect(has).toBe(false);
    });

    it('should return true when data exists', async () => {
      await adapter.set('test:state', '{}');
      const has = await manager.hasData(adapter);
      expect(has).toBe(true);
    });
  });

  describe('Remove', () => {
    it('should remove persisted data', async () => {
      await adapter.set('test:state', '{}');
      expect(await manager.hasData(adapter)).toBe(true);

      await manager.remove(adapter);
      expect(await manager.hasData(adapter)).toBe(false);
    });
  });

  describe('Configuration', () => {
    it('should use default prefix', async () => {
      const defaultManager = new RestoreManager();
      await adapter.set('soulcache:state', JSON.stringify(createTestState()));

      const result = await defaultManager.restore(adapter, defaultDeserialize);
      expect(result).toBeDefined();
    });

    it('should use custom prefix', async () => {
      const customManager = new RestoreManager({ prefix: 'custom' });
      await adapter.set('custom:state', JSON.stringify(createTestState()));

      const result = await customManager.restore(adapter, defaultDeserialize);
      expect(result).toBeDefined();
    });
  });
});
