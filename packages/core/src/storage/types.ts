/**
 * SoulCache Storage Types
 *
 * Core type definitions for the Storage Layer.
 *
 * @module storage/types
 */

// ============================================================================
// Storage Provider Types
// ============================================================================

/**
 * Storage adapter interface.
 *
 * All storage adapters must implement this interface.
 */
export interface StorageAdapter {
  /** Unique adapter name */
  readonly name: string;

  /** Core Operations */
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;

  /** Enumeration */
  keys(): Promise<string[]>;

  /** Size Management */
  getSize(): Promise<number>;
  getUsage(): Promise<StorageUsage>;

  /** Lifecycle */
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  isReady(): boolean;
}

/**
 * Storage usage information.
 */
export interface StorageUsage {
  /** Bytes used */
  readonly used: number;

  /** Bytes available (null if unknown) */
  readonly available: number | null;

  /** Usage percentage (null if unknown) */
  readonly percentage: number | null;
}

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Storage manager configuration.
 */
export interface StorageConfig {
  /** Storage adapter to use */
  adapter: StorageAdapter;

  /** Key prefix for all stored items */
  prefix?: string | undefined;

  /** Schema version for persistence format */
  version?: number | undefined;

  /** Debounce delay in milliseconds for persistence operations */
  debounceMs?: number | undefined;

  /** Maximum age in milliseconds for cached entries (0 = no limit) */
  maxAge?: number | undefined;

  /** Selective persistence filter */
  selectivePersistence?: SelectiveFilter | undefined;

  /** Custom serializer */
  serializer?: Serializer | undefined;

  /** Custom deserializer */
  deserializer?: Deserializer | undefined;

  /** Error handler callback */
  onError?: (error: StorageError) => void;

  /** Checksum configuration */
  checksum?: ChecksumConfig | undefined;
}

/**
 * Selective persistence filter function.
 *
 * Returns true if the entry should be persisted.
 */
export type SelectiveFilter = (key: string, entry: CacheEntrySnapshot) => boolean;

// ============================================================================
// Serialization Types
// ============================================================================

/**
 * Serializer interface.
 *
 * Transforms PersistedState into a string for storage.
 */
export interface Serializer {
  serialize(data: PersistedState): string;
}

/**
 * Deserializer interface.
 *
 * Reconstructs PersistedState from a stored string.
 */
export interface Deserializer {
  deserialize(data: string): PersistedState;
}

/**
 * Supported checksum algorithms.
 */
export type ChecksumAlgorithm = 'sha-256' | 'sha-384' | 'sha-512' | 'md5';

/**
 * Checksum configuration.
 */
export interface ChecksumConfig {
  /** Algorithm to use for checksum calculation */
  algorithm: ChecksumAlgorithm;

  /** Whether checksum is required (default: false) */
  required?: boolean;
}

/**
 * Checksum information included in persisted data.
 */
export interface ChecksumInfo {
  /** Checksum algorithm identifier */
  readonly algorithm: ChecksumAlgorithm;

  /** Hex-encoded checksum value */
  readonly value: string;
}

// ============================================================================
// Persistence Types
// ============================================================================

/**
 * Persisted state format.
 */
export interface PersistedState {
  /** Schema version */
  readonly version: number;

  /** Timestamp of persistence */
  readonly timestamp: number;

  /** Checksum information (optional) */
  readonly checksum?: ChecksumInfo;

  /** Query cache snapshot */
  readonly queryCache: QueryCacheSnapshot;

  /** Mutation cache snapshot */
  readonly mutationCache: MutationCacheSnapshot;

  /** Persistence metadata */
  readonly metadata: PersistenceMetadata;
}

/**
 * Query cache snapshot for persistence.
 */
export interface QueryCacheSnapshot {
  /** Cache entries */
  readonly entries: Record<string, CacheEntrySnapshot>;

  /** Cache metadata */
  readonly metadata: CacheMetadata;
}

/**
 * Mutation cache snapshot for persistence.
 */
export interface MutationCacheSnapshot {
  /** Mutation entries */
  readonly entries: Record<string, MutationEntrySnapshot>;

  /** Mutation metadata */
  readonly metadata: MutationMetadata;
}

/**
 * Single cache entry snapshot.
 */
export interface CacheEntrySnapshot {
  /** Cached data payload */
  readonly data: unknown;

  /** Entry timestamp */
  readonly timestamp: number;

  /** Entry status */
  readonly status: string;

  /** Fetch count */
  readonly fetchCount: number;

  /** Garbage collection count */
  readonly GCCount: number;
}

/**
 * Single mutation entry snapshot.
 */
export interface MutationEntrySnapshot {
  /** Mutation data */
  readonly data: unknown;

  /** Mutation status */
  readonly status: string;

  /** Timestamp */
  readonly timestamp: number;
}

/**
 * Cache metadata.
 */
export interface CacheMetadata {
  /** Number of entries */
  readonly entryCount: number;

  /** Total size in bytes (estimated) */
  readonly totalSize: number;
}

/**
 * Mutation metadata.
 */
export interface MutationMetadata {
  /** Number of entries */
  readonly entryCount: number;

  /** Total size in bytes (estimated) */
  readonly totalSize: number;
}

/**
 * Persistence metadata.
 */
export interface PersistenceMetadata {
  /** Last update timestamp */
  readonly lastUpdated: number;

  /** Schema version */
  readonly schemaVersion: number;

  /** Adapter name used for persistence */
  readonly adapterName?: string;
}

// ============================================================================
// Storage Manager Types
// ============================================================================

/**
 * Storage manager status.
 */
export type StorageStatus =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'persisting'
  | 'restoring'
  | 'migrating'
  | 'disposing'
  | 'disposed'
  | 'error';

/**
 * Storage metrics.
 */
export interface StorageMetrics {
  /** Number of save operations */
  readonly saveCount: number;

  /** Number of restore operations */
  readonly restoreCount: number;

  /** Number of migration operations */
  readonly migrationCount: number;

  /** Number of failed operations */
  readonly failureCount: number;

  /** Timestamp of last save */
  readonly lastSaveTime: number | null;

  /** Timestamp of last restore */
  readonly lastRestoreTime: number | null;

  /** Current storage size in bytes */
  readonly storageSize: number;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Storage event types.
 */
export type StorageEvent =
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

/**
 * Storage event handler function.
 */
export type StorageEventHandler = (event: StorageEventData) => void;

/**
 * Storage event data.
 */
export interface StorageEventData {
  /** Event type */
  readonly type: StorageEvent;

  /** Event timestamp */
  readonly timestamp: number;

  /** Operation duration in milliseconds */
  readonly duration?: number;

  /** Error information if operation failed */
  readonly error?: StorageError;

  /** Storage metrics snapshot */
  readonly metrics?: Partial<StorageMetrics>;

  /** Number of entries affected */
  readonly entryCount?: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Storage error types.
 */
export type StorageErrorType =
  | 'serialization_failed'
  | 'deserialization_failed'
  | 'provider_error'
  | 'migration_failed'
  | 'validation_failed'
  | 'corrupted_data'
  | 'checksum_mismatch'
  | 'unknown_algorithm'
  | 'version_incompatible'
  | 'adapter_not_found'
  | 'not_initialized'
  | 'already_disposed';

/**
 * Storage error interface.
 */
export interface StorageError {
  /** Error type */
  readonly type: StorageErrorType;

  /** Error message */
  readonly message: string;

  /** Optional key involved in the error */
  readonly key?: string | undefined;

  /** Original error cause */
  readonly cause?: Error | undefined;
}

// ============================================================================
// Internal Types
// ============================================================================

/**
 * Internal storage state.
 */
export interface StorageState {
  /** Current status */
  status: StorageStatus;

  /** Active adapter */
  adapter: StorageAdapter | null;

  /** Configuration */
  config: StorageConfig;

  /** Metrics */
  metrics: StorageMetrics;

  /** Pending writes (for debouncing) */
  pendingWrites: Map<string, string>;

  /** Last persisted schema version */
  lastPersistedVersion: number | null;
}

/**
 * Persistence context for save operations.
 */
export interface PersistenceContext {
  /** State to persist */
  state: PersistedState;

  /** Timestamp */
  timestamp: number;

  /** Whether this is a forced save */
  forced: boolean;

  /** Optional list of keys to persist (selective) */
  selectedKeys?: string[];
}

/**
 * Migration context.
 */
export interface MigrationContext {
  /** Source version */
  fromVersion: number;

  /** Target version */
  toVersion: number;

  /** Raw data to migrate */
  data: string;

  /** Migration steps to apply */
  migrations: MigrationStep[];
}

/**
 * Single migration step.
 */
export interface MigrationStep {
  /** Source version for this step */
  fromVersion: number;

  /** Target version for this step */
  toVersion: number;

  /** Migration function */
  migrate: (data: unknown) => unknown;
}

/**
 * Recovery strategy interface.
 */
export interface RecoveryStrategy {
  /** Check if this strategy can recover from the given error */
  canRecover(error: StorageError): boolean;

  /** Attempt recovery */
  recover(error: StorageError): Promise<RecoveryResult>;
}

/**
 * Recovery result.
 */
export type RecoveryResult =
  | { readonly success: true; readonly data: PersistedState }
  | { readonly success: false; readonly reason: string };

/**
 * Retry policy configuration.
 */
export interface RetryPolicy {
  /** Maximum number of retries */
  readonly maxRetries: number;

  /** Base delay in milliseconds */
  readonly baseDelay: number;

  /** Maximum delay in milliseconds */
  readonly maxDelay: number;

  /** Backoff multiplier */
  readonly backoffMultiplier: number;
}

/**
 * Default retry policy.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
} as const;
