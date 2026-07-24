/**
 * SoulCache Storage Layer
 *
 * Framework-independent storage abstraction for cache persistence.
 *
 * @module storage
 */

// ============================================================================
// Types
// ============================================================================
// Re-export runtime value first
export { DEFAULT_RETRY_POLICY } from './types';

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
} from './types';

// ============================================================================
// Errors
// ============================================================================
export {
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
} from './errors';

// ============================================================================
// Adapters
// ============================================================================
export { MemoryAdapter, createMemoryAdapter } from './adapters/memory-adapter';

// ============================================================================
// Serializer
// ============================================================================
export {
  JsonSerializer,
  createJsonSerializer,
  isSupportedAlgorithm,
} from './serializer/json-serializer';
export type { JsonSerializerConfig } from './serializer/json-serializer';

// ============================================================================
// Deserializer
// ============================================================================
export { JsonDeserializer, createJsonDeserializer } from './deserializer/json-deserializer';
export type { JsonDeserializerConfig } from './deserializer/json-deserializer';

// ============================================================================
// Migration
// ============================================================================
export {
  MigrationManager,
  createMigrationManager,
} from './migration/migration-manager';
export type { MigrationManagerConfig } from './migration/migration-manager';

// ============================================================================
// Persistence Coordinator (Internal)
// ============================================================================
export {
  PersistenceCoordinator,
  createPersistenceCoordinator,
} from './persistence-coordinator';
export type { PersistenceCoordinatorConfig } from './persistence-coordinator';

// ============================================================================
// Restore Manager
// ============================================================================
export { RestoreManager, createRestoreManager } from './restore-manager';
export type { RestoreManagerConfig } from './restore-manager';

// ============================================================================
// Lifecycle Manager
// ============================================================================
export {
  LifecycleManager,
  createLifecycleManager,
} from './lifecycle-manager';
export type { LifecycleEvent, LifecycleEventHandler } from './lifecycle-manager';

// ============================================================================
// Diagnostics
// ============================================================================
export { Diagnostics, createDiagnostics } from './diagnostics';

// ============================================================================
// Storage Manager
// ============================================================================
export {
  StorageManager,
  createStorageManager,
  createMemoryStorage,
} from './storage-manager';

// ============================================================================
// Registry
// ============================================================================
export { StorageRegistry, createStorageRegistry } from './storage-registry';
