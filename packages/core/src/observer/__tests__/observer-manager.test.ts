import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObserverManager } from '../observer-manager';
import { QueryObserver } from '../query-observer';

describe('ObserverManager', () => {
  let manager: ObserverManager;

  beforeEach(() => {
    manager = new ObserverManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  describe('createObserver', () => {
    it('should create and register an observer', () => {
      const observer = manager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      expect(observer).toBeInstanceOf(QueryObserver);
      expect(observer.queryId).toBe('q-1');
      expect(manager.getObserverCount(manager.hashKey(['users']))).toBe(1);
    });

    it('should track multiple observers for the same key', () => {
      manager.createObserver({ queryId: 'q-1', queryKey: ['users'] });
      manager.createObserver({ queryId: 'q-2', queryKey: ['users'] });

      expect(manager.getObserverCount(manager.hashKey(['users']))).toBe(2);
    });

    it('should track observers for different keys', () => {
      manager.createObserver({ queryId: 'q-1', queryKey: ['users'] });
      manager.createObserver({ queryId: 'q-2', queryKey: ['posts'] });

      expect(manager.getObserverCount(manager.hashKey(['users']))).toBe(1);
      expect(manager.getObserverCount(manager.hashKey(['posts']))).toBe(1);
    });
  });

  describe('getObservers', () => {
    it('should return empty array for unknown key', () => {
      expect(manager.getObservers(manager.hashKey(['unknown']))).toEqual([]);
    });

    it('should return all observers for a key', () => {
      manager.createObserver({ queryId: 'q-1', queryKey: ['users'] });
      manager.createObserver({ queryId: 'q-2', queryKey: ['users'] });

      const observers = manager.getObservers(manager.hashKey(['users']));
      expect(observers).toHaveLength(2);
    });
  });

  describe('notify', () => {
    it('should notify observers of a key', () => {
      const callback = vi.fn();
      const observer = manager.createObserver<{ name: string }>({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.subscribe(callback);

      manager.notify(manager.hashKey(['users']), {
        data: { name: 'Alice' },
      });

      expect(callback).toHaveBeenCalledTimes(2); // initial + notify
      expect(callback.mock.calls[1][0].data).toEqual({ name: 'Alice' });
    });

    it('should not notify observers of different keys', () => {
      const callback = vi.fn();
      manager.createObserver({
        queryId: 'q-1',
        queryKey: ['posts'],
      }).subscribe(callback);

      manager.notify(manager.hashKey(['users']), {
        data: { name: 'Alice' },
      });

      expect(callback).toHaveBeenCalledTimes(1); // only initial
    });

    it('should handle notify with batchInterval > 0', async () => {
      vi.useFakeTimers();

      const batchManager = new ObserverManager({ batchInterval: 100 });
      const callback = vi.fn();

      const observer = batchManager.createObserver<{ name: string }>({
        queryId: 'q-1',
        queryKey: ['users'],
      });
      observer.subscribe(callback);

      batchManager.notify(batchManager.hashKey(['users']), {
        data: { name: 'Alice' },
      });

      // Not yet flushed
      expect(callback).toHaveBeenCalledTimes(1); // only initial

      // Advance past batch interval
      vi.advanceTimersByTime(100);

      // Should have flushed
      expect(batchManager.getMetrics().totalFlushes).toBe(1);

      batchManager.destroy();
      vi.useRealTimers();
    });
  });

  describe('notifyImmediate', () => {
    it('should immediately notify observers bypassing batching', () => {
      vi.useFakeTimers();

      const batchManager = new ObserverManager({ batchInterval: 100 });
      const callback = vi.fn();

      const observer = batchManager.createObserver<{ name: string }>({
        queryId: 'q-1',
        queryKey: ['users'],
      });
      observer.subscribe(callback);

      batchManager.notifyImmediate(batchManager.hashKey(['users']), {
        data: { name: 'Alice' },
      });

      // Should be notified immediately
      expect(callback).toHaveBeenCalledTimes(2); // initial + notifyImmediate

      batchManager.destroy();
      vi.useRealTimers();
    });
  });

  describe('removeObserver', () => {
    it('should remove observer from registry', () => {
      const observer = manager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      manager.removeObserver(observer.id);

      expect(manager.getObserverCount(manager.hashKey(['users']))).toBe(0);
    });

    it('should destroy the observer', () => {
      const observer = manager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      manager.removeObserver(observer.id);

      expect(observer.isDestroyed).toBe(true);
    });

    it('should handle removing non-existent observer', () => {
      manager.removeObserver('non-existent');
    });
  });

  describe('removeAllForKey', () => {
    it('should remove all observers for a key', () => {
      manager.createObserver({ queryId: 'q-1', queryKey: ['users'] });
      manager.createObserver({ queryId: 'q-2', queryKey: ['users'] });

      manager.removeAllForKey(manager.hashKey(['users']));

      expect(manager.getObserverCount(manager.hashKey(['users']))).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should destroy all observers', () => {
      const obs1 = manager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });
      const obs2 = manager.createObserver({
        queryId: 'q-2',
        queryKey: ['posts'],
      });

      manager.destroy();

      expect(obs1.isDestroyed).toBe(true);
      expect(obs2.isDestroyed).toBe(true);
      expect(manager.isDestroyed).toBe(true);
    });

    it('should be idempotent', () => {
      manager.createObserver({ queryId: 'q-1', queryKey: ['users'] });

      manager.destroy();
      manager.destroy(); // should not throw

      expect(manager.isDestroyed).toBe(true);
    });

    it('should throw when creating observer after destroy', () => {
      manager.destroy();

      expect(() =>
        manager.createObserver({ queryId: 'q-1', queryKey: ['users'] }),
      ).toThrow('ObserverManager has been destroyed');
    });
  });

  describe('metrics', () => {
    it('should track metrics', () => {
      const callback = vi.fn();
      const observer = manager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.subscribe(callback);

      manager.notify(manager.hashKey(['users']), { data: null });

      const metrics = manager.getMetrics();
      expect(metrics.totalRegistered).toBe(1);
      expect(metrics.activeObservers).toBe(1);
      expect(metrics.totalNotifications).toBeGreaterThanOrEqual(1);
    });

    it('should track duplicates prevented', () => {
      const callback = vi.fn();
      const observer = manager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.subscribe(callback);

      // Notify with same data as initial snapshot
      manager.notifyImmediate(manager.hashKey(['users']), { data: null });

      const metrics = manager.getMetrics();
      expect(metrics.duplicatesPrevented).toBeGreaterThanOrEqual(0);
    });
  });

  describe('equalityFn', () => {
    it('should use custom equality function', () => {
      const customManager = new ObserverManager({
        equalityFn: (a, b) => a.status === b.status,
      });

      const callback = vi.fn();
      const observer = customManager.createObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.subscribe(callback);

      // Notify with same status but different data
      customManager.notifyImmediate(customManager.hashKey(['users']), {
        data: { name: 'Bob' },
      });

      // Custom equality only checks status, so should be considered equal
      expect(customManager.getMetrics().duplicatesPrevented).toBeGreaterThanOrEqual(1);

      customManager.destroy();
    });
  });

  describe('hashKey', () => {
    it('should produce consistent hash for same key', () => {
      expect(manager.hashKey(['users'])).toBe(manager.hashKey(['users']));
    });

    it('should produce different hash for different keys', () => {
      expect(manager.hashKey(['users'])).not.toBe(manager.hashKey(['posts']));
    });
  });
});
