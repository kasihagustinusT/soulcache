import { describe, it, expect } from 'vitest';
import { CoalescingQueue } from '../../src/events/backpressure';
import type { CoalescingEntry } from '../../src/events/backpressure';

describe('CoalescingQueue', () => {
  describe('batching', () => {
    it('should buffer pushes and drain in FIFO first-seen key order', () => {
      const queue = new CoalescingQueue<number>();

      queue.push('a', 1);
      queue.push('b', 2);
      queue.push('c', 3);

      expect(queue.size).toBe(3);
      expect(queue.drain()).toEqual([
        { key: 'a', value: 1 },
        { key: 'b', value: 2 },
        { key: 'c', value: 3 },
      ]);
      expect(queue.size).toBe(0);
    });

    it('should coalesce by key (latest value wins) within a batch', () => {
      const queue = new CoalescingQueue<number>();

      queue.push('query', 1);
      queue.push('query', 2);
      queue.push('query', 3);

      expect(queue.drain()).toEqual([{ key: 'query', value: 3 }]);
    });

    it('should preserve first-seen key order after coalescing', () => {
      const queue = new CoalescingQueue<number>();

      queue.push('first', 1);
      queue.push('second', 2);
      queue.push('first', 3);

      const items = queue.drain() as readonly CoalescingEntry<number>[];
      expect(items.map((i) => i.key)).toEqual(['first', 'second']);
      expect(items.map((i) => i.value)).toEqual([3, 2]);
    });

    it('should drain exactly once and clear pending entries', () => {
      const queue = new CoalescingQueue<number>();

      queue.push('a', 1);
      queue.drain();
      expect(queue.drain()).toEqual([]);
      expect(queue.size).toBe(0);
    });
  });

  describe('bounded memory (PROTO §22)', () => {
    it('should never exceed the configured cap', () => {
      const queue = new CoalescingQueue<number>({ cap: 3 });

      queue.push('a', 1);
      queue.push('b', 2);
      queue.push('c', 3);
      expect(queue.size).toBe(3);

      queue.push('d', 4);
      expect(queue.size).toBe(3);
    });

    it('should evict the OLDEST entry when full and a new key arrives', () => {
      const queue = new CoalescingQueue<number>({ cap: 3 });

      queue.push('a', 1);
      queue.push('b', 2);
      queue.push('c', 3);
      queue.push('d', 4);

      expect(queue.drain()).toEqual([
        { key: 'b', value: 2 },
        { key: 'c', value: 3 },
        { key: 'd', value: 4 },
      ]);
    });

    it('should not evict when the incoming key already exists at the cap', () => {
      const queue = new CoalescingQueue<number>({ cap: 2 });

      queue.push('a', 1);
      queue.push('b', 2);
      queue.push('a', 3);

      expect(queue.size).toBe(2);
      expect(queue.drain()).toEqual([
        { key: 'a', value: 3 },
        { key: 'b', value: 2 },
      ]);
    });

    it('should stay bounded across 100k distinct pushes', () => {
      const queue = new CoalescingQueue<number>({ cap: 1000 });

      for (let i = 0; i < 100_000; i++) {
        queue.push(`key-${i % 10_000}`, i);
      }

      expect(queue.size).toBeLessThanOrEqual(1000);
    });

    it('should default the cap to 1000', () => {
      const queue = new CoalescingQueue<number>();
      expect(queue.cap).toBe(1000);
    });

    it('should reject a cap below 1', () => {
      expect(() => new CoalescingQueue<number>({ cap: 0 })).toThrow(RangeError);
    });
  });

  describe('lifecycle', () => {
    it('should drop buffered entries on dispose', () => {
      const queue = new CoalescingQueue<number>();

      queue.push('a', 1);
      queue.dispose();

      expect(queue.drain()).toEqual([]);
      expect(queue.size).toBe(0);
    });

    it('should be a no-op for push/drain after dispose', () => {
      const queue = new CoalescingQueue<number>();

      queue.dispose();
      queue.push('a', 1);

      expect(queue.size).toBe(0);
      expect(queue.drain()).toEqual([]);
    });

    it('should support multiple dispose calls', () => {
      const queue = new CoalescingQueue<number>();

      queue.dispose();
      queue.dispose();
      queue.push('a', 1);

      expect(queue.size).toBe(0);
    });
  });
});
