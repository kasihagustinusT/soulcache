import { describe, it, expect, vi } from 'vitest';
import { SubscriptionManager } from '../../src/subscription/subscription-manager';

describe('SubscriptionManager', () => {
  describe('construction', () => {
    it('should create with no options', () => {
      const manager = new SubscriptionManager();
      expect(manager.version).toBe(0);
      expect(manager.listenerCount).toBe(0);
      expect(manager.isDestroyed).toBe(false);
    });

    it('should create with initial value', () => {
      const manager = new SubscriptionManager({ initialValue: 42 });
      expect(manager.getSnapshot()).toBe(42);
    });
  });

  describe('subscribe', () => {
    it('should register and notify listener', () => {
      const manager = new SubscriptionManager();
      const listener = vi.fn();

      manager.subscribe(listener);
      manager.notify();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', () => {
      const manager = new SubscriptionManager();
      const listener = vi.fn();

      const unsubscribe = manager.subscribe(listener);
      unsubscribe();
      manager.notify();

      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('should support multiple listeners', () => {
      const manager = new SubscriptionManager();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);
      manager.notify();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(manager.listenerCount).toBe(2);
    });
  });

  describe('getSnapshot', () => {
    it('should return current value', () => {
      const manager = new SubscriptionManager({ initialValue: 'hello' });
      expect(manager.getSnapshot()).toBe('hello');
    });

    it('should use custom getSnapshot function', () => {
      let value = 0;
      const manager = new SubscriptionManager({
        getSnapshot: () => value,
      });

      expect(manager.getSnapshot()).toBe(0);
      value = 10;
      expect(manager.getSnapshot()).toBe(10);
    });
  });

  describe('setSnapshot', () => {
    it('should update snapshot value', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      manager.setSnapshot(5);
      expect(manager.getSnapshot()).toBe(5);
    });

    it('should increment version', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      manager.setSnapshot(1);
      expect(manager.version).toBe(1);

      manager.setSnapshot(2);
      expect(manager.version).toBe(2);
    });

    it('should not notify listeners', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });
      const listener = vi.fn();

      manager.subscribe(listener);
      manager.setSnapshot(5);

      expect(listener).toHaveBeenCalledTimes(0);
    });
  });

  describe('update', () => {
    it('should update using updater function', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      manager.update((prev) => prev + 1);
      expect(manager.getSnapshot()).toBe(1);
    });

    it('should return true when value changes', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      const changed = manager.update(() => 1);
      expect(changed).toBe(true);
    });

    it('should return false when value unchanged (default Object.is)', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      const changed = manager.update(() => 0);
      expect(changed).toBe(false);
      expect(manager.version).toBe(0);
    });

    it('should use custom equality function', () => {
      const manager = new SubscriptionManager({
        initialValue: { name: 'Alice' },
        equalityFn: (a, b) => a.name === b.name,
      });

      // Same name, different object
      const changed = manager.update(() => ({ name: 'Alice' }));
      expect(changed).toBe(false);

      // Different name
      const changed2 = manager.update(() => ({ name: 'Bob' }));
      expect(changed2).toBe(true);
    });
  });

  describe('notify', () => {
    it('should notify all listeners', () => {
      const manager = new SubscriptionManager();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);
      manager.notify();

      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });

    it('should update snapshot via getSnapshot parameter', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      manager.notify(() => 42);
      expect(manager.getSnapshot()).toBe(42);
    });

    it('should not notify if snapshot unchanged', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });
      const listener = vi.fn();

      manager.subscribe(listener);
      manager.notify(() => 0); // same value

      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('should handle listener errors gracefully', () => {
      const manager = new SubscriptionManager();
      const errorListener = vi.fn(() => {
        throw new Error('listener error');
      });
      const goodListener = vi.fn();

      manager.subscribe(errorListener);
      manager.subscribe(goodListener);

      // Should not throw
      manager.notify();

      expect(errorListener).toHaveBeenCalledTimes(1);
      expect(goodListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('destroy', () => {
    it('should mark as destroyed', () => {
      const manager = new SubscriptionManager();
      manager.destroy();
      expect(manager.isDestroyed).toBe(true);
    });

    it('should prevent subscriptions after destroy', () => {
      const manager = new SubscriptionManager();
      manager.destroy();

      const listener = vi.fn();
      manager.subscribe(listener);

      manager.notify();
      expect(listener).toHaveBeenCalledTimes(0);
    });

    it('should be safe to call multiple times', () => {
      const manager = new SubscriptionManager();
      manager.destroy();
      manager.destroy();
      expect(manager.isDestroyed).toBe(true);
    });
  });

  describe('useSyncExternalStore compatibility', () => {
    it('should work with subscribe pattern', () => {
      const manager = new SubscriptionManager<number>({ initialValue: 0 });

      // Simulate useSyncExternalStore(subscribe, getSnapshot)
      const subscribe = (callback: () => void) => manager.subscribe(callback);
      const getSnapshot = () => manager.getSnapshot();

      expect(getSnapshot()).toBe(0);

      // Subscribe (like React does)
      const unsub = subscribe(() => {});
      expect(manager.listenerCount).toBe(1);

      // Runtime updates
      manager.notify(() => 1);
      expect(getSnapshot()).toBe(1);

      // Cleanup
      unsub();
      expect(manager.listenerCount).toBe(0);
    });
  });
});
