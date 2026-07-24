/**
 * SoulCache Memory Adapter
 *
 * In-memory storage adapter for testing and development.
 *
 * @module storage/adapters/memory
 */

import type { StorageAdapter, StorageUsage } from '../types';

/**
 * Memory storage adapter.
 *
 * Stores data in a Map. Useful for testing, SSR, and development.
 * Data is lost when the process exits.
 */
export class MemoryAdapter implements StorageAdapter {
  /** Adapter name */
  readonly name = 'memory';

  /** Internal storage */
  private readonly store: Map<string, string> = new Map();

  /** Ready state */
  private ready = false;

  /**
   * Get a value by key.
   */
  async get(key: string): Promise<string | null> {
    this.ensureReady();
    return this.store.get(key) ?? null;
  }

  /**
   * Set a key-value pair.
   */
  async set(key: string, value: string): Promise<void> {
    this.ensureReady();
    this.store.set(key, value);
  }

  /**
   * Delete a key.
   */
  async delete(key: string): Promise<void> {
    this.ensureReady();
    this.store.delete(key);
  }

  /**
   * Clear all entries.
   */
  async clear(): Promise<void> {
    this.ensureReady();
    this.store.clear();
  }

  /**
   * Check if a key exists.
   */
  async has(key: string): Promise<boolean> {
    this.ensureReady();
    return this.store.has(key);
  }

  /**
   * Get all keys.
   */
  async keys(): Promise<string[]> {
    this.ensureReady();
    return Array.from(this.store.keys());
  }

  /**
   * Get the number of entries.
   */
  async getSize(): Promise<number> {
    this.ensureReady();
    return this.store.size;
  }

  /**
   * Get storage usage information.
   */
  async getUsage(): Promise<StorageUsage> {
    this.ensureReady();

    // Estimate size by serializing all values
    let totalSize = 0;
    for (const value of this.store.values()) {
      totalSize += value.length * 2; // Approximate UTF-16 encoding
    }

    return {
      used: totalSize,
      available: null, // Unlimited in memory
      percentage: null,
    };
  }

  /**
   * Initialize the adapter.
   */
  async initialize(): Promise<void> {
    this.ready = true;
  }

  /**
   * Dispose the adapter and clear all data.
   */
  async dispose(): Promise<void> {
    this.store.clear();
    this.ready = false;
  }

  /**
   * Check if the adapter is ready.
   */
  isReady(): boolean {
    return this.ready;
  }

  /**
   * Ensure the adapter is ready.
   */
  private ensureReady(): void {
    if (!this.ready) {
      throw new Error('MemoryAdapter is not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create a new MemoryAdapter instance.
 */
export function createMemoryAdapter(): MemoryAdapter {
  return new MemoryAdapter();
}
