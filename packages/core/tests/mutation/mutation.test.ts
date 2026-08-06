import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MutationEntry } from '../../src/mutation/mutation-entry';
import { MutationCache } from '../../src/mutation/mutation-cache';
import { MutationObserver } from '../../src/mutation/mutation-observer';

describe('MutationEntry', () => {
  describe('construction', () => {
    it('should create with required options', () => {
      const entry = new MutationEntry({
        mutationId: 'mut-1',
        mutationFn: async () => 'result',
      });

      expect(entry.id).toBe('mut-1');
      expect(entry.status).toBe('idle');
      expect(entry.data).toBeUndefined();
      expect(entry.error).toBeNull();
      expect(entry.isPending).toBe(false);
      expect(entry.isSuccess).toBe(false);
      expect(entry.isError).toBe(false);
      expect(entry.isDestroyed).toBe(false);
    });

    it('should create with initial variables', () => {
      const entry = new MutationEntry({
        mutationId: 'mut-2',
        mutationFn: async () => 'result',
        variables: { name: 'Alice' },
      });

      expect(entry.variables).toEqual({ name: 'Alice' });
    });
  });

  describe('mutate', () => {
    it('should execute mutation and return data', async () => {
      const entry = new MutationEntry<string, { name: string }>({
        mutationId: 'mut-1',
        mutationFn: async (vars) => `Hello ${vars.name}`,
      });

      const result = await entry.mutate({ name: 'World' });

      expect(result).toBe('Hello World');
      expect(entry.status).toBe('success');
      expect(entry.data).toBe('Hello World');
    });

    it('should handle mutation failure', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-2',
        mutationFn: async () => {
          throw new Error('Network error');
        },
      });

      await expect(entry.mutate({})).rejects.toThrow('Network error');
      expect(entry.status).toBe('error');
      expect(entry.error?.message).toBe('Network error');
    });

    it('should notify listeners on state change', async () => {
      const listener = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-3',
        mutationFn: async () => 'done',
      });

      entry.subscribe(listener);
      await entry.mutate({});

      expect(listener).toHaveBeenCalledTimes(2); // pending + success
    });

    it('should execute onMutate callback', async () => {
      const onMutate = vi.fn().mockReturnValue({ optimistic: true });
      const entry = new MutationEntry({
        mutationId: 'mut-4',
        mutationFn: async () => 'done',
        onMutate,
      });

      await entry.mutate({ name: 'test' });

      expect(onMutate).toHaveBeenCalledWith({ name: 'test' });
      expect(entry.context).toEqual({ optimistic: true });
    });

    it('should execute onSuccess callback', async () => {
      const onSuccess = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-5',
        mutationFn: async () => 'success',
        onSuccess,
      });

      await entry.mutate({});

      expect(onSuccess).toHaveBeenCalledWith('success', {});
    });

    it('should execute onError callback', async () => {
      const onError = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-6',
        mutationFn: async () => {
          throw new Error('fail');
        },
        onError,
      });

      await expect(entry.mutate({})).rejects.toThrow();

      expect(onError).toHaveBeenCalled();
      const [error] = onError.mock.calls[0];
      expect(error.message).toBe('fail');
    });

    it('should execute onSettled callback on success', async () => {
      const onSettled = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-7',
        mutationFn: async () => 'data',
        onSettled,
      });

      await entry.mutate({});

      expect(onSettled).toHaveBeenCalledWith('data', null, {});
    });

    it('should execute onSettled callback on error', async () => {
      const onSettled = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-8',
        mutationFn: async () => {
          throw new Error('err');
        },
        onSettled,
      });

      await expect(entry.mutate({})).rejects.toThrow();

      expect(onSettled).toHaveBeenCalled();
      const [, error] = onSettled.mock.calls[0];
      expect(error.message).toBe('err');
    });

    it('should not corrupt successful mutation state when onSuccess throws (BUG-1)', async () => {
      const onError = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-success',
        mutationFn: async () => 'data',
        onSuccess: () => {
          throw new Error('callback boom');
        },
        onError,
      });

      // A throwing success callback must NOT turn a success into a rejection
      await expect(entry.mutate({})).resolves.toBe('data');
      expect(entry.status).toBe('success');
      expect(entry.data).toBe('data');
      expect(entry.error).toBeNull();
      expect(onError).not.toHaveBeenCalled();
    });

    it('should still run onSettled after onSuccess throws (BUG-1)', async () => {
      const onSettled = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-settled-success',
        mutationFn: async () => 'data',
        onSuccess: () => {
          throw new Error('callback boom');
        },
        onSettled,
      });

      await entry.mutate({});

      expect(onSettled).toHaveBeenCalledTimes(1);
      expect(onSettled).toHaveBeenCalledWith('data', null, {});
    });

    it('should commit success state before onSuccess runs (BUG-1)', async () => {
      let observedStatus: string | undefined;
      let observedData: unknown;
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-commit',
        mutationFn: async () => 'data',
        onSuccess: (data) => {
          observedStatus = entry.status;
          observedData = data;
        },
      });

      await entry.mutate({});

      expect(observedStatus).toBe('success');
      expect(observedData).toBe('data');
    });

    it('should not replace the original error when onError throws (BUG-1)', async () => {
      const onSettled = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-error',
        mutationFn: async () => {
          throw new Error('boom');
        },
        onError: () => {
          throw new Error('callback boom');
        },
        onSettled,
      });

      // The ORIGINAL mutation error must propagate, not the callback error
      let thrown: unknown;
      try {
        await entry.mutate({});
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toBe('boom');
      expect(entry.status).toBe('error');
      expect(entry.error?.message).toBe('boom');
    });

    it('should still run onSettled after onError throws (BUG-1)', async () => {
      const onSettled = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-settled-error',
        mutationFn: async () => {
          throw new Error('boom');
        },
        onError: () => {
          throw new Error('callback boom');
        },
        onSettled,
      });

      await expect(entry.mutate({})).rejects.toThrow('boom');

      expect(onSettled).toHaveBeenCalledTimes(1);
      const [, error] = onSettled.mock.calls[0];
      expect(error.message).toBe('boom');
    });

    it('should not corrupt successful state when onSettled throws (BUG-1)', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-onSettled',
        mutationFn: async () => 'data',
        onSettled: () => {
          throw new Error('callback boom');
        },
      });

      await expect(entry.mutate({})).resolves.toBe('data');
      expect(entry.status).toBe('success');
      expect(entry.error).toBeNull();
    });

    it('should still mark mutation error when onMutate throws (BUG-1 preserved)', async () => {
      const onError = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-onMutate',
        mutationFn: async () => 'data',
        onMutate: () => {
          throw new Error('optimistic boom');
        },
        onError,
      });

      await expect(entry.mutate({})).rejects.toThrow('optimistic boom');
      expect(entry.status).toBe('error');
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('mutateWithRetry', () => {
    it('should retry on failure', async () => {
      let attempts = 0;
      const entry = new MutationEntry({
        mutationId: 'mut-retry',
        mutationFn: async () => {
          attempts++;
          if (attempts < 3) throw new Error(`attempt ${attempts}`);
          return 'success';
        },
      });

      const result = await entry.mutateWithRetry({}, 3, 10);
      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    it('should throw after max retries', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-max-retry',
        mutationFn: async () => {
          throw new Error('always fail');
        },
      });

      await expect(entry.mutateWithRetry({}, 2, 10)).rejects.toThrow('always fail');
    });

    it('should NOT retry a successful mutation when a callback throws (BUG-1)', async () => {
      let attempts = 0;
      const entry = new MutationEntry({
        mutationId: 'mut-bug1-no-retry',
        mutationFn: async () => {
          attempts++;
          return 'success';
        },
        onSuccess: () => {
          throw new Error('callback boom');
        },
      });

      // Callback errors are not mutation failures: no retry, no duplicate write
      await expect(entry.mutateWithRetry({}, 3, 10)).resolves.toBe('success');
      expect(attempts).toBe(1);
      expect(entry.status).toBe('success');
      expect(entry.isError).toBe(false);
    });
  });

  describe('cancel', () => {
    it('should cancel in-flight mutation and set error status', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-cancel',
        mutationFn: async () => {
          return new Promise<string>(() => {});
        },
      });

      const promise = entry.mutate({});
      entry.cancel();

      // The mutation was cancelled, so it should reject
      await expect(promise).rejects.toThrow('Mutation cancelled');

      // Entry state should reflect cancellation
      expect(entry.status).toBe('error');
      expect(entry.isError).toBe(true);
      expect(entry.error?.message).toBe('Mutation cancelled');
    });

    it('should notify listeners when mutation is cancelled', async () => {
      const listener = vi.fn();
      const entry = new MutationEntry({
        mutationId: 'mut-cancel-notify',
        mutationFn: async () => {
          return new Promise<string>(() => {});
        },
      });

      entry.subscribe(listener);
      const promise = entry.mutate({});
      entry.cancel();

      await expect(promise).rejects.toThrow('Mutation cancelled');

      // listener called for pending + error
      expect(listener).toHaveBeenCalledTimes(2);
      expect(entry.status).toBe('error');
    });

    it('should be no-op when no in-flight mutation', () => {
      const entry = new MutationEntry({
        mutationId: 'mut-cancel-noop',
        mutationFn: async () => 'data',
      });

      entry.cancel();

      expect(entry.status).toBe('idle');
      expect(entry.error).toBeNull();
    });
  });

  describe('reset', () => {
    it('should reset state to idle', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-reset',
        mutationFn: async () => 'data',
      });

      await entry.mutate({});
      expect(entry.status).toBe('success');

      entry.reset();
      expect(entry.status).toBe('idle');
      expect(entry.data).toBeUndefined();
      expect(entry.error).toBeNull();
    });
  });

  describe('getSnapshot', () => {
    it('should return current state', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-snap',
        mutationFn: async () => 'data',
      });

      const snapshot = entry.getSnapshot();
      expect(snapshot.status).toBe('idle');
      expect(snapshot.isPending).toBe(false);

      await entry.mutate({});

      const snapshot2 = entry.getSnapshot();
      expect(snapshot2.status).toBe('success');
      expect(snapshot2.isSuccess).toBe(true);
    });
  });

  describe('destroy', () => {
    it('should mark as destroyed', () => {
      const entry = new MutationEntry({
        mutationId: 'mut-destroy',
        mutationFn: async () => 'data',
      });

      entry.destroy();
      expect(entry.isDestroyed).toBe(true);
    });

    it('should prevent mutations after destroy', async () => {
      const entry = new MutationEntry({
        mutationId: 'mut-destroy2',
        mutationFn: async () => 'data',
      });

      entry.destroy();
      await expect(entry.mutate({})).rejects.toThrow('destroyed');
    });
  });
});

describe('MutationCache', () => {
  let cache: MutationCache;

  beforeEach(() => {
    cache = new MutationCache({ maxSize: 10 });
  });

  describe('create', () => {
    it('should create a mutation entry', () => {
      const entry = cache.create({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });

      expect(entry.id).toBe('mut-1');
      expect(cache.size).toBe(1);
    });

    it('should enforce max size', () => {
      for (let i = 0; i < 15; i++) {
        cache.create({
          mutationId: `mut-${i}`,
          mutationFn: async () => `data-${i}`,
        });
      }

      expect(cache.size).toBeLessThanOrEqual(10);
    });
  });

  describe('get', () => {
    it('should retrieve mutation by ID', () => {
      cache.create({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });

      const entry = cache.get('mut-1');
      expect(entry).toBeDefined();
      expect(entry?.id).toBe('mut-1');
    });

    it('should return undefined for non-existent ID', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should find mutations by status', async () => {
      const entry1 = cache.create({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });
      const entry2 = cache.create({
        mutationId: 'mut-2',
        mutationFn: async () => 'data',
      });

      await entry1.mutate({});

      const pending = cache.findAll({ status: 'pending' });
      expect(pending).toHaveLength(0);

      const success = cache.findAll({ status: 'success' });
      expect(success).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('should remove mutation by ID', () => {
      cache.create({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });

      expect(cache.remove('mut-1')).toBe(true);
      expect(cache.size).toBe(0);
    });

    it('should return false for non-existent ID', () => {
      expect(cache.remove('nonexistent')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all mutations', () => {
      cache.create({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });
      cache.create({
        mutationId: 'mut-2',
        mutationFn: async () => 'data',
      });

      cache.clear();
      expect(cache.size).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should notify on cache changes', () => {
      const listener = vi.fn();
      cache.subscribe(listener);

      cache.create({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });

      expect(listener).toHaveBeenCalled();
    });
  });
});

describe('MutationObserver', () => {
  describe('construction', () => {
    it('should create with required options', () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
      });

      expect(observer.id).toBeDefined();
      expect(observer.mutationId).toBe('mut-1');
      expect(observer.isDestroyed).toBe(false);
      expect(observer.listenerCount).toBe(0);
    });
  });

  describe('subscribe', () => {
    it('should deliver initial snapshot', () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
      });

      const callback = vi.fn();
      observer.subscribe(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          mutationId: 'mut-1',
          status: 'idle',
        }),
      );
    });
  });

  describe('bind', () => {
    it('should sync state from mutation', async () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
        initialState: 'pending', // Start with different state to see sync
      });

      const entry = new MutationEntry({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });

      const callback = vi.fn();
      observer.subscribe(callback);
      // callback called once with initial snapshot

      observer.bind(entry);
      // bind syncs mutation's idle state over observer's pending - state changes, so notification fires
      expect(callback).toHaveBeenCalledTimes(2);

      await entry.mutate({});
      // pending + success notifications
      expect(callback).toHaveBeenCalledTimes(4);
    });
  });

  describe('update', () => {
    it('should update snapshot', () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
      });

      const callback = vi.fn();
      observer.subscribe(callback);

      observer.update({ status: 'success', data: 'result' });

      expect(callback).toHaveBeenCalledTimes(2);
      const snapshot = callback.mock.calls[1][0];
      expect(snapshot.status).toBe('success');
      expect(snapshot.data).toBe('result');
    });

    it('should prevent duplicate notifications', () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
      });

      const callback = vi.fn();
      observer.subscribe(callback);

      observer.update({ status: 'idle' }); // same as initial
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSnapshot', () => {
    it('should return immutable snapshot', () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
      });

      const snap1 = observer.getSnapshot();
      const snap2 = observer.getSnapshot();

      expect(snap1).toEqual(snap2);
      expect(snap1).not.toBe(snap2); // different references
    });
  });

  describe('destroy', () => {
    it('should mark as destroyed', () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
      });

      observer.destroy();
      expect(observer.isDestroyed).toBe(true);
    });

    it('should unsubscribe from mutation', async () => {
      const observer = new MutationObserver({
        mutationId: 'mut-1',
        initialState: 'pending', // start different from mutation's idle
      });

      const entry = new MutationEntry({
        mutationId: 'mut-1',
        mutationFn: async () => 'data',
      });

      observer.bind(entry);

      const callback = vi.fn();
      observer.subscribe(callback);
      // 1 call: initial snapshot delivered immediately

      observer.destroy();

      await entry.mutate({});
      // After destroy, callback should NOT have been called again
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
