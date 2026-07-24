/**
 * SoulCache Storage Manager
 *
 * Central coordinator for all storage operations.
 *
 * @module storage/storage-manager
 */

import type {
  StorageConfig,
  StorageAdapter,
  StorageStatus,
  StorageMetrics,
  StorageEvent,
  StorageEventHandler,
  StorageEventData,
  PersistedState,
} from './types';
import { SoulCacheStorageError, NotInitializedError } from './errors';
import { PersistenceCoordinator } from './persistence-coordinator';
import { LifecycleManager } from './lifecycle-manager';
import { Diagnostics } from './diagnostics';
import { JsonSerializer } from './serializer/json-serializer';
import { JsonDeserializer } from './deserializer/json-deserializer';
import { MemoryAdapter } from './adapters/memory-adapter';

/**
 * Storage manager.
 *
 * Central coordinator for storage operations.
 * Provides the public interface for persistence operations.
 */
export class StorageManager {
  /** Configuration */
  private readonly config: StorageConfig;

  /** Adapter */
  private adapter: StorageAdapter | null = null;

  /** Persistence coordinator (internal) */
  private readonly coordinator: PersistenceCoordinator;

  /** Lifecycle manager */
  private readonly lifecycleManager: LifecycleManager;

  /** Diagnostics */
  private readonly diagnostics: Diagnostics;

  /** Serializer */
  private readonly serializer: JsonSerializer;

  /** Deserializer */
  private readonly deserializer: JsonDeserializer;

  /** Event handlers */
  private readonly eventHandlers: Map<StorageEvent, Set<StorageEventHandler>> = new Map();

  /** Debounce timer */
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: StorageConfig) {
    this.config = config;
    this.adapter = config.adapter;

    // Create internal components
    this.coordinator = new PersistenceCoordinator({
      prefix: config.prefix ?? 'soulcache',
      selectivePersistence: config.selectivePersistence,
      maxAge: config.maxAge ?? 0,
    });

    this.lifecycleManager = new LifecycleManager();
    this.diagnostics = new Diagnostics();

    // Use custom serializer/deserializer if provided, otherwise use defaults
    this.serializer = (config.serializer as JsonSerializer) ?? new JsonSerializer({
      checksum: config.checksum,
    });

    this.deserializer = (config.deserializer as JsonDeserializer) ?? new JsonDeserializer();
  }

  /**
   * Initialize the storage manager.
   */
  async initialize(): Promise<void> {
    if (this.lifecycleManager.getStatus() !== 'idle') {
      throw new Error(`Cannot initialize: status is "${this.lifecycleManager.getStatus()}"`);
    }

    this.lifecycleManager.setStatus('initializing');

    try {
      // Initialize adapter if provided
      if (this.adapter && !this.adapter.isReady()) {
        await this.adapter.initialize();
      }

      this.lifecycleManager.setStatus('ready');
    } catch (error) {
      this.lifecycleManager.setStatus('error');
      throw error;
    }
  }

  /**
   * Dispose the storage manager.
   */
  async dispose(): Promise<void> {
    if (this.lifecycleManager.isDisposed()) {
      return;
    }

    this.lifecycleManager.setStatus('disposing');

    try {
      // Cancel any pending debounce
      if (this.debounceTimer !== null) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      // Dispose adapter if provided
      if (this.adapter) {
        await this.adapter.dispose();
      }

      this.lifecycleManager.setStatus('disposed');
    } catch (error) {
      this.lifecycleManager.setStatus('error');
      throw error;
    }
  }

  /**
   * Save state to storage.
   *
   * @param state - State to save
   * @param force - Force save (bypass debounce)
   */
  async save(state: PersistedState, force = false): Promise<void> {
    this.ensureReady();

    const startTime = Date.now();

    this.lifecycleManager.setStatus('persisting');
    this.emitEvent('storage.save.start', { timestamp: startTime });

    try {
      await this.coordinator.save(
        this.adapter!,
        state,
        (data) => this.serializer.serialize(data),
        force
      );

      // Update diagnostics
      const serialized = this.serializer.serialize(state);
      this.diagnostics.recordSave(serialized.length);

      const duration = Date.now() - startTime;
      this.lifecycleManager.setStatus('ready');
      this.emitEvent('storage.save.complete', {
        timestamp: Date.now(),
        duration,
        metrics: this.diagnostics.getMetrics(),
      });
    } catch (error) {
      this.diagnostics.recordFailure();
      this.lifecycleManager.setStatus('ready');

      const storageError = error instanceof SoulCacheStorageError
        ? error.toStorageError()
        : {
            type: 'provider_error' as const,
            message: error instanceof Error ? error.message : String(error),
            cause: error instanceof Error ? error : (undefined as Error | undefined),
          };

      this.emitEvent('storage.save.error', {
        timestamp: Date.now(),
        error: storageError,
      });

      // Call error handler if provided
      this.config.onError?.(storageError);

      throw error;
    }
  }

  /**
   * Restore state from storage.
   *
   * @returns Restored state or null if not found
   */
  async restore(): Promise<PersistedState | null> {
    this.ensureReady();

    const startTime = Date.now();

    this.lifecycleManager.setStatus('restoring');
    this.emitEvent('storage.restore.start', { timestamp: startTime });

    try {
      const state = await this.coordinator.restore(
        this.adapter!,
        (data) => this.deserializer.deserialize(data)
      );

      // Update diagnostics
      this.diagnostics.recordRestore();

      const duration = Date.now() - startTime;
      this.lifecycleManager.setStatus('ready');
      this.emitEvent('storage.restore.complete', {
        timestamp: Date.now(),
        duration,
        metrics: this.diagnostics.getMetrics(),
      });

      return state;
    } catch (error) {
      this.diagnostics.recordFailure();
      this.lifecycleManager.setStatus('ready');

      const storageError = error instanceof SoulCacheStorageError
        ? error.toStorageError()
        : {
            type: 'provider_error' as const,
            message: error instanceof Error ? error.message : String(error),
            cause: error instanceof Error ? error : (undefined as Error | undefined),
          };

      this.emitEvent('storage.restore.error', {
        timestamp: Date.now(),
        error: storageError,
      });

      // Call error handler if provided
      this.config.onError?.(storageError);

      throw error;
    }
  }

  /**
   * Clear persisted state.
   */
  async clear(): Promise<void> {
    this.ensureReady();

    const startTime = Date.now();

    this.emitEvent('storage.clear.start', { timestamp: startTime });

    try {
      await this.coordinator.clear(this.adapter!);

      const duration = Date.now() - startTime;
      this.emitEvent('storage.clear.complete', {
        timestamp: Date.now(),
        duration,
      });
    } catch (error) {
      const storageError = error instanceof SoulCacheStorageError
        ? error.toStorageError()
        : {
            type: 'provider_error' as const,
            message: error instanceof Error ? error.message : String(error),
            cause: error instanceof Error ? error : (undefined as Error | undefined),
          };

      this.emitEvent('storage.clear.error', {
        timestamp: Date.now(),
        error: storageError,
      });

      throw error;
    }
  }

  /**
   * Get storage metrics.
   */
  getMetrics(): StorageMetrics {
    return this.diagnostics.getMetrics();
  }

  /**
   * Reset storage metrics.
   */
  resetMetrics(): StorageMetrics {
    const previous = this.diagnostics.getMetrics();
    this.diagnostics.reset();
    return previous;
  }

  /**
   * Get current status.
   */
  getStatus(): StorageStatus {
    return this.lifecycleManager.getStatus();
  }

  /**
   * Check if storage is ready.
   */
  isReady(): boolean {
    return this.lifecycleManager.isReady();
  }

  /**
   * Subscribe to storage events.
   *
   * @param event - Event type
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  on(event: StorageEvent, handler: StorageEventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    return () => {
      this.eventHandlers.get(event)?.delete(handler);
    };
  }

  /**
   * Ensure the manager is ready.
   */
  private ensureReady(): void {
    if (!this.lifecycleManager.isReady()) {
      throw new NotInitializedError(
        `StorageManager is not ready. Current status: ${this.lifecycleManager.getStatus()}`
      );
    }
  }

  /**
   * Emit a storage event.
   */
  private emitEvent(type: StorageEvent, data: Omit<StorageEventData, 'type'>): void {
    const event: StorageEventData = { type, ...data };

    const handlers = this.eventHandlers.get(type);

    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch {
          // Ignore handler errors
        }
      }
    }
  }
}

/**
 * Create a StorageManager instance.
 */
export function createStorageManager(config: StorageConfig): StorageManager {
  return new StorageManager(config);
}

/**
 * Create a StorageManager with memory adapter.
 */
export function createMemoryStorage(): StorageManager {
  return new StorageManager({
    adapter: new MemoryAdapter(),
  });
}
