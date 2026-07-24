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
  });

  describe('cancel', () => {
    it('should cancel in-flight mutation', async () => {
      let resolveFn: (value: string) => void;
      const entry = new MutationEntry({
        mutationId: 'mut-cancel',
        mutationFn: async () => {
          return new Promise<string>((resolve) => {
            resolveFn = resolve;
          });
        },
      });

      const promise = entry.mutate({});
      entry.cancel();

      // The mutation was cancelled, so it should reject
      await expect(promise).rejects.toThrow('Mutation cancelled');

      // Resolve to avoid unhandled rejection
      resolveFn!('done');
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
