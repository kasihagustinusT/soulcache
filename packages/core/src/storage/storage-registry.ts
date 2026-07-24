/**
 * SoulCache Storage Registry
 *
 * Maintains registered storage adapters.
 *
 * @module storage/storage-registry
 */

import type { StorageAdapter } from './types';
import { AdapterNotFoundError } from './errors';

/**
 * Storage registry.
 *
 * Maintains a registry of named storage adapters.
 * Provides adapter discovery, registration, and removal.
 */
export class StorageRegistry {
  /** Registered adapters */
  private readonly adapters: Map<string, StorageAdapter> = new Map();

  /**
   * Register a storage adapter.
   *
   * @param adapter - Adapter to register
   * @throws Error if adapter with same name already exists
   */
  register(adapter: StorageAdapter): void {
    const name = adapter.name;

    if (this.adapters.has(name)) {
      throw new Error(`Adapter "${name}" is already registered.`);
    }

    this.adapters.set(name, adapter);
  }

  /**
   * Unregister a storage adapter.
   *
   * @param name - Name of adapter to unregister
   * @returns true if adapter was removed, false if not found
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Get a registered adapter by name.
   *
   * @param name - Name of adapter to retrieve
   * @returns The adapter, or undefined if not found
   */
  get(name: string): StorageAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get a registered adapter by name.
   *
   * @param name - Name of adapter to retrieve
   * @returns The adapter
   * @throws AdapterNotFoundError if adapter not found
   */
  getOrThrow(name: string): StorageAdapter {
    const adapter = this.adapters.get(name);

    if (!adapter) {
      throw new AdapterNotFoundError(`Adapter "${name}" not found.`);
    }

    return adapter;
  }

  /**
   * Check if an adapter is registered.
   *
   * @param name - Name to check
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * Get all registered adapter names.
   */
  getNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Get all registered adapters.
   */
  getAll(): StorageAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Get the number of registered adapters.
   */
  getSize(): number {
    return this.adapters.size;
  }

  /**
   * Clear all registered adapters.
   */
  clear(): void {
    this.adapters.clear();
  }
}

/**
 * Create a new StorageRegistry instance.
 */
export function createStorageRegistry(): StorageRegistry {
  return new StorageRegistry();
}
