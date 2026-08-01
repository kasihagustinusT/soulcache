import { describe, it, expect, vi } from 'vitest';
import { EventBus } from '../src/events/event-bus';
import type { RuntimeEvent } from '../src/types/events.types';

describe('EventBus', () => {
  describe('subscribe', () => {
    it('should subscribe to events', () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribe('query.created', handler);

      expect(bus.getListenerCount('query.created')).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const bus = new EventBus();
      const handler = vi.fn();

      const unsubscribe = bus.subscribe('query.created', handler);
      unsubscribe();

      expect(bus.getListenerCount('query.created')).toBe(0);
    });

    it('should support multiple subscribers', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe('query.created', handler1);
      bus.subscribe('query.created', handler2);

      expect(bus.getListenerCount('query.created')).toBe(2);
    });
  });

  describe('emit', () => {
    it('should deliver events to subscribers', () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.subscribe('query.created', handler);

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '123', queryKey: ['users'] },
      });

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should deliver event with correct data', () => {
      const bus = new EventBus();
      let receivedEvent: RuntimeEvent | undefined;

      bus.subscribe('query.created', (event) => {
        receivedEvent = event;
      });

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '123', queryKey: ['users'] },
      });

      expect(receivedEvent).toBeDefined();
      expect(receivedEvent?.type).toBe('query.created');
      expect(receivedEvent?.source).toBe('query-runtime');
      expect(receivedEvent?.payload.queryId).toBe('123');
      expect(receivedEvent?.id).toBeDefined();
      expect(receivedEvent?.timestamp).toBeDefined();
    });

    it('should deliver events in FIFO order', () => {
      const bus = new EventBus();
      const order: string[] = [];

      bus.subscribe('query.created', () => {
        order.push('first');
      });

      bus.subscribe('query.created', () => {
        order.push('second');
      });

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      expect(order).toEqual(['first', 'second']);
    });

    it('should log events', () => {
      const bus = new EventBus();

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '123', queryKey: ['users'] },
      });

      expect(bus.getEventLog()).toHaveLength(1);
    });

    it('should not crash on handler error', () => {
      const bus = new EventBus();

      bus.subscribe('query.created', () => {
        throw new Error('handler error');
      });

      expect(() => {
        bus.emit({
          type: 'query.created',
          source: 'query-runtime',
          payload: { queryId: '123', queryKey: ['users'] },
        });
      }).not.toThrow();
    });
  });

  describe('clear', () => {
    it('should remove all listeners', () => {
      const bus = new EventBus();

      bus.subscribe('query.created', vi.fn());
      bus.subscribe('query.success', vi.fn());

      bus.clear();

      expect(bus.getTotalListenerCount()).toBe(0);
    });

    it('should clear event log', () => {
      const bus = new EventBus();

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '123', queryKey: [] },
      });

      bus.clear();

      expect(bus.getEventLog()).toHaveLength(0);
    });
  });

  describe('getEventLog', () => {
    it('should return all events', () => {
      const bus = new EventBus();

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      bus.emit({
        type: 'query.success',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      expect(bus.getEventLog()).toHaveLength(2);
    });

    it('should filter by event type', () => {
      const bus = new EventBus();

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      bus.emit({
        type: 'query.success',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      expect(bus.getEventLog('query.created')).toHaveLength(1);
      expect(bus.getEventLog('query.success')).toHaveLength(1);
    });
  });

  describe('getTotalListenerCount', () => {
    it('should count all listeners across event types', () => {
      const bus = new EventBus();

      bus.subscribe('query.created', vi.fn());
      bus.subscribe('query.created', vi.fn());
      bus.subscribe('query.success', vi.fn());

      expect(bus.getTotalListenerCount()).toBe(3);
    });
  });

  describe('sequence number (M1.1)', () => {
    it('should assign a strictly increasing seq to every emitted event', () => {
      const bus = new EventBus();
      const seqs: number[] = [];

      bus.subscribe('query.created', (e) => seqs.push(e.seq));
      bus.subscribe('query.success', (e) => seqs.push(e.seq));

      for (let i = 0; i < 50; i++) {
        bus.emit({
          type: 'query.created',
          source: 'query-runtime',
          payload: { queryId: String(i), queryKey: ['k', i] },
        });
        bus.emit({
          type: 'query.success',
          source: 'query-runtime',
          payload: { queryId: String(i), queryKey: ['k', i] },
        });
      }

      expect(seqs).toHaveLength(100);
      for (let i = 1; i < seqs.length; i++) {
        expect(seqs[i]!).toBeGreaterThan(seqs[i - 1]!);
      }
      expect(new Set(seqs).size).toBe(100);
    });

    it('property: seq is monotonic across 10k emissions (mixed types)', () => {
      const bus = new EventBus();
      const received: number[] = [];
      const collect = (e: { seq: number }) => received.push(e.seq);

      bus.subscribe('query.created', collect);
      bus.subscribe('cache.hit', collect);
      bus.subscribe('fetch.completed', collect);

      for (let i = 0; i < 10_000; i++) {
        const type = (['query.created', 'cache.hit', 'fetch.completed'] as const)[i % 3]!;
        bus.emit({
          type,
          source: type === 'query.created' ? 'query-runtime' : 'internal',
          payload: { i },
        });
      }

      expect(received).toHaveLength(10_000);
      for (let i = 1; i < received.length; i++) {
        expect(received[i]!).toBe(received[i - 1]! + 1);
      }
    });

    it('should preserve per-handler isolation while assigning seq', () => {
      const bus = new EventBus();
      const received: number[] = [];

      bus.subscribe('query.created', () => {
        throw new Error('handler error');
      });
      bus.subscribe('query.created', (e) => {
        received.push(e.seq);
      });

      expect(() => {
        bus.emit({
          type: 'query.created',
          source: 'query-runtime',
          payload: { queryId: '1', queryKey: [] },
        });
      }).not.toThrow();

      expect(received).toEqual([0]);
    });

    it('should assign seq at emit and ignore nothing caller-provided (omit)', () => {
      const bus = new EventBus();
      const seen: Array<{ seq: number; id: string }> = [];

      bus.subscribe('query.created', (e) => seen.push({ seq: e.seq, id: e.id }));

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });
      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '2', queryKey: [] },
      });

      expect(seen[0]!.seq).toBe(0);
      expect(seen[1]!.seq).toBe(1);
      expect(seen[0]!.id).toBeDefined();
      expect(seen[0]!.id).not.toBe(seen[1]!.id);
    });

    it('should carry seq in the event log', () => {
      const bus = new EventBus();

      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });
      bus.emit({
        type: 'query.success',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      const log = bus.getEventLog();
      expect(log).toHaveLength(2);
      expect(log[0]!.seq).toBe(0);
      expect(log[1]!.seq).toBe(1);
    });

    it('should keep seq monotonic across clear() (global ordering token)', () => {
      const bus = new EventBus();
      const seqs: number[] = [];

      bus.subscribe('query.created', (e) => seqs.push(e.seq));
      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '1', queryKey: [] },
      });

      bus.clear();
      bus.subscribe('query.created', (e) => seqs.push(e.seq));
      bus.emit({
        type: 'query.created',
        source: 'query-runtime',
        payload: { queryId: '2', queryKey: [] },
      });

      expect(seqs).toEqual([0, 1]);
      expect(bus.getEventLog()).toHaveLength(1);
    });
  });
});
