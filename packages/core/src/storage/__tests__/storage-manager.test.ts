/**
 * StorageManager Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageManager } from '../storage-manager';
import { MemoryAdapter } from '../adapters/memory-adapter';
import type { PersistedState, StorageEventData } from '../types';

describe('StorageManager', () => {
  let manager: StorageManager;
  let adapter: MemoryAdapter;

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
      },
      metadata: { entryCount: 1, totalSize: 1024 },
    },
    mutationCache: {
      entries: {},
      metadata: { entryCount: 0, totalSize: 0 },
    },
    metadata: { lastUpdated: Date.now(), schemaVersion: 1 },
  });

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    await adapter.initialize();
    manager = new StorageManager({ adapter, prefix: 'test', version: 1 });
    await manager.initialize();
  });

  describe('Lifecycle', () => {
    it('should be ready after initialization', () => {
      expect(manager.isReady()).toBe(true);
    });

    it('should have correct status', () => {
      expect(manager.getStatus()).toBe('ready');
    });

    it('should dispose gracefully', async () => {
      await manager.dispose();
      expect(manager.isReady()).toBe(false);
    });
  });

  describe('Save', () => {
    it('should save state', async () => {
      const state = createTestState();
      await manager.save(state);

      const metrics = manager.getMetrics();
      expect(metrics.saveCount).toBe(1);
    });

    it('should emit save events', async () => {
      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      manager.on('storage.save.start', startHandler);
      manager.on('storage.save.complete', completeHandler);

      const state = createTestState();
      await manager.save(state);

      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(completeHandler).toHaveBeenCalledTimes(1);

      const eventData = completeHandler.mock.calls[0][0] as StorageEventData;
      expect(eventData.type).toBe('storage.save.complete');
      expect(eventData.duration).toBeGreaterThanOrEqual(0);
    });

    it('should throw when not ready', async () => {
      await manager.dispose();

      const state = createTestState();
      await expect(manager.save(state)).rejects.toThrow();
    });
  });

  describe('Restore', () => {
    it('should restore saved state', async () => {
      const state = createTestState();
      await manager.save(state);

      const restored = await manager.restore();
      expect(restored).toBeDefined();
      expect(restored?.version).toBe(1);
    });

    it('should return null when no data', async () => {
      const restored = await manager.restore();
      expect(restored).toBeNull();
    });

    it('should emit restore events', async () => {
      const state = createTestState();
      await manager.save(state);

      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      manager.on('storage.restore.start', startHandler);
      manager.on('storage.restore.complete', completeHandler);

      await manager.restore();

      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear', () => {
    it('should clear all data', async () => {
      const state = createTestState();
      await manager.save(state);

      await manager.clear();

      const restored = await manager.restore();
      expect(restored).toBeNull();
    });

    it('should emit clear events', async () => {
      const startHandler = vi.fn();
      const completeHandler = vi.fn();
      manager.on('storage.clear.start', startHandler);
      manager.on('storage.clear.complete', completeHandler);

      await manager.clear();

      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(completeHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Events', () => {
    it('should subscribe to events', () => {
      const handler = vi.fn();
      const unsubscribe = manager.on('storage.save.complete', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should unsubscribe from events', async () => {
      const handler = vi.fn();
      const unsubscribe = manager.on('storage.save.complete', handler);

      unsubscribe();

      const state = createTestState();
      await manager.save(state);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('Metrics', () => {
    it('should track save metrics', async () => {
      const state = createTestState();
      await manager.save(state);

      const metrics = manager.getMetrics();
      expect(metrics.saveCount).toBe(1);
      expect(metrics.lastSaveTime).toBeGreaterThan(0);
    });

    it('should track restore metrics', async () => {
      const state = createTestState();
      await manager.save(state);
      await manager.restore();

      const metrics = manager.getMetrics();
      expect(metrics.restoreCount).toBe(1);
      expect(metrics.lastRestoreTime).toBeGreaterThan(0);
    });

    it('should reset metrics', async () => {
      const state = createTestState();
      await manager.save(state);

      manager.resetMetrics();

      const metrics = manager.getMetrics();
      expect(metrics.saveCount).toBe(0);
    });
  });
});
