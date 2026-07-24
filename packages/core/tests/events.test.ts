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
});
