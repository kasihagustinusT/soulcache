/**
 * Query Types
 *
 * @module types
 */

export type { QueryKey, QueryStatus, FetchStatus, MutationStatus, Updater } from './query.types';

export type {
  QueryOptions,
  RetryConfig,
  QueryResult,
} from './query-options.types';

export type {
  MutationOptions,
  MutationResult,
} from './mutation.types';

export type {
  QuerySnapshot,
  Observer,
} from './observer.types';

export type {
  QueryClientConfig,
  DefaultQueryOptions,
  Logger,
  QueryClientInstance,
} from './client.types';

export type {
  RuntimeEventType,
  QueryEventType,
  CacheEventType,
  FetchEventType,
  MutationEventType,
  SchedulerEventType,
  StorageEventType,
  EventSource,
  EventPayload,
  QueryEventPayload,
  CacheEventPayload,
  RuntimeEvent,
  EventHandler,
  EventUnsubscriber,
} from './events.types';

export type {
  QueryRecord,
  QueryRecordState,
  QueryRecordFetchStatus,
  QueryRecordMetadata,
} from './internal.types';

export type {
  InfiniteQueryPage,
  InfiniteQueryState,
  InfiniteQueryOptions,
  InfiniteQueryResult,
} from './infinite-query.types';

export type {
  DehydratedQuery,
  DehydratedState,
  HydrationOptions,
  DehydrationOptions,
} from './hydration.types';
