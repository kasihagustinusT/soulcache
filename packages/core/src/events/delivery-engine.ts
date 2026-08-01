/**
 * DeliveryEngine
 *
 * @internal
 *
 * Internal microtask delivery engine for the EventBus coalesced mode
 * (ADR-006; SPEC §8 def. 4/6; EDR §8.1.4; PROTO §9.2, §23.2).
 *
 * Buffers items pushed during the current tick, coalesces them per key
 * (latest value wins; first-seen key order preserved), and drains the batch
 * once per microtask. Reuses the Scheduler's observer-notification dedup
 * concept (`scheduler.ts:_applyBatching`). Default synchronous `subscribe`
 * delivery is NOT changed by this module (EDR C2).
 */

export interface DeliveryItem<T> {
  /** Coalescing key (e.g. event type or query hash). */
  readonly key: string;
  /** Latest value pushed for the key in the current batch. */
  readonly value: T;
}

export interface DeliveryEngineOptions<T> {
  /**
   * Receives one coalesced batch per microtask. A thrown error here is
   * isolated and never breaks the runtime (SPEC §8 def. 4); per-subscriber
   * isolation is the caller's responsibility.
   */
  onDrain: (items: readonly DeliveryItem<T>[]) => void;
}

export class DeliveryEngine<T> {
  private readonly _items = new Map<string, T>();
  private readonly _onDrain: (items: readonly DeliveryItem<T>[]) => void;
  private _scheduled = false;
  private _disposed = false;

  constructor(options: DeliveryEngineOptions<T>) {
    this._onDrain = options.onDrain;
  }

  /**
   * Buffer an item, coalescing by key. Schedules a single microtask flush if
   * none is pending. No-op after {@link dispose}.
   */
  push(key: string, value: T): void {
    if (this._disposed) return;
    this._items.set(key, value);
    if (!this._scheduled) {
      this._scheduled = true;
      void Promise.resolve().then(() => this._flush());
    }
  }

  /**
   * Drain the buffered batch synchronously (used by dispose and tests).
   */
  flush(): void {
    if (this._disposed || !this._scheduled) return;
    this._flush();
  }

  /**
   * Stop accepting items and drop any pending batch. Safe to call more than
   * once; a later scheduled flush becomes a no-op.
   */
  dispose(): void {
    this._disposed = true;
    this._scheduled = false;
    this._items.clear();
  }

  /** Number of distinct keys currently buffered. */
  get pendingCount(): number {
    return this._items.size;
  }

  private _flush(): void {
    this._scheduled = false;
    if (this._disposed || this._items.size === 0) return;

    const items: DeliveryItem<T>[] = [];
    for (const [key, value] of this._items) {
      items.push({ key, value });
    }
    this._items.clear();

    try {
      this._onDrain(items);
    } catch (_error) {
      // Isolated: a failing drain must not break the runtime (SPEC §8 def. 4).
    }
  }
}
