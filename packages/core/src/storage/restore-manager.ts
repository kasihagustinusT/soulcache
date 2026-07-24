/**
 * SoulCache Restore Manager
 *
 * Coordinates cache restoration during runtime initialization.
 *
 * @module storage/restore-manager
 */

import type { PersistedState, StorageAdapter } from './types';
import { DeserializationError, CorruptedDataError } from './errors';

/**
 * Restore manager configuration.
 */
export interface RestoreManagerConfig {
  /** Storage key prefix */
  prefix?: string;
}

/**
 * Restore manager.
 *
 * Coordinates restoration of persisted cache state.
 */
export class RestoreManager {
  private readonly prefix: string;

  constructor(config?: RestoreManagerConfig) {
    this.prefix = config?.prefix ?? 'soulcache';
  }

  /**
   * Restore state from adapter.
   *
   * @param adapter - Storage adapter to read from
   * @param deserialize - Deserializer function
   * @returns Restored state or null if not found
   */
  async restore(
    adapter: StorageAdapter,
    deserialize: (data: string) => PersistedState
  ): Promise<PersistedState | null> {
    const key = this.getStorageKey();

    try {
      const data = await adapter.get(key);

      if (data === null) {
        return null;
      }

      return deserialize(data);
    } catch (error) {
      if (error instanceof DeserializationError || error instanceof CorruptedDataError) {
        // Corrupted data - return null to start fresh
        return null;
      }
      throw error;
    }
  }

  /**
   * Check if persisted data exists.
   *
   * @param adapter - Storage adapter to check
   * @returns true if data exists
   */
  async hasData(adapter: StorageAdapter): Promise<boolean> {
    const key = this.getStorageKey();
    return adapter.has(key);
  }

  /**
   * Remove persisted data.
   *
   * @param adapter - Storage adapter to delete from
   */
  async remove(adapter: StorageAdapter): Promise<void> {
    const key = this.getStorageKey();
    await adapter.delete(key);
  }

  /**
   * Get the storage key.
   */
  private getStorageKey(): string {
    return `${this.prefix}:state`;
  }
}

/**
 * Create a RestoreManager instance.
 */
export function createRestoreManager(config?: RestoreManagerConfig): RestoreManager {
  return new RestoreManager(config);
}
