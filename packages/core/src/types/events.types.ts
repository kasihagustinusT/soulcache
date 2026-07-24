/**
 * SoulCache Event Types
 *
 * All internal runtime events.
 */

/** Query lifecycle events */
export type QueryEventType =
  | 'query.created'
  | 'query.started'
  | 'query.success'
  | 'query.error'
  | 'query.invalidated'
  | 'query.removed'
  | 'query.destroyed';

/** Cache events */
export type CacheEventType =
  | 'cache.hit'
  | 'cache.miss'
  | 'cache.updated'
  | 'cache.removed'
  | 'cache.invalidated';

/** Fetch events */
export type FetchEventType =
  | 'fetch.started'
  | 'fetch.completed'
  | 'fetch.failed'
  | 'fetch.cancelled';

/** Mutation events */
export type MutationEventType =
  | 'mutation.started'
  | 'mutation.success'
  | 'mutation.error';

/** Scheduler events */
export type SchedulerEventType =
  | 'scheduler.flush'
  | 'scheduler.batch'
  | 'scheduler.task-registered'
  | 'scheduler.task-started'
  | 'scheduler.task-completed'
  | 'scheduler.task-failed'
  | 'scheduler.task-cancelled'
  | 'scheduler.batch-started'
  | 'scheduler.batch-completed'
  | 'scheduler.destroyed';

/** Storage events */
export type StorageEventType =
  | 'storage.save.start'
  | 'storage.save.complete'
  | 'storage.save.error'
  | 'storage.restore.start'
  | 'storage.restore.complete'
  | 'storage.restore.error'
  | 'storage.migration.start'
  | 'storage.migration.complete'
  | 'storage.migration.error'
  | 'storage.clear.start'
  | 'storage.clear.complete'
  | 'storage.clear.error';

/** All event types */
export type RuntimeEventType =
  | QueryEventType
  | CacheEventType
  | FetchEventType
  | MutationEventType
  | SchedulerEventType
  | StorageEventType;

/**
 * Event Source
 *
 * Identifies the originating subsystem.
 */
export type EventSource =
  | 'query-runtime'
  | 'cache-engine'
  | 'fetch-engine'
  | 'scheduler'
  | 'observer'
  | 'storage'
  | 'internal';

/**
 * Event Payload
 *
 * Base interface for all event payloads.
 */
export interface EventPayload {
  readonly [key: string]: unknown;
}

/**
 * Query Event Payload
 */
export interface QueryEventPayload extends EventPayload {
  readonly queryId: string;
  readonly queryKey: readonly unknown[];
}

/**
 * Cache Event Payload
 */
export interface CacheEventPayload extends EventPayload {
  readonly queryId: string;
  readonly queryKey: readonly unknown[];
}

/**
 * Event Envelope
 *
 * The complete event object passed through the event system.
 */
export interface RuntimeEvent<T extends EventPayload = EventPayload> {
  /** Unique event identifier */
  readonly id: string;

  /** Event type */
  readonly type: RuntimeEventType;

  /** Creation timestamp */
  readonly timestamp: number;

  /** Originating subsystem */
  readonly source: EventSource;

  /** Event-specific data */
  readonly payload: T;

  /** Additional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Event Handler
 *
 * A function that handles runtime events.
 */
export type EventHandler<T extends EventPayload = EventPayload> = (event: RuntimeEvent<T>) => void;

/**
 * Event Unsubscriber
 *
 * A function that removes an event subscription.
 */
export type EventUnsubscriber = () => void;
