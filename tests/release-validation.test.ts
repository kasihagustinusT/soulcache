/**
 * SoulCache v1.0.0 Pre-Release Validation
 *
 * Simulates real user usage. Tests TypeScript inference,
 * API correctness, and public exports.
 */

// =============================================
// Core public API imports
// =============================================
import {
  // Cache
  CacheEngine,
  QueryEntry,
  // Query
  QueryStateMachine,
  // Observer
  QueryObserver,
  // Client
  QueryClient,
  // Mutation
  MutationEntry,
  MutationCache,
  MutationObserver,
  // Infinite
  InfiniteQuery,
  // Hydration
  dehydrate,
  hydrate,
  serialize,
  deserialize,
  // Subscription
  SubscriptionManager,
  // Snapshot
  QuerySnapshotManager,
  // Scheduler
  Scheduler,
  createTask,
  PRIORITY_ORDER,
  // Storage
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
  DEFAULT_RETRY_POLICY,
  // Errors
  SoulCacheError,
  ConfigurationError,
  QueryError,
  CacheError,
  RuntimeError,
  // Utils
  generateId,
  // Events
  EventBus,
  // Types
  type QueryKey,
  type QueryStatus,
  type FetchStatus,
  type MutationStatus,
  type RetryPolicy,
  type QueryOptions,
  type RetryConfig,
  type QueryResult,
  type MutationOptions,
  type MutationResult,
  type QuerySnapshot,
  type Observer,
  type QueryClientConfig,
  type DefaultQueryOptions,
  type Logger,
  type CacheEngineOptions,
  type CacheStats,
  type StateTransitionListener,
  type QueryObserverOptions,
  type MutationEntryOptions,
  type MutationCacheOptions,
  type MutationObserverOptions,
  type MutationSnapshot,
  type InfiniteQueryPage,
  type InfiniteQueryState,
  type InfiniteQueryOptions,
  type InfiniteQueryResult,
  type DehydratedQuery,
  type DehydratedState,
  type HydrationOptions,
  type DehydrationOptions,
  type QuerySnapshotState,
  type StructuralShareResult,
  type ScheduledTask,
  type ScheduleTaskOptions,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
  type SchedulerOptions,
  type SchedulerMetrics,
} from '@soulcache/core';

// =============================================
// React public API imports
// =============================================
import {
  SoulCacheProvider,
  useQuery,
  useMutation,
  useQueryClient,
  useIsFetching,
  useIsMutating,
  type QueryStatus as ReactQueryStatus,
  type FetchStatus as ReactFetchStatus,
  type MutationStatus as ReactMutationStatus,
} from '@soulcache/react';

// =============================================
// Type inference validation
// =============================================
const queryKey: QueryKey = ['todos', 1];
const queryKey2: QueryKey = ['user', 'profile', 42];

const status: QueryStatus = 'loading';
const status2: QueryStatus = 'success';
const status3: QueryStatus = 'error';
const status4: QueryStatus = 'idle';
const status5: QueryStatus = 'fetching';

const fetchSt: FetchStatus = 'idle';
const fetchSt2: FetchStatus = 'fetching';
const fetchSt3: FetchStatus = 'paused';

const mutStatus: MutationStatus = 'idle';
const mutStatus2: MutationStatus = 'pending';
const mutStatus3: MutationStatus = 'success';
const mutStatus4: MutationStatus = 'error';

const retryPolicy: RetryPolicy = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
};

const defaultPolicy = DEFAULT_RETRY_POLICY;
void defaultPolicy.maxRetries;
void defaultPolicy.baseDelay;
void defaultPolicy.maxDelay;
void defaultPolicy.backoffMultiplier;

// =============================================
// Core instantiation validation
// =============================================
const cacheEngine = new CacheEngine();
const queryClient = new QueryClient();
const scheduler = new Scheduler();
const memoryAdapter = new MemoryAdapter();
const storageManager = new StorageManager({ adapter: memoryAdapter });
const eventBus = new EventBus();
const subscriptionManager = new SubscriptionManager();
const snapshotManager = new QuerySnapshotManager();

// Cache operations
cacheEngine.set({ queryKey: ['test', 'key'], data: { value: 'hello' } });
const cached = cacheEngine.get(['test', 'key']);
cacheEngine.invalidate(['test', 'key']);
const cacheSize = cacheEngine.size;
const cacheStats = cacheEngine.getStats();
void cached;
void cacheSize;
void cacheStats;

// ID generation
const id = generateId();
void id;

// Storage
const memStorage = createMemoryStorage();
void memStorage;

// Errors
const err = new SoulCacheError({ code: 'SC_FETCH_FAILED', message: 'test' });
void err;

// Serialization
const serializer = createJsonSerializer();
const deserializer = createJsonDeserializer();
void serializer;
void deserializer;

// Hydration
const state = dehydrate(cacheEngine);
const hydrated = hydrate(cacheEngine, state);
void state;
void hydrated;

// Re-export types from React match core types
const reactStatus: ReactQueryStatus = 'loading';
const reactFetch: ReactFetchStatus = 'idle';
const reactMut: ReactMutationStatus = 'pending';
void reactStatus;
void reactFetch;
void reactMut;

// =============================================
// Cleanup
// =============================================
void queryKey;
void queryKey2;
void status; void status2; void status3; void status4; void status5;
void fetchSt; void fetchSt2; void fetchSt3;
void mutStatus; void mutStatus2; void mutStatus3; void mutStatus4;
void retryPolicy;
void cached;
void cacheEngine;
void queryClient;
void scheduler;
void storageManager;
void eventBus;
void subscriptionManager;
void snapshotManager;

export {};
