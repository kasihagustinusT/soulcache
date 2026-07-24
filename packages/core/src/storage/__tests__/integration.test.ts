/**
 * Storage Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../storage-manager';
import { MemoryAdapter } from '../adapters/memory-adapter';
import { JsonSerializer } from '../serializer/json-serializer';
import { JsonDeserializer } from '../deserializer/json-deserializer';
import type { PersistedState, StorageEventData } from '../types';

describe('Storage Integration', () => {
  const createTestState = (version: number = 1): PersistedState => ({
    version,
    timestamp: Date.now(),
    queryCache: {
      entries: {
        'query-1': {
          data: { users: [1, 2, 3] },
          timestamp: Date.now(),
          status: 'fresh',
          fetchCount: 1,
          GCCount: 0,
        },
        'query-2': {
          data: { posts: [1, 2, 3, 4, 5] },
          timestamp: Date.now() - 1000 * 60 * 60 * 24 * 2,
          status: 'stale',
          fetchCount: 10,
          GCCount: 3,
        },
      },
      metadata: { entryCount: 2, totalSize: 2048 },
    },
    mutationCache: {
      entries: {
        'mut-1': {
          data: { id: 1 },
          status: 'completed',
          timestamp: Date.now() - 1000,
        },
      },
      metadata: { entryCount: 1, totalSize: 512 },
    },
    metadata: { lastUpdated: Date.now(), schemaVersion: 1 },
  });

  describe('Full Lifecycle', () => {
    it('should save and restore state', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
      await manager.initialize();

      const state = createTestState();
      await manager.save(state);

      const restored = await manager.restore();

      expect(restored).toBeDefined();
      expect(restored?.version).toBe(1);
      expect(restored?.queryCache.entries).toHaveProperty('query-1');
      expect(restored?.mutationCache.entries).toHaveProperty('mut-1');

      await manager.dispose();
    });

    it('should handle multiple save/restore cycles', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
      await manager.initialize();

      const state1 = createTestState(1);
      await manager.save(state1);

      const state2 = createTestState(1);
      await manager.save(state2);

      const restored = await manager.restore();
      expect(restored?.version).toBe(1);
      expect(Object.keys(restored?.queryCache.entries ?? {})).toHaveLength(2);

      await manager.dispose();
    });

    it('should clear and restore to null', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
      await manager.initialize();

      const state = createTestState();
      await manager.save(state);

      await manager.clear();

      const restored = await manager.restore();
      expect(restored).toBeNull();

      await manager.dispose();
    });
  });

  describe('Serializer Integration', () => {
    it('should work with JsonSerializer and JsonDeserializer', () => {
      const serializer = new JsonSerializer({ checksum: { algorithm: 'sha-256' } });
      const deserializer = new JsonDeserializer();

      const state = createTestState();
      const { serialized, checksum } = serializer.serializeWithChecksum(state);

      const restored = deserializer.deserializeWithChecksum(serialized, checksum);

      expect(restored.version).toBe(state.version);
      expect(restored.queryCache.entries).toHaveProperty('query-1');
    });
  });

  describe('MemoryAdapter Integration', () => {
    it('should persist data in MemoryAdapter', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const key = 'test-key';
      const value = JSON.stringify(createTestState());

      await adapter.set(key, value);
      const retrieved = await adapter.get(key);

      expect(retrieved).toBe(value);

      await adapter.dispose();
    });

    it('should handle concurrent operations', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const operations = Array.from({ length: 100 }, (_, i) =>
        adapter.set(`key-${i}`, `value-${i}`)
      );

      await Promise.all(operations);

      const size = await adapter.getSize();
      expect(size).toBe(100);

      await adapter.dispose();
    });
  });

  describe('Event Flow', () => {
    it('should emit complete event sequence', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
      await manager.initialize();

      const events: string[] = [];
      manager.on('storage.save.start', () => events.push('save.start'));
      manager.on('storage.save.complete', () => events.push('save.complete'));
      manager.on('storage.restore.start', () => events.push('restore.start'));
      manager.on('storage.restore.complete', () => events.push('restore.complete'));

      const state = createTestState();
      await manager.save(state);
      await manager.restore();

      expect(events).toEqual([
        'save.start',
        'save.complete',
        'restore.start',
        'restore.complete',
      ]);

      await manager.dispose();
    });
  });

  describe('Error Handling', () => {
    it('should handle adapter failure during save', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      const manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
      await manager.initialize();
      await manager.dispose();

      const state = createTestState();
      await expect(manager.save(state)).rejects.toThrow();
    });

    it('should handle corrupted data gracefully', async () => {
      const adapter = new MemoryAdapter();
      await adapter.initialize();

      await adapter.set('test:state', 'not-valid-json');

      const deserializer = new JsonDeserializer();
      const data = await adapter.get('test:state');

      expect(() => deserializer.deserialize(data!)).toThrow();

      await adapter.dispose();
    });
  });
});
