import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObserverManager } from '../../src/observer/observer-manager';

describe('Batched observer notifications must be delivered', () => {
  let manager: ObserverManager;

  beforeEach(() => {
    manager = new ObserverManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  it('should deliver batched notifications when batchInterval > 0', async () => {
    vi.useFakeTimers();
    const batchManager = new ObserverManager({ batchInterval: 50 });
    const callback = vi.fn();

    const observer = batchManager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    observer.subscribe(callback);

    batchManager.notify(batchManager.hashKey(['users']), {
      data: { name: 'Alice' },
    });

    // Not yet flushed — only initial delivery
    expect(callback).toHaveBeenCalledTimes(1);

    // Advance past batch interval
    vi.advanceTimersByTime(60);

    // Should have been called again with the update
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1][0].data).toEqual({ name: 'Alice' });

    batchManager.destroy();
    vi.useRealTimers();
  });

  it('should deliver batched notifications via manual flush()', () => {
    vi.useFakeTimers();
    const batchManager = new ObserverManager({ batchInterval: 50 });
    const callback = vi.fn();

    const observer = batchManager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    observer.subscribe(callback);

    batchManager.notify(batchManager.hashKey(['users']), {
      data: { name: 'Alice' },
    });

    expect(callback).toHaveBeenCalledTimes(1);

    // Manually flush
    batchManager.flush();

    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback.mock.calls[1][0].data).toEqual({ name: 'Alice' });

    batchManager.destroy();
    vi.useRealTimers();
  });

  it('should deliver to multiple observers in the same batch', async () => {
    vi.useFakeTimers();
    const batchManager = new ObserverManager({ batchInterval: 50 });
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    const obs1 = batchManager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    const obs2 = batchManager.createObserver<{ name: string }>({
      queryId: 'q-2',
      queryKey: ['users'],
    });
    obs1.subscribe(cb1);
    obs2.subscribe(cb2);

    batchManager.notify(batchManager.hashKey(['users']), {
      data: { name: 'Alice' },
    });

    vi.advanceTimersByTime(60);

    // Both observers should have received the notification
    expect(cb1).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenCalledTimes(2);

    batchManager.destroy();
    vi.useRealTimers();
  });

  it('should not produce duplicate notifications for same data reference', () => {
    const callback = vi.fn();
    const observer = manager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    observer.subscribe(callback);

    const sameData = { name: 'Alice' };

    // Notify twice with the exact same object reference — second should be deduped
    manager.notifyImmediate(manager.hashKey(['users']), { data: sameData });
    manager.notifyImmediate(manager.hashKey(['users']), { data: sameData });

    // Initial + 1 notification (second is deduped because data reference is same)
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should notify for different data references even with same content', () => {
    const callback = vi.fn();
    const observer = manager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    observer.subscribe(callback);

    // Two different objects with same content — both trigger notification
    manager.notifyImmediate(manager.hashKey(['users']), { data: { name: 'Alice' } });
    manager.notifyImmediate(manager.hashKey(['users']), { data: { name: 'Alice' } });

    // Initial + 2 notifications (different references = not equal)
    expect(callback).toHaveBeenCalledTimes(3);
  });

  it('should safely handle empty flush', () => {
    // Flush with no pending keys should not throw
    expect(() => manager.flush()).not.toThrow();
    expect(manager.getMetrics().totalFlushes).toBe(1);
  });

  it('should safely handle flushPending via timer with no pending keys', async () => {
    vi.useFakeTimers();
    const batchManager = new ObserverManager({ batchInterval: 50 });

    // Manually trigger scheduleFlush without adding any pending keys
    // This shouldn't happen in practice, but tests resilience
    expect(() => batchManager.flush()).not.toThrow();

    batchManager.destroy();
    vi.useRealTimers();
  });

  it('should handle multiple state changes in one batch cycle', async () => {
    vi.useFakeTimers();
    const batchManager = new ObserverManager({ batchInterval: 50 });
    const callback = vi.fn();

    const observer = batchManager.createObserver<{ name: string; age: number }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    observer.subscribe(callback);

    // Queue multiple notifications before flush
    batchManager.notify(batchManager.hashKey(['users']), { data: { name: 'Alice', age: 30 } });
    batchManager.notify(batchManager.hashKey(['users']), { data: { name: 'Bob', age: 25 } });

    // Only initial delivery so far
    expect(callback).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60);

    // Should have received the final state after flush
    expect(callback).toHaveBeenCalledTimes(2);
    // The last notify wins because pendingKeys is a Set (deduped)
    // but observer.update({}) is called once with the last update
    // Actually, notify() with same keyHash just adds to pendingKeys (Set dedup)
    // So only one update({}) call happens in flush
    expect(callback.mock.calls[1][0].data).toEqual({ name: 'Bob', age: 25 });

    batchManager.destroy();
    vi.useRealTimers();
  });

  it('observer can unsubscribe during notification without corrupting state', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    const obs1 = manager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    const obs2 = manager.createObserver<{ name: string }>({
      queryId: 'q-2',
      queryKey: ['users'],
    });

    let unsub1 = () => {};
    unsub1 = obs1.subscribe((snap) => {
      callback1(snap);
      // Unsubscribe during notification — future notifications should not reach this callback
      unsub1();
    });
    obs2.subscribe(callback2);

    // Both initially receive snapshot
    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);

    // Notify — obs1 receives it and unsubscribes, obs2 also gets it
    manager.notifyImmediate(manager.hashKey(['users']), { data: { name: 'Alice' } });

    // obs1 WAS called during this notification (unsubscribe happens after invocation)
    expect(callback1).toHaveBeenCalledTimes(2);
    expect(callback2).toHaveBeenCalledTimes(2);

    // Second notify — obs1 should NOT be called (already unsubscribed)
    manager.notifyImmediate(manager.hashKey(['users']), { data: { name: 'Bob' } });

    expect(callback1).toHaveBeenCalledTimes(2); // no third call
    expect(callback2).toHaveBeenCalledTimes(3); // received update
  });

  it('observer error does not prevent other observers from being notified', () => {
    const callbackError = vi.fn(() => {
      throw new Error('observer error');
    });
    const callbackOk = vi.fn();

    const obs1 = manager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    const obs2 = manager.createObserver<{ name: string }>({
      queryId: 'q-2',
      queryKey: ['users'],
    });

    obs1.subscribe(callbackError);
    obs2.subscribe(callbackOk);

    // Both get initial snapshot
    expect(callbackError).toHaveBeenCalledTimes(1);
    expect(callbackOk).toHaveBeenCalledTimes(1);

    // Notify — obs1 throws, but obs2 should still be notified
    manager.notifyImmediate(manager.hashKey(['users']), { data: { name: 'Alice' } });

    expect(callbackError).toHaveBeenCalledTimes(2);
    expect(callbackOk).toHaveBeenCalledTimes(2);
  });

  it('destroyed observer is skipped during flush', async () => {
    vi.useFakeTimers();
    const batchManager = new ObserverManager({ batchInterval: 50 });
    const callback = vi.fn();

    const observer = batchManager.createObserver<{ name: string }>({
      queryId: 'q-1',
      queryKey: ['users'],
    });
    observer.subscribe(callback);

    batchManager.notify(batchManager.hashKey(['users']), {
      data: { name: 'Alice' },
    });

    // Destroy observer before flush
    observer.destroy();

    vi.advanceTimersByTime(60);

    // Should only have the initial delivery, not the batched one
    expect(callback).toHaveBeenCalledTimes(1);

    batchManager.destroy();
    vi.useRealTimers();
  });
});
