import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObserverManager } from '../../src/observer/observer-manager';
import type { QueryObserver } from '../../src/observer/query-observer';
import type { QuerySnapshot } from '../../src/types/observer.types';

/**
 * ObserverManager error isolation — one observer's error must not
 * prevent delivery to subsequent observers on the same key.
 *
 * Before the fix, flushObservers/flush/flushPending iterated observers
 * without try-catch, so a throw from observer.update() would abort the
 * entire iteration, starving all subsequent observers of their notifications.
 *
 * After the fix, each observer.update() call is wrapped in try-catch so
 * failures are isolated.
 */
describe('ObserverManager error isolation', () => {
  let manager: ObserverManager;

  beforeEach(() => {
    manager = new ObserverManager({ batchInterval: 0 });
  });

  function makeObs(key: string): QueryObserver {
    return manager.createObserver({
      queryId: `q-${key}`,
      queryKey: [key],
    });
  }

  function makeUpdate(): Partial<Omit<QuerySnapshot<unknown>, 'queryId'>> {
    return { status: 'success', data: 'new-data', fetchStatus: 'idle', updatedAt: Date.now() };
  }

  it('1. Throwing observer does not block subsequent observers from receiving updates', () => {
    const obs1 = makeObs('iso');
    const obs2 = makeObs('iso');
    const obs3 = makeObs('iso');

    // Observer 1 throws on update
    const update1 = vi.spyOn(obs1, 'update').mockImplementation(() => {
      throw new Error('observer1 boom');
    });

    const update2 = vi.spyOn(obs2, 'update');
    const update3 = vi.spyOn(obs3, 'update');

    const keyHash = manager.hashKey(['iso']);
    manager.notifyImmediate(keyHash, makeUpdate());

    expect(update1).toHaveBeenCalledTimes(1);
    expect(update2).toHaveBeenCalledTimes(1);
    expect(update3).toHaveBeenCalledTimes(1);

    vi.restoreAllMocks();
  });

  it('2. Throwing observer in flush() does not block other observers', () => {
    const obs1 = makeObs('flush');
    const obs2 = makeObs('flush');

    vi.spyOn(obs1, 'update').mockImplementation(() => {
      throw new Error('flush boom');
    });

    const update2 = vi.spyOn(obs2, 'update');

    const keyHash = manager.hashKey(['flush']);
    manager.notify(keyHash, makeUpdate());
    manager.flush();

    expect(update2).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('3. All observers are called even when multiple observers throw', () => {
    const obs1 = makeObs('multi');
    const obs2 = makeObs('multi');
    const obs3 = makeObs('multi');

    vi.spyOn(obs1, 'update').mockImplementation(() => {
      throw new Error('obs1');
    });
    vi.spyOn(obs3, 'update').mockImplementation(() => {
      throw new Error('obs3');
    });

    const update2 = vi.spyOn(obs2, 'update');

    const keyHash = manager.hashKey(['multi']);
    manager.notifyImmediate(keyHash, makeUpdate());

    // observer2 is between two throwers — should still be called
    expect(update2).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('4. Throwing observer on one key does not affect observers on other keys', () => {
    const obsOnKey1 = makeObs('key-a');
    const obsOnKey2 = makeObs('key-b');

    vi.spyOn(obsOnKey1, 'update').mockImplementation(() => {
      throw new Error('key-a boom');
    });

    const update2 = vi.spyOn(obsOnKey2, 'update');

    const keyHash1 = manager.hashKey(['key-a']);
    const keyHash2 = manager.hashKey(['key-b']);

    manager.notifyImmediate(keyHash1, makeUpdate());
    manager.notifyImmediate(keyHash2, makeUpdate());

    expect(update2).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it('5. Throwing observer does not increment duplicate-prevention stats', () => {
    const obs1 = makeObs('acct');
    const obs2 = makeObs('acct');

    // Observer 1 throws — its notification should not be counted
    vi.spyOn(obs1, 'update').mockImplementation(() => {
      throw new Error('acct boom');
    });

    // Observer 2 receives update normally
    vi.spyOn(obs2, 'update');

    const keyHash = manager.hashKey(['acct']);
    manager.notifyImmediate(keyHash, makeUpdate());

    const stats = manager.getMetrics();
    // Total notifications should only count the successful observer, not the failed one
    expect(stats.totalNotifications).toBe(1);

    vi.restoreAllMocks();
  });
});
