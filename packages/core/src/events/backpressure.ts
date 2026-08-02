/**
 * CoalescingQueue
 *
 * @internal
 *
 * Bounded backpressure primitive for the EventBus coalesced mode
 * (SPEC §8 def. 5/6; CA-4; PROTO §22).
 *
 * Buffers items pushed since the last drain, coalescing per key (latest value
 * wins, first-seen key order preserved). The queue is hard-bounded by `cap`:
 * when the queue is full and a NEW key arrives, the OLDEST buffered entry is
 * evicted so memory stays bounded (documented drop semantics; PROTO §22.2).
 * Same-key replacement never exceeds the cap. The runtime never blocks.
 */
export interface CoalescingEntry<T> {
  /** Coalescing key (e.g. event type). */
  readonly key: string;
  /** Latest value pushed for the key since the last drain. */
  readonly value: T;
}

export interface CoalescingQueueOptions {
  /**
   * Hard bound on buffered entries (PROTO §22). Defaults to 1000.
   */
  cap?: number;
}

export class CoalescingQueue<T> {
  private readonly _cap: number;
  private readonly _order: string[] = [];
  private readonly _entries = new Map<string, T>();
  private _disposed = false;

  constructor(options: CoalescingQueueOptions = {}) {
    if (options.cap !== undefined && options.cap < 1) {
      throw new RangeError(`CoalescingQueue cap must be >= 1 (got ${options.cap})`);
    }
    this._cap = options.cap ?? 1000;
  }

  /**
   * Buffer an item, coalescing by key. Same-key pushes replace the value and
   * never grow the queue; a new key at the cap evicts the oldest entry.
   * No-op after {@link dispose}.
   */
  push(key: string, value: T): void {
    if (this._disposed) return;
    if (this._entries.has(key)) {
      this._entries.set(key, value);
      return;
    }
    if (this._order.length >= this._cap) {
      const oldest = this._order.shift();
      if (oldest !== undefined) {
        this._entries.delete(oldest);
      }
    }
    this._order.push(key);
    this._entries.set(key, value);
  }

  /**
   * Return buffered entries in first-seen (FIFO) key order and clear the
   * queue. Returns an empty array after {@link dispose}.
   */
  drain(): readonly CoalescingEntry<T>[] {
    if (this._disposed) return [];
    const items: CoalescingEntry<T>[] = [];
    for (const key of this._order) {
      const value = this._entries.get(key);
      if (value !== undefined) {
        items.push({ key, value });
      }
    }
    this._order.length = 0;
    this._entries.clear();
    return items;
  }

  /** Number of distinct keys currently buffered (never exceeds {@link cap}). */
  get size(): number {
    return this._entries.size;
  }

  /** The documented bound on buffered entries (PROTO §22). */
  get cap(): number {
    return this._cap;
  }

  /**
   * Stop accepting items and drop any buffered entries. Safe to call more than
   * once; later pushes and drains become no-ops.
   */
  dispose(): void {
    this._disposed = true;
    this._order.length = 0;
    this._entries.clear();
  }
}
