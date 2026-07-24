import type {
  RuntimeEvent,
  EventHandler,
  EventUnsubscriber,
  RuntimeEventType,
  EventPayload,
} from '../types/events.types';
import { generateId } from '../utils/query.utils';

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
  private readonly eventLog: RuntimeEvent[] = [];
  private readonly maxLogSize: number;

  constructor(options?: { maxLogSize?: number }) {
    this.maxLogSize = options?.maxLogSize ?? 1000;
  }

  /**
   * Subscribe to an event type.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   * @returns Unsubscribe function
   */
  subscribe<T extends EventPayload>(
    eventType: RuntimeEventType,
    handler: EventHandler<T>,
  ): EventUnsubscriber {
    const typeSet = this.getOrCreateListeners(eventType);
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
   * Emit a runtime event.
   *
   * Events are delivered synchronously in FIFO order.
   *
   * @param event - The event to emit
   */
  emit(event: Omit<RuntimeEvent, 'id' | 'timestamp'>): void {
    const fullEvent: RuntimeEvent = {
      ...event,
      id: generateId(),
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
        }
      }
    }
  }

  /**
   * Clear all listeners.
   */
  clear(): void {
    this.listeners.clear();
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
