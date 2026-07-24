/**
 * SoulCache Core Runtime
 *
 * @packageDocumentation
 */

// Types
export type {
  QueryKey,
  QueryStatus,
  FetchStatus,
  MutationStatus,
  Updater,
  QueryOptions,
  RetryConfig,
  QueryResult,
  MutationOptions,
  MutationResult,
  QuerySnapshot,
  Observer,
  QueryClientConfig,
  DefaultQueryOptions,
  Logger,
  QueryClientInstance,
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
} from './types';

// Errors
export {
  ErrorCode,
  SoulCacheError,
  ConfigurationError,
  QueryError,
  CacheError,
  RuntimeError,
} from './errors';

// Cache Engine
export { CacheEngine, QueryEntry } from './cache';
export type { CacheEngineOptions, CacheStats } from './cache';

// Utils
export { generateId } from './utils';

// Events
export { EventBus } from './events';

// Query State Machine
export { QueryStateMachine } from './query';
export type { StateTransitionListener } from './query';

// Observer
export { QueryObserver } from './observer';
export type { QueryObserverOptions } from './observer';

// Query Client
export { QueryClient } from './client';

// Mutation Runtime
export { MutationEntry, MutationCache, MutationObserver } from './mutation';
export type {
  MutationEntryOptions,
  MutationCacheOptions,
  MutationObserverOptions,
  MutationSnapshot,
} from './mutation';

// Infinite Query Runtime
export { InfiniteQuery } from './infinite';
export type {
  InfiniteQueryPage,
  InfiniteQueryState,
  InfiniteQueryOptions,
  InfiniteQueryResult,
} from './types/infinite-query.types';

// Hydration Runtime
export { dehydrate, hydrate, serialize, deserialize } from './hydration';
export type {
  DehydratedQuery,
  DehydratedState,
  HydrationOptions,
  DehydrationOptions,
} from './types/hydration.types';

// Universal Subscription Runtime
export { SubscriptionManager } from './subscription';

// Query Snapshot Manager
export { QuerySnapshotManager } from './snapshot';
export type { QuerySnapshotState, StructuralShareResult } from './snapshot';

// Scheduler & Batching Runtime
export { Scheduler, createTask, PRIORITY_ORDER } from './scheduler';
export type {
  ScheduledTask,
  ScheduleTaskOptions,
  TaskCategory,
  TaskPriority,
  TaskStatus,
  SchedulerOptions,
  SchedulerMetrics,
} from './scheduler';

// Storage & Persistence Runtime
export {
  StorageManager,
  createStorageManager,
  createMemoryStorage,
  MemoryAdapter,
  createMemoryAdapter,
  JsonSerializer,
  createJsonSerializer,
  JsonDeserializer,
  createJsonDeserializer,
  MigrationManager,
  createMigrationManager,
  RestoreManager,
  createRestoreManager,
  LifecycleManager,
  createLifecycleManager,
  Diagnostics,
  createDiagnostics,
  PersistenceCoordinator,
  createPersistenceCoordinator,
  StorageRegistry,
  createStorageRegistry,
  SoulCacheStorageError,
  SerializationError,
  DeserializationError,
  ProviderError,
  MigrationError,
  ValidationError,
  CorruptedDataError,
  ChecksumMismatchError,
  UnknownAlgorithmError,
  VersionIncompatibleError,
  AdapterNotFoundError,
  NotInitializedError,
  AlreadyDisposedError,
  createStorageError,
  isStorageError,
} from './storage';

// Re-export runtime value from storage
export { DEFAULT_RETRY_POLICY } from './storage';

export type {
  StorageAdapter,
  StorageUsage,
  StorageConfig,
  SelectiveFilter,
  Serializer,
  Deserializer,
  ChecksumAlgorithm,
  ChecksumConfig,
  ChecksumInfo,
  PersistedState,
  QueryCacheSnapshot,
  MutationCacheSnapshot,
  CacheEntrySnapshot,
  MutationEntrySnapshot,
  CacheMetadata,
  MutationMetadata,
  PersistenceMetadata,
  StorageStatus,
  StorageMetrics,
  StorageEvent,
  StorageEventHandler,
  StorageEventData,
  StorageErrorType,
  StorageError,
  StorageState,
  PersistenceContext,
  MigrationContext,
  MigrationStep,
  RecoveryStrategy,
  RecoveryResult,
  RetryPolicy,
  JsonSerializerConfig,
  JsonDeserializerConfig,
  MigrationManagerConfig,
  PersistenceCoordinatorConfig,
  RestoreManagerConfig,
  LifecycleEvent,
  LifecycleEventHandler,
} from './storage';
