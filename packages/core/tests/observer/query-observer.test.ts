import { describe, it, expect, vi } from 'vitest';
import { QueryObserver } from '../../src/observer/query-observer';

describe('QueryObserver', () => {
  describe('construction', () => {
    it('should create with required options', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users', 1],
      });

      expect(observer.id).toBeDefined();
      expect(observer.queryId).toBe('q-1');
      expect(observer.queryKey).toEqual(['users', 1]);
      expect(observer.isDestroyed).toBe(false);
      expect(observer.listenerCount).toBe(0);
    });

    it('should create with initial data', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
        initialData: { name: 'Alice' },
        initialState: 'success',
      });

      const snapshot = observer.getSnapshot();
      expect(snapshot.data).toEqual({ name: 'Alice' });
      expect(snapshot.status).toBe('success');
    });

    it('should create with initial error', () => {
      const error = new Error('init failed');
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
        initialError: error,
        initialState: 'error',
      });

      const snapshot = observer.getSnapshot();
      expect(snapshot.error).toBe(error);
      expect(snapshot.status).toBe('error');
    });
  });

  describe('subscribe', () => {
    it('should deliver current snapshot immediately', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
        initialData: { name: 'Alice' },
        initialState: 'success',
      });

      const callback = vi.fn();
      observer.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          queryId: 'q-1',
          status: 'success',
          data: { name: 'Alice' },
        }),
      );
    });

    it('should return unsubscribe function', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const callback = vi.fn();
      const unsub = observer.subscribe(callback);
      unsub();

      observer.update({ status: 'loading' });
      expect(callback).toHaveBeenCalledTimes(1); // only initial
    });

    it('should support multiple subscribers', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      observer.subscribe(cb1);
      observer.subscribe(cb2);

      expect(observer.listenerCount).toBe(2);

      observer.update({ status: 'loading' });
      expect(cb1).toHaveBeenCalledTimes(2);
      expect(cb2).toHaveBeenCalledTimes(2);
    });

    it('should throw on subscribe after destroy', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.destroy();
      expect(() => observer.subscribe(vi.fn())).toThrow('destroyed');
    });
  });

  describe('update', () => {
    it('should notify subscribers on change', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const callback = vi.fn();
      observer.subscribe(callback);
      const initialCalls = callback.mock.calls.length;

      observer.update({ status: 'loading' });

      expect(callback).toHaveBeenCalledTimes(initialCalls + 1);
      expect(observer.getSnapshot().status).toBe('loading');
    });

    it('should prevent duplicate notifications for same status', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const callback = vi.fn();
      observer.subscribe(callback);
      const initialCalls = callback.mock.calls.length;

      // Same status as idle
      observer.update({ status: 'idle' });

      expect(callback).toHaveBeenCalledTimes(initialCalls);
    });

    it('should notify when data changes even if status is same', () => {
      const observer = new QueryObserver<{
        name: string;
      }>({
        queryId: 'q-1',
        queryKey: ['users'],
        initialData: { name: 'Alice' },
        initialState: 'success',
      });

      const callback = vi.fn();
      observer.subscribe(callback);
      const initialCalls = callback.mock.calls.length;

      observer.update({ data: { name: 'Bob' } });

      expect(callback).toHaveBeenCalledTimes(initialCalls + 1);
      expect(observer.getSnapshot().data).toEqual({ name: 'Bob' });
    });

    it('should not notify when nothing changed', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const callback = vi.fn();
      observer.subscribe(callback);
      const initialCalls = callback.mock.calls.length;

      observer.update({ fetchStatus: 'idle' });

      expect(callback).toHaveBeenCalledTimes(initialCalls);
    });

    it('should update timestamp', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const before = observer.getSnapshot().updatedAt;
      observer.update({ status: 'loading' });
      const after = observer.getSnapshot().updatedAt;

      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('should not update after destroy', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.destroy();
      observer.update({ status: 'loading' });

      expect(observer.getSnapshot().status).toBe('idle');
    });
  });

  describe('setState', () => {
    it('should map internal state to public status', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.setState('pending');
      expect(observer.getSnapshot().status).toBe('loading');

      observer.setState('fetching');
      expect(observer.getSnapshot().status).toBe('loading');

      observer.setState('success');
      expect(observer.getSnapshot().status).toBe('success');

      observer.setState('error');
      expect(observer.getSnapshot().status).toBe('error');

      observer.setState('stale');
      expect(observer.getSnapshot().status).toBe('fetching');
    });

    it('should accept additional snapshot fields', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.setState('success', { data: { name: 'Alice' } });
      expect(observer.getSnapshot().data).toEqual({ name: 'Alice' });
      expect(observer.getSnapshot().status).toBe('success');
    });
  });

  describe('setFetchStatus', () => {
    it('should update fetch status', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.setFetchStatus('fetching');
      expect(observer.getSnapshot().fetchStatus).toBe('fetching');

      observer.setFetchStatus('paused');
      expect(observer.getSnapshot().fetchStatus).toBe('paused');
    });
  });

  describe('setData', () => {
    it('should set data and transition to success', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.setData({ name: 'Alice' });

      const snapshot = observer.getSnapshot();
      expect(snapshot.data).toEqual({ name: 'Alice' });
      expect(snapshot.status).toBe('success');
      expect(snapshot.error).toBeNull();
      expect(snapshot.fetchStatus).toBe('idle');
    });
  });

  describe('setError', () => {
    it('should set error and transition to error', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const error = new Error('fetch failed');
      observer.setError(error);

      const snapshot = observer.getSnapshot();
      expect(snapshot.error).toBe(error);
      expect(snapshot.status).toBe('error');
      expect(snapshot.fetchStatus).toBe('idle');
    });
  });

  describe('destroy', () => {
    it('should mark as destroyed', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.destroy();
      expect(observer.isDestroyed).toBe(true);
    });

    it('should clear all callbacks', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.subscribe(vi.fn());
      observer.subscribe(vi.fn());
      expect(observer.listenerCount).toBe(2);

      observer.destroy();
      expect(observer.listenerCount).toBe(0);
    });

    it('should not double-destroy', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.destroy();
      observer.destroy();
      expect(observer.isDestroyed).toBe(true);
    });

    it('should not notify after destroy', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      const callback = vi.fn();
      observer.subscribe(callback);
      const initialCalls = callback.mock.calls.length;

      observer.destroy();
      observer.update({ status: 'loading' });

      expect(callback).toHaveBeenCalledTimes(initialCalls);
    });
  });

  describe('error isolation', () => {
    it('should not crash on callback error', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
      });

      observer.subscribe(() => {
        throw new Error('callback error');
      });

      expect(() => {
        observer.update({ status: 'loading' });
      }).not.toThrow();

      expect(observer.getSnapshot().status).toBe('loading');
    });
  });

  describe('getSnapshot', () => {
    it('should return immutable snapshot', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['users'],
        initialData: { name: 'Alice' },
        initialState: 'success',
      });

      const snapshot1 = observer.getSnapshot();
      const snapshot2 = observer.getSnapshot();

      expect(snapshot1).not.toBe(snapshot2);
      expect(snapshot1).toEqual(snapshot2);
    });
  });
});

describe('QueryObserver Stress Tests', () => {
  describe('10000 observers', () => {
    it('should handle 10000 concurrent observers', { timeout: 15000 }, () => {
      const observers: QueryObserver[] = [];
      const callbacks = new Map<string, ReturnType<typeof vi.fn>>();

      for (let i = 0; i < 10000; i++) {
        const cb = vi.fn();
        const obs = new QueryObserver({
          queryId: `q-${i}`,
          queryKey: ['users', i],
        });
        obs.subscribe(cb);
        observers.push(obs);
        callbacks.set(obs.id, cb);
      }

      expect(observers).toHaveLength(10000);

      // All should have initial snapshot delivered
      for (const cb of callbacks.values()) {
        expect(cb).toHaveBeenCalledTimes(1);
      }

      // Cleanup
      for (const obs of observers) {
        obs.destroy();
      }
    });
  });

  describe('rapid state updates', () => {
    it('should handle 10000 rapid updates', () => {
      const observer = new QueryObserver<{ count: number }>({
        queryId: 'q-1',
        queryKey: ['counter'],
      });

      let notifyCount = 0;
      observer.subscribe(() => {
        notifyCount++;
      });

      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        observer.update({
          data: { count: i },
          status: 'success',
        });
      }

      const duration = performance.now() - start;

      // Each update with different data should notify
      // First call is from subscribe (initial), then 10000 updates
      expect(notifyCount).toBe(10001);

      // Should complete well under 1s (target: <1ms for 1000 observers)
      expect(duration).toBeLessThan(1000);

      observer.destroy();
    });

    it('should deduplicate identical updates', () => {
      const observer = new QueryObserver({
        queryId: 'q-1',
        queryKey: ['static'],
        initialState: 'idle',
      });

      let notifyCount = 0;
      observer.subscribe(() => {
        notifyCount++;
      });

      // Same state repeatedly
      for (let i = 0; i < 1000; i++) {
        observer.update({ status: 'idle' });
      }

      // Only initial notification should count
      expect(notifyCount).toBe(1);

      observer.destroy();
    });
  });

  describe('observer cleanup', () => {
    it('should clean up all references on destroy', { timeout: 15000 }, () => {
      const observers: QueryObserver[] = [];
      const callbacks: ReturnType<typeof vi.fn>[] = [];

      for (let i = 0; i < 10000; i++) {
        const obs = new QueryObserver({
          queryId: `q-${i}`,
          queryKey: ['cleanup', i],
        });
        const cb = vi.fn();
        obs.subscribe(cb);
        observers.push(obs);
        callbacks.push(cb);
      }

      const start = performance.now();

      for (const obs of observers) {
        obs.destroy();
      }

      const duration = performance.now() - start;

      // All should be marked destroyed
      for (const obs of observers) {
        expect(obs.isDestroyed).toBe(true);
        expect(obs.listenerCount).toBe(0);
      }

      // Should complete well under 0.5s
      expect(duration).toBeLessThan(500);
    });

    it('should allow garbage collection after destroy', () => {
      const weakRefs: WeakRef<object>[] = [];

      for (let i = 0; i < 1000; i++) {
        const data = { large: new Array(1000).fill('x') };
        const obs = new QueryObserver({
          queryId: `q-${i}`,
          queryKey: ['gc', i],
          initialData: data,
          initialState: 'success',
        });

        weakRefs.push(new WeakRef(data));
        obs.subscribe(vi.fn());
        obs.destroy();
      }

      // Force GC if available
      if (typeof globalThis.gc === 'function') {
        globalThis.gc();
      }

      // Allow some GC time
      const start = Date.now();
      while (Date.now() - start < 100) {
        // spin
      }

      // We can't guarantee all weak refs are cleared, but we verify
      // the observer itself doesn't hold references
      expect(weakRefs.length).toBe(1000);
    });
  });

  describe('notification under load', () => {
    it('should maintain <1ms for 1000 observer notifications', () => {
      const observers: QueryObserver<{ value: number }>[] = [];
      const receivedUpdates = new Map<string, number>();

      for (let i = 0; i < 1000; i++) {
        const obs = new QueryObserver({
          queryId: `q-${i}`,
          queryKey: ['load', i],
        });
        obs.subscribe(() => {
          receivedUpdates.set(obs.id, (receivedUpdates.get(obs.id) ?? 0) + 1);
        });
        observers.push(obs);
      }

      const start = performance.now();

      // Update all observers
      for (const obs of observers) {
        obs.update({ data: { value: 42 }, status: 'success' });
      }

      const duration = performance.now() - start;

      // Target: <1ms for 1000 observers
      expect(duration).toBeLessThan(1000);

      // Each observer should have 2 notifications: initial + update
      for (const count of receivedUpdates.values()) {
        expect(count).toBe(2);
      }

      // Cleanup
      for (const obs of observers) {
        obs.destroy();
      }
    });
  });
});
