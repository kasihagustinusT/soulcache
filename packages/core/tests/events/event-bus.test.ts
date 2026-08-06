import { describe, it, expect } from 'vitest';
import { EventBus } from '../../src/events/event-bus';

describe('EventBus', () => {
  describe('handler limit', () => {
    it('should throw RangeError when the per-type cap is exceeded', () => {
      const bus = new EventBus({ maxHandlersPerType: 2 });

      bus.subscribe('query.created', () => undefined);
      bus.subscribe('query.created', () => undefined);

      expect(() => bus.subscribe('query.created', () => undefined)).toThrow(RangeError);
    });

    it('should allow handlers on other event types beyond the cap', () => {
      const bus = new EventBus({ maxHandlersPerType: 1 });

      bus.subscribe('query.created', () => undefined);
      expect(() => bus.subscribe('query.updated', () => undefined)).not.toThrow();
    });

    it('should allow resubscription after unsubscribing', () => {
      const bus = new EventBus({ maxHandlersPerType: 1 });

      const unsubscribe = bus.subscribe('query.created', () => undefined);
      unsubscribe();
      expect(() => bus.subscribe('query.created', () => undefined)).not.toThrow();
    });

    it('should default to a generous cap', () => {
      const bus = new EventBus();
      expect(() => {
        for (let i = 0; i < 100; i++) {
          bus.subscribe('query.created', () => undefined);
        }
      }).not.toThrow();
    });
  });
});
