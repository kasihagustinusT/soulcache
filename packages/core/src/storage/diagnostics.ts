/**
 * SoulCache Diagnostics
 *
 * Collects and reports storage metrics.
 *
 * @module storage/diagnostics
 */

import type { StorageMetrics } from './types';

/**
 * Diagnostics.
 *
 * Collects storage operation metrics for observability.
 */
export class Diagnostics {
  /** Save operation count */
  private saveCount = 0;

  /** Restore operation count */
  private restoreCount = 0;

  /** Migration operation count */
  private migrationCount = 0;

  /** Failure count */
  private failureCount = 0;

  /** Last save timestamp */
  private lastSaveTime: number | null = null;

  /** Last restore timestamp */
  private lastRestoreTime: number | null = null;

  /** Current storage size */
  private storageSize = 0;

  /**
   * Record a save operation.
   *
   * @param size - Size of data saved
   */
  recordSave(size: number): void {
    this.saveCount++;
    this.lastSaveTime = Date.now();
    this.storageSize = size;
  }

  /**
   * Record a restore operation.
   */
  recordRestore(): void {
    this.restoreCount++;
    this.lastRestoreTime = Date.now();
  }

  /**
   * Record a migration operation.
   */
  recordMigration(): void {
    this.migrationCount++;
  }

  /**
   * Record a failure.
   */
  recordFailure(): void {
    this.failureCount++;
  }

  /**
   * Update storage size.
   *
   * @param size - New storage size
   */
  updateStorageSize(size: number): void {
    this.storageSize = size;
  }

  /**
   * Get current metrics.
   */
  getMetrics(): StorageMetrics {
    return {
      saveCount: this.saveCount,
      restoreCount: this.restoreCount,
      migrationCount: this.migrationCount,
      failureCount: this.failureCount,
      lastSaveTime: this.lastSaveTime,
      lastRestoreTime: this.lastRestoreTime,
      storageSize: this.storageSize,
    };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.saveCount = 0;
    this.restoreCount = 0;
    this.migrationCount = 0;
    this.failureCount = 0;
    this.lastSaveTime = null;
    this.lastRestoreTime = null;
    this.storageSize = 0;
  }
}

/**
 * Create a Diagnostics instance.
 */
export function createDiagnostics(): Diagnostics {
  return new Diagnostics();
}
