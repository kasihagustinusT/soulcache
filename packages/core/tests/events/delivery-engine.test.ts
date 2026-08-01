import { describe, it, expect, vi } from 'vitest';
import { DeliveryEngine } from '../../src/events/delivery-engine';
import type { DeliveryItem } from '../../src/events/delivery-engine';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('DeliveryEngine', () => {
  describe('batching', () => {
    it('should buffer pushes and drain once per microtask', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('a', 1);
      engine.push('b', 2);
      engine.push('c', 3);

      expect(onDrain).not.toHaveBeenCalled();

      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(1);
      const items = onDrain.mock.calls[0]![0] as readonly DeliveryItem<number>[];
      expect(items).toEqual([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
        { key: 'c', value: 3 },
      ]);
    });

    it('should coalesce by key (latest value wins) within a batch', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('query', 1);
      engine.push('query', 2);
      engine.push('query', 3);

      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(1);
      const items = onDrain.mock.calls[0]![0] as readonly DeliveryItem<number>[];
      expect(items).toEqual([{ key: 'query', value: 3 }]);
    });

    it('should preserve first-seen key order after coalescing', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('first', 1);
      engine.push('second', 2);
      engine.push('first', 3);

      await flushMicrotasks();

      const items = onDrain.mock.calls[0]![0] as readonly DeliveryItem<number>[];
      expect(items.map((i) => i.key)).toEqual(['first', 'second']);
      expect(items.map((i) => i.value)).toEqual([3, 2]);
    });

    it('should not drain twice in the same tick', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('a', 1);
      await Promise.resolve();
      engine.push('b', 2);

      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(2);
      expect(onDrain.mock.calls[0]![0]).toEqual([{ key: 'a', value: 1 }]);
      expect(onDrain.mock.calls[1]![0]).toEqual([{ key: 'b', value: 2 }]);
    });

    it('should drain per microtask across ticks', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('a', 1);
      await flushMicrotasks();
      engine.push('b', 2);
      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(2);
      expect(onDrain.mock.calls[0]![0]).toEqual([{ key: 'a', value: 1 }]);
      expect(onDrain.mock.calls[1]![0]).toEqual([{ key: 'b', value: 2 }]);
    });

    it('should support synchronous flush for pending items', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('a', 1);
      engine.push('a', 2);
      engine.flush();

      expect(onDrain).toHaveBeenCalledTimes(1);
      expect(onDrain.mock.calls[0]![0]).toEqual([{ key: 'a', value: 2 }]);
      expect(engine.pendingCount).toBe(0);

      await flushMicrotasks();
      expect(onDrain).toHaveBeenCalledTimes(1);
    });
  });

  describe('ordering integration', () => {
    it('should deliver all 1k subscribers/keys in a single ordered batch', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      for (let i = 0; i < 1000; i++) {
        engine.push(`key-${i}`, i);
      }

      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(1);
      const items = onDrain.mock.calls[0]![0] as readonly DeliveryItem<number>[];
      expect(items).toHaveLength(1000);
      for (let i = 0; i < 1000; i++) {
        expect(items[i]!.key).toBe(`key-${i}`);
        expect(items[i]!.value).toBe(i);
      }
    });

    it('should respect coalescing across 1k pushes to the same key', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      for (let i = 0; i < 1000; i++) {
        engine.push('hot', i);
      }

      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(1);
      expect(onDrain.mock.calls[0]![0]).toEqual([{ key: 'hot', value: 999 }]);
    });
  });

  describe('error isolation', () => {
    it('should isolate a throwing drain without breaking later batches', async () => {
      const onDrain = vi.fn(() => {
        throw new Error('drain failure');
      });
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('a', 1);
      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(1);

      engine.push('b', 2);
      await flushMicrotasks();

      expect(onDrain).toHaveBeenCalledTimes(2);
      expect(engine.pendingCount).toBe(0);
    });
  });

  describe('lifecycle', () => {
    it('should drop pending items on dispose', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.push('a', 1);
      engine.dispose();
      await flushMicrotasks();

      expect(onDrain).not.toHaveBeenCalled();
      expect(engine.pendingCount).toBe(0);
    });

    it('should be a no-op for push/flush after dispose', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.dispose();
      engine.push('a', 1);
      engine.flush();
      await flushMicrotasks();

      expect(onDrain).not.toHaveBeenCalled();
      expect(engine.pendingCount).toBe(0);
    });

    it('should support multiple dispose calls', async () => {
      const onDrain = vi.fn();
      const engine = new DeliveryEngine<number>({ onDrain });

      engine.dispose();
      engine.dispose();
      engine.push('a', 1);
      await flushMicrotasks();

      expect(onDrain).not.toHaveBeenCalled();
    });
  });
});
