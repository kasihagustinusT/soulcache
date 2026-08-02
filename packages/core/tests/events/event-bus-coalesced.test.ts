import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../../src/events/event-bus';
import type { RuntimeEvent } from '../../src/types/events.types';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const emit = (
  bus: EventBus,
  type: 'query.created' | 'query.updated' | 'cache.updated',
  value: number,
): void => {
  bus.emit({ type, source: 'query-runtime', payload: { queryId: 'q', queryKey: ['k'], value } });
};

describe('EventBus subscribeCoalesced (M1.3)', () => {
  describe('coalesced delivery', () => {
    it('should deliver buffered events once per microtask', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('query.created', handler);
      emit(bus, 'query.created', 1);

      expect(handler).not.toHaveBeenCalled();

      await flushMicrotasks();
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should collapse same-type events to the latest within a batch', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('query.created', handler);
      emit(bus, 'query.created', 1);
      emit(bus, 'query.created', 2);
      emit(bus, 'query.created', 3);

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
      const event = handler.mock.calls[0]![0] as RuntimeEvent;
      expect(event.type).toBe('query.created');
      expect(event.payload.value).toBe(3);
    });

    it('should preserve seq ordering across distinct types in a batch', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('*', handler);
      emit(bus, 'query.created', 1);
      emit(bus, 'cache.updated', 2);
      emit(bus, 'query.updated', 3);

      await flushMicrotasks();

      const events = handler.mock.calls.map((c) => (c[0] as RuntimeEvent).seq);
      expect(events).toEqual([events[0]!, events[1]!, events[2]!].sort((a, b) => a - b));
      expect(handler.mock.calls.map((c) => (c[0] as RuntimeEvent).payload.value)).toEqual([
        1, 2, 3,
      ]);
    });

    it('should preserve seq order when a type is re-pushed in the same tick (F-02)', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('*', handler);
      emit(bus, 'query.created', 1);
      emit(bus, 'query.updated', 2);
      emit(bus, 'query.created', 3);

      await flushMicrotasks();

      // Latest per type: query.created (seq 2) and query.updated (seq 1); the
      // re-pushed type must not overtake the type emitted after it.
      const seqs = handler.mock.calls.map((c) => (c[0] as RuntimeEvent).seq);
      expect(seqs).toEqual([1, 2]);
      expect(handler.mock.calls.map((c) => (c[0] as RuntimeEvent).payload.value)).toEqual([
        2, 3,
      ]);
    });

    it('should deliver subsequent batches after a drain', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('query.created', handler);
      emit(bus, 'query.created', 1);
      await flushMicrotasks();
      emit(bus, 'query.created', 2);
      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe('isolation (SPEC §8 def. 4)', () => {
    it('should isolate a throwing handler without breaking the batch', async () => {
      const bus = new EventBus();
      const handler = vi.fn((event: RuntimeEvent) => {
        if (event.payload.value === 2) throw new Error('boom');
      });

      bus.subscribeCoalesced('*', handler);
      emit(bus, 'query.created', 1);
      emit(bus, 'query.updated', 2);
      emit(bus, 'cache.updated', 3);

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(3);
      expect(handler.mock.calls.map((c) => (c[0] as RuntimeEvent).payload.value)).toEqual([
        1, 2, 3,
      ]);
    });

    it('should isolate a throwing handler without breaking other subscribers', async () => {
      const bus = new EventBus();
      const throwing = vi.fn(() => {
        throw new Error('boom');
      });
      const healthy = vi.fn();

      bus.subscribeCoalesced('query.created', throwing);
      bus.subscribeCoalesced('query.created', healthy);
      emit(bus, 'query.created', 1);

      await flushMicrotasks();

      expect(healthy).toHaveBeenCalledTimes(1);
    });
  });

  describe('backpressure (SPEC §8 def. 6; CA-4)', () => {
    it('should bound the pending queue with a documented cap', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('*', handler, { cap: 3 });

      for (let i = 0; i < 1000; i++) {
        emit(bus, 'query.created', i);
        emit(bus, 'query.updated', i);
        emit(bus, 'cache.updated', i);
      }

      await flushMicrotasks();

      // Only the newest 3 distinct keys survive the synchronous storm.
      expect(handler).toHaveBeenCalledTimes(3);
      const values = handler.mock.calls.map((c) => (c[0] as RuntimeEvent).payload.value);
      expect(values).toEqual([999, 999, 999]);
    });

    it('should not block the emit path when the queue is at cap', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('*', handler, { cap: 1 });

      for (let i = 0; i < 10_000; i++) {
        emit(bus, 'query.created', i);
      }

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('default path preservation (EDR C2; CA-4)', () => {
    it('should NOT drop events for the default synchronous subscribe path', async () => {
      const bus = new EventBus();
      const syncHandler = vi.fn();

      bus.subscribe('query.created', syncHandler);
      bus.subscribeCoalesced('query.created', () => {});

      for (let i = 0; i < 100; i++) {
        emit(bus, 'query.created', i);
      }

      expect(syncHandler).toHaveBeenCalledTimes(100);
    });

    it('should keep default delivery synchronous and in order', async () => {
      const bus = new EventBus();
      const received: number[] = [];

      bus.subscribe('query.created', (event) => received.push(event.payload.value as number));
      bus.subscribeCoalesced('*', () => {});

      emit(bus, 'query.created', 1);
      emit(bus, 'query.created', 2);
      expect(received).toEqual([1, 2]);
    });
  });

  describe('subscription semantics', () => {
    it('should only receive the subscribed type', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('query.updated', handler);
      emit(bus, 'query.created', 1);
      emit(bus, 'query.updated', 2);

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
      expect((handler.mock.calls[0]![0] as RuntimeEvent).type).toBe('query.updated');
    });

    it('should support the wildcard subscribing to every event', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('*', handler);
      emit(bus, 'query.created', 1);
      emit(bus, 'cache.updated', 2);
      emit(bus, 'query.updated', 3);

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(3);
    });

    it('should stop delivering after unsubscribe', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      const unsubscribe = bus.subscribeCoalesced('*', handler);
      emit(bus, 'query.created', 1);
      await flushMicrotasks();

      unsubscribe();
      emit(bus, 'query.created', 2);
      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not deliver a pending batch that was disposed before the drain', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      const unsubscribe = bus.subscribeCoalesced('query.created', handler);
      emit(bus, 'query.created', 1);
      unsubscribe();
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should clean up registries on clear', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('query.created', handler);
      bus.subscribeCoalesced('*', handler);
      bus.clear();
      emit(bus, 'query.created', 1);
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not deliver a pending typed batch after clear() (F-01)', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('query.created', handler);
      emit(bus, 'query.created', 1);
      bus.clear();
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });

    it('should not deliver a pending wildcard batch after clear()', async () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribeCoalesced('*', handler);
      emit(bus, 'query.created', 1);
      bus.clear();
      await flushMicrotasks();

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('onError hook (EDR §8.1.4 #6)', () => {
    it('should report swallowed coalesced handler errors', async () => {
      const onError = vi.fn();
      const bus = new EventBus({ onError });

      bus.subscribeCoalesced('query.created', () => {
        throw new Error('boom');
      });
      emit(bus, 'query.created', 1);

      await flushMicrotasks();

      expect(onError).toHaveBeenCalledTimes(1);
      expect((onError.mock.calls[0]![0] as Error).message).toBe('boom');
    });

    it('should report swallowed default listener errors', () => {
      const onError = vi.fn();
      const bus = new EventBus({ onError });

      bus.subscribe('query.created', () => {
        throw new Error('boom');
      });
      emit(bus, 'query.created', 1);

      expect(onError).toHaveBeenCalledTimes(1);
    });

    it('should keep delivery safe if the onError hook itself throws', async () => {
      const bus = new EventBus({
        onError: () => {
          throw new Error('hook failure');
        },
      });
      const handler = vi.fn();

      bus.subscribe('query.created', () => {
        throw new Error('listener failure');
      });
      bus.subscribeCoalesced('query.created', handler);
      emit(bus, 'query.created', 1);

      await flushMicrotasks();

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });
});
