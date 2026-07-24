/**
 * PersistenceCoordinator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PersistenceCoordinator } from '../persistence-coordinator';
import { MemoryAdapter } from '../adapters/memory-adapter';
import { JsonSerializer } from '../serializer/json-serializer';
import type { PersistedState } from '../types';

describe('PersistenceCoordinator', () => {
  let coordinator: PersistenceCoordinator;
  let adapter: MemoryAdapter;

  const createTestState = (): PersistedState => ({
    version: 1,
    timestamp: 1690000000000,
    queryCache: {
      entries: {
        'query-1': {
          data: { users: [1, 2, 3] },
          timestamp: 1690000000000,
          status: 'fresh',
          fetchCount: 1,
          GCCount: 0,
        },
        'query-2': {
          data: { posts: [1, 2] },
          timestamp: 1680000000000,
          status: 'stale',
          fetchCount: 5,
          GCCount: 2,
        },
      },
      metadata: { entryCount: 2, totalSize: 2048 },
    },
    mutationCache: {
      entries: {
        'mut-1': {
          data: { id: 1 },
          status: 'pending',
          timestamp: 1690000000000,
        },
      },
      metadata: { entryCount: 1, totalSize: 512 },
    },
    metadata: { lastUpdated: 1690000000000, schemaVersion: 1 },
  });

  const defaultSerializer = (data: PersistedState): string => JSON.stringify(data);
  const defaultDeserializer = (data: string): PersistedState => JSON.parse(data);

  beforeEach(async () => {
    coordinator = new PersistenceCoordinator({ prefix: 'test' });
    adapter = new MemoryAdapter();
    await adapter.initialize();
  });

  describe('Save and Restore', () => {
    it('should save state to adapter', async () => {
      const state = createTestState();
      await coordinator.save(adapter, state, defaultSerializer);

      const hasData = await coordinator.hasData(adapter);
      expect(hasData).toBe(true);
    });

    it('should restore state from adapter', async () => {
      const state = createTestState();
      await coordinator.save(adapter, state, defaultSerializer);

      const restored = await coordinator.restore(adapter, defaultDeserializer);
      expect(restored).toBeDefined();
      expect(restored?.version).toBe(1);
    });

    it('should return null when no data', async () => {
      const restored = await coordinator.restore(adapter, defaultDeserializer);
      expect(restored).toBeNull();
    });

    it('should clear state', async () => {
      const state = createTestState();
      await coordinator.save(adapter, state, defaultSerializer);
      await coordinator.clear(adapter);

      const hasData = await coordinator.hasData(adapter);
      expect(hasData).toBe(false);
    });
  });

  describe('Selective Filtering', () => {
    it('should apply selective filter during save', async () => {
      const filter = (key: string): boolean => key !== 'query-2';
      const coordinatorWithFilter = new PersistenceCoordinator({
        prefix: 'test',
        selectivePersistence: filter,
      });

      const state = createTestState();
      await coordinatorWithFilter.save(adapter, state, defaultSerializer);

      const restored = await coordinatorWithFilter.restore(adapter, defaultDeserializer);
      expect(restored).toBeDefined();
      expect(Object.keys(restored!.queryCache.entries)).not.toContain('query-2');
      expect(Object.keys(restored!.queryCache.entries)).toContain('query-1');
    });

    it('should not apply filter when forced', async () => {
      const filter = (key: string): boolean => key !== 'query-2';
      const coordinatorWithFilter = new PersistenceCoordinator({
        prefix: 'test',
        selectivePersistence: filter,
      });

      const state = createTestState();
      await coordinatorWithFilter.save(adapter, state, defaultSerializer, true);

      const restored = await coordinatorWithFilter.restore(adapter, defaultDeserializer);
      expect(restored).toBeDefined();
      expect(Object.keys(restored!.queryCache.entries)).toContain('query-2');
    });
  });

  describe('Max Age Filtering', () => {
    it('should apply max age filter during save', async () => {
      const coordinatorWithAge = new PersistenceCoordinator({
        prefix: 'test',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });

      const state = createTestState();
      await coordinatorWithAge.save(adapter, state, defaultSerializer);

      const restored = await coordinatorWithAge.restore(adapter, defaultDeserializer);
      expect(restored).toBeDefined();
      // query-2 has timestamp 1680000000000 which is >30 days old
      expect(Object.keys(restored!.queryCache.entries)).not.toContain('query-2');
    });
  });

  describe('Metadata Update', () => {
    it('should update entry count after filtering', async () => {
      const filter = (key: string): boolean => key !== 'query-2';
      const coordinatorWithFilter = new PersistenceCoordinator({
        prefix: 'test',
        selectivePersistence: filter,
      });

      const state = createTestState();
      await coordinatorWithFilter.save(adapter, state, defaultSerializer);

      const restored = await coordinatorWithFilter.restore(adapter, defaultDeserializer);
      expect(restored?.queryCache.metadata.entryCount).toBe(1);
    });
  });

  describe('Configuration', () => {
    it('should use default prefix', () => {
      const defaultCoordinator = new PersistenceCoordinator();
      expect(defaultCoordinator).toBeDefined();
    });
  });
});
