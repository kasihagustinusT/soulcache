import type {
  RuntimeEvent,
  EventHandler,
  EventUnsubscriber,
  RuntimeEventType,
  EventPayload,
} from '../types/events.types';
import { generateId } from '../utils/query.utils';
import { CoalescingQueue } from './backpressure';

interface CoalescedSubscriber {
  readonly queue: CoalescingQueue<RuntimeEvent>;
  readonly handler: EventHandler;
  scheduled: boolean;
}

/**
 * EventBus
 *
 * Internal event system for runtime communication.
 *
 * Provides deterministic event ordering and typed subscriptions.
 *
 * @example
 * ```ts
 * const bus = new EventBus();
 *
 * const unsubscribe = bus.subscribe('query.created', (event) => {
 *   console.log('Query created:', event.payload.queryId);
 * });
 *
 * bus.emit({
 *   type: 'query.created',
 *   source: 'query-runtime',
 *   payload: { queryId: '123', queryKey: ['users'] },
 * });
 *
 * unsubscribe();
 * ```
 */
export class EventBus {
  private readonly listeners = new Map<RuntimeEventType, Set<EventHandler>>();
  private readonly coalesced = new Map<RuntimeEventType, Set<CoalescedSubscriber>>();
  private readonly coalescedWildcard = new Set<CoalescedSubscriber>();
  private readonly eventLog: RuntimeEvent[] = [];
  private readonly maxLogSize: number;
  private readonly maxHandlersPerType: number;
  private readonly onError: ((error: unknown) => void) | undefined;
  private nextSeq = 0;

  constructor(options?: {
    maxLogSize?: number;
    onError?: (error: unknown) => void;
    maxHandlersPerType?: number;
  }) {
    this.maxLogSize = options?.maxLogSize ?? 1000;
    this.maxHandlersPerType = options?.maxHandlersPerType ?? 10000;
    this.onError = options?.onError;
  }

  /**
   * Report a swallowed listener/drain error to the configured hook.
   *
   * RuntimeError-safe (EDR §8.1.4 #6): diagnostics only, never re-thrown; a
   * throwing hook itself is caught so it can never break delivery.
   */
  private reportError(error: unknown): void {
    if (!this.onError) return;
    try {
      this.onError(error);
    } catch {
      // A failing hook must not crash the runtime or break delivery.
    }
  }

  /**
   * Subscribe to an event type.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @returns Unsubscribe function
   * @throws {RangeError} If the per-type handler cap is exceeded
   */
  subscribe<T extends EventPayload>(
    eventType: RuntimeEventType,
    handler: EventHandler<T>,
  ): EventUnsubscriber {
    const typeSet = this.getOrCreateListeners(eventType);
    if (typeSet.size >= this.maxHandlersPerType) {
      throw new RangeError(
        `EventBus exceeded max handlers (${this.maxHandlersPerType}) for event type "${eventType}"`,
      );
    }
    const typedHandler = handler as EventHandler;
    typeSet.add(typedHandler);

    return () => {
      typeSet.delete(typedHandler);
      if (typeSet.size === 0) {
        this.listeners.delete(eventType);
      }
    };
  }

  /**
   * Subscribe to a coalescing delivery mode.
   *
   * @experimental Opt-in backpressure for high-volume subscribers (EDR §8.1.3;
   * SPEC §8 def. 6; CA-4). Buffers events into a per-subscriber queue with a
   * documented cap; within a microtask flush, same-type events collapse to the
   * latest and the queue is drained in seq order. When the queue is full, the
   * oldest buffered event is evicted so memory stays bounded — intermediate
   * events may be dropped (documented drop semantics); delivery is at-least-once
   * for the events that remain. A throwing handler is isolated and never breaks
   * the batch. The default synchronous `subscribe` path is unchanged (EDR C2).
   *
   * @param eventType - The event type, or `'*'` for all events
   * @param handler - The handler function
   * @param options - Optional `{ cap }` bound on buffered events (default 1000)
   * @returns Unsubscribe function
   */
  subscribeCoalesced<T extends EventPayload>(
    eventType: RuntimeEventType | '*',
    handler: EventHandler<T>,
    options?: { cap?: number },
  ): EventUnsubscriber {
    const subscriber: CoalescedSubscriber = {
      queue: new CoalescingQueue<RuntimeEvent>(
        options?.cap !== undefined ? { cap: options.cap } : undefined,
      ),
      handler: handler as EventHandler,
      scheduled: false,
    };

    if (eventType === '*') {
      this.coalescedWildcard.add(subscriber);
    } else {
      let typeSet = this.coalesced.get(eventType);
      if (!typeSet) {
        typeSet = new Set();
        this.coalesced.set(eventType, typeSet);
      }
      typeSet.add(subscriber);
    }

    return () => {
      subscriber.queue.dispose();
      if (eventType === '*') {
        this.coalescedWildcard.delete(subscriber);
      } else {
        const typeSet = this.coalesced.get(eventType);
        if (typeSet) {
          typeSet.delete(subscriber);
          if (typeSet.size === 0) {
            this.coalesced.delete(eventType);
          }
        }
      }
    };
  }

  /**
   * Emit a runtime event.
   *
   * Events are delivered synchronously in FIFO order.
   * The `id`, `seq`, and `timestamp` fields are assigned by the bus;
   * callers omit them.
   *
   * @param event - The event to emit
   */
  emit(event: Omit<RuntimeEvent, 'id' | 'timestamp' | 'seq'>): void {
    const fullEvent: RuntimeEvent = {
      ...event,
      id: generateId(),
      seq: this.nextSeq++,
      timestamp: Date.now(),
    };

    // Log event
    this.eventLog.push(fullEvent);
    if (this.eventLog.length > this.maxLogSize) {
      this.eventLog.shift();
    }

    // Deliver to listeners
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(fullEvent);
        } catch (_error) {
          // Listener failure must not crash runtime
          // Error is captured but not re-thrown
          this.reportError(_error);
        }
      }
    }

    // Deliver to coalescing subscribers (opt-in; bounded; never blocks)
    this.deliverCoalesced(fullEvent);
  }

  private deliverCoalesced(event: RuntimeEvent): void {
    const typeSet = this.coalesced.get(event.type);
    if (typeSet) {
      for (const subscriber of typeSet) {
        this.pushCoalesced(subscriber, event);
      }
    }
    for (const subscriber of this.coalescedWildcard) {
      this.pushCoalesced(subscriber, event);
    }
  }

  private pushCoalesced(subscriber: CoalescedSubscriber, event: RuntimeEvent): void {
    subscriber.queue.push(event.type, event);
    if (!subscriber.scheduled) {
      subscriber.scheduled = true;
      void Promise.resolve().then(() => this.flushCoalesced(subscriber));
    }
  }

  private flushCoalesced(subscriber: CoalescedSubscriber): void {
    subscriber.scheduled = false;
    // Drain in sequence-number order (SPEC §8 def. 3; docs contract). The queue
    // preserves first-seen key order, so a same-type re-push must not overtake
    // types pushed after it.
    const items = subscriber.queue.drain().slice().sort((a, b) => a.value.seq - b.value.seq);
    for (const item of items) {
      try {
        subscriber.handler(item.value);
      } catch (_error) {
        // Coalesced subscriber failure must not crash runtime or break the batch
        this.reportError(_error);
      }
    }
  }

  /**
   * Clear all listeners.
   */
  clear(): void {
    this.listeners.clear();
    for (const typeSet of this.coalesced.values()) {
      for (const subscriber of typeSet) {
        subscriber.queue.dispose();
      }
    }
    this.coalesced.clear();
    for (const subscriber of this.coalescedWildcard) {
      subscriber.queue.dispose();
    }
    this.coalescedWildcard.clear();
    this.eventLog.length = 0;
  }

  /**
   * Get event log.
   *
   * @param eventType - Optional filter by event type
   * @returns Array of events
   */
  getEventLog(eventType?: RuntimeEventType): readonly RuntimeEvent[] {
    if (eventType) {
      return this.eventLog.filter((e) => e.type === eventType);
    }
    return this.eventLog;
  }

  /**
   * Get listener count for an event type.
   *
   * @param eventType - The event type
   * @returns Number of listeners
   */
  getListenerCount(eventType: RuntimeEventType): number {
    return this.listeners.get(eventType)?.size ?? 0;
  }

  /**
   * Get total listener count.
   *
   * @returns Total number of listeners
   */
  getTotalListenerCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }

  private getOrCreateListeners(eventType: RuntimeEventType): Set<EventHandler> {
    let set = this.listeners.get(eventType);
    if (!set) {
      set = new Set();
      this.listeners.set(eventType, set);
    }
    return set;
  }
}
