/**
 * SoulCache Persistence Coordinator
 *
 * Coordinates save and restore operations.
 *
 * @module storage/persistence-coordinator
 */

import type {
  PersistedState,
  StorageAdapter,
  SelectiveFilter,
  CacheEntrySnapshot,
} from './types';
import { SerializationError, DeserializationError } from './errors';

/**
 * Persistence coordinator configuration.
 */
export interface PersistenceCoordinatorConfig {
  /** Storage key prefix */
  prefix?: string | undefined;

  /** Selective persistence filter */
  selectivePersistence?: SelectiveFilter | undefined;

  /** Maximum age in milliseconds (0 = no limit) */
  maxAge?: number | undefined;
}

/**
 * Persistence coordinator.
 *
 * Internal component that coordinates save and restore operations.
 * Owned exclusively by the Storage Layer.
 */
export class PersistenceCoordinator {
  private readonly prefix: string;
  private readonly selectiveFilter?: SelectiveFilter | undefined;
  private readonly maxAge: number;

  constructor(config?: PersistenceCoordinatorConfig) {
    this.prefix = config?.prefix ?? 'soulcache';
    this.selectiveFilter = config?.selectivePersistence;
    this.maxAge = config?.maxAge ?? 0;
  }

  /**
   * Save state to adapter.
   *
   * @param adapter - Storage adapter
   * @param state - State to save
   * @param serializer - Serializer function
   * @param force - Force save (bypass selective filter)
   */
  async save(
    adapter: StorageAdapter,
    state: PersistedState,
    serializer: (data: PersistedState) => string,
    force = false
  ): Promise<void> {
    // Apply selective filter if not forced
    let stateToSave = state;

    if (!force && this.selectiveFilter) {
      stateToSave = this.applySelectiveFilter(state);
    }

    // Apply max age filter if configured
    if (this.maxAge > 0) {
      stateToSave = this.applyMaxAgeFilter(stateToSave);
    }

    // Serialize
    let serialized: string;

    try {
      serialized = serializer(stateToSave);
    } catch (error) {
      throw new SerializationError(
        'Failed to serialize state for persistence',
        { cause: error instanceof Error ? error : new Error(String(error)) }
      );
    }

    // Save to adapter
    const key = this.getStorageKey();
    await adapter.set(key, serialized);
  }

  /**
   * Restore state from adapter.
   *
   * @param adapter - Storage adapter
   * @param deserializer - Deserializer function
   * @returns Restored state or null if not found
   */
  async restore(
    adapter: StorageAdapter,
    deserializer: (data: string) => PersistedState
  ): Promise<PersistedState | null> {
    const key = this.getStorageKey();

    try {
      const data = await adapter.get(key);

      if (data === null) {
        return null;
      }

      return deserializer(data);
    } catch (error) {
      if (error instanceof DeserializationError) {
        // Corrupted data - return null to start fresh
        return null;
      }
      throw error;
    }
  }

  /**
   * Clear persisted state.
   *
   * @param adapter - Storage adapter
   */
  async clear(adapter: StorageAdapter): Promise<void> {
    const key = this.getStorageKey();
    await adapter.delete(key);
  }

  /**
   * Check if persisted data exists.
   *
   * @param adapter - Storage adapter
   */
  async hasData(adapter: StorageAdapter): Promise<boolean> {
    const key = this.getStorageKey();
    return adapter.has(key);
  }

  /**
   * Apply selective filter to state.
   *
   * @param state - Original state
   * @returns Filtered state
   */
  private applySelectiveFilter(state: PersistedState): PersistedState {
    if (!this.selectiveFilter) {
      return state;
    }

    // Filter query cache entries
    const filteredEntries: Record<string, CacheEntrySnapshot> = {};

    for (const [key, entry] of Object.entries(state.queryCache.entries)) {
      if (this.selectiveFilter(key, entry)) {
        filteredEntries[key] = entry;
      }
    }

    return {
      ...state,
      queryCache: {
        ...state.queryCache,
        entries: filteredEntries,
        metadata: {
          entryCount: Object.keys(filteredEntries).length,
          totalSize: state.queryCache.metadata.totalSize, // Approximate
        },
      },
    };
  }

  /**
   * Apply max age filter to state.
   *
   * @param state - Original state
   * @returns Filtered state
   */
  private applyMaxAgeFilter(state: PersistedState): PersistedState {
    if (this.maxAge <= 0) {
      return state;
    }

    const cutoffTime = Date.now() - this.maxAge;

    // Filter query cache entries by age
    const filteredEntries: Record<string, CacheEntrySnapshot> = {};

    for (const [key, entry] of Object.entries(state.queryCache.entries)) {
      if (entry.timestamp >= cutoffTime) {
        filteredEntries[key] = entry;
      }
    }

    return {
      ...state,
      queryCache: {
        ...state.queryCache,
        entries: filteredEntries,
        metadata: {
          entryCount: Object.keys(filteredEntries).length,
          totalSize: state.queryCache.metadata.totalSize,
        },
      },
    };
  }

  /**
   * Get storage key.
   */
  private getStorageKey(): string {
    return `${this.prefix}:state`;
  }
}

/**
 * Create a PersistenceCoordinator instance.
 */
export function createPersistenceCoordinator(
  config?: PersistenceCoordinatorConfig
): PersistenceCoordinator {
  return new PersistenceCoordinator(config);
}
