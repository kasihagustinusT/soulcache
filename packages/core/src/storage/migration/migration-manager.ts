/**
 * SoulCache Migration Manager
 *
 * Coordinates storage migrations between schema versions.
 *
 * @module storage/migration/migration-manager
 */

import type { MigrationStep, MigrationContext, PersistedState } from '../types';
import { MigrationError } from '../errors';

/**
 * Migration manager configuration.
 */
export interface MigrationManagerConfig {
  /** Current schema version */
  currentVersion: number;

  /** Registered migration steps */
  migrations?: MigrationStep[];
}

/**
 * Migration manager.
 *
 * Coordinates version detection, data migration, and rollback.
 */
export class MigrationManager {
  /** Current schema version */
  private readonly currentVersion: number;

  /** Registered migrations indexed by "fromVersion-toVersion" */
  private readonly migrations: Map<string, MigrationStep> = new Map();

  constructor(config: MigrationManagerConfig) {
    this.currentVersion = config.currentVersion;

    // Register provided migrations
    if (config.migrations) {
      for (const migration of config.migrations) {
        this.registerMigration(migration);
      }
    }
  }

  /**
   * Register a migration step.
   *
   * @param migration - Migration step to register
   */
  registerMigration(migration: MigrationStep): void {
    const key = this.getMigrationKey(migration.fromVersion, migration.toVersion);

    if (this.migrations.has(key)) {
      throw new MigrationError(
        `Migration from ${migration.fromVersion} to ${migration.toVersion} already registered`
      );
    }

    this.migrations.set(key, migration);
  }

  /**
   * Get the current schema version.
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * Check if migration is needed.
   *
   * @param dataVersion - Version of persisted data
   * @returns true if migration is needed
   */
  needsMigration(dataVersion: number): boolean {
    return dataVersion !== this.currentVersion;
  }

  /**
   * Check if migration path exists.
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns true if migration path exists
   */
  hasMigrationPath(fromVersion: number, toVersion: number): boolean {
    if (fromVersion === toVersion) {
      return true;
    }

    // Check for direct migration
    const directKey = this.getMigrationKey(fromVersion, toVersion);
    if (this.migrations.has(directKey)) {
      return true;
    }

    // Check for chain of migrations
    return this.findMigrationPath(fromVersion, toVersion).length > 0;
  }

  /**
   * Migrate data from one version to another.
   *
   * @param data - Data to migrate
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns Migrated data
   * @throws MigrationError if migration fails
   */
  migrate(data: PersistedState, fromVersion: number, toVersion: number): PersistedState {
    if (fromVersion === toVersion) {
      return data;
    }

    // Find migration path
    const path = this.findMigrationPath(fromVersion, toVersion);

    if (path.length === 0) {
      throw new MigrationError(
        `No migration path found from version ${fromVersion} to ${toVersion}`
      );
    }

    // Apply migrations in sequence
    let currentData: unknown = data;

    for (const step of path) {
      try {
        currentData = step.migrate(currentData);
      } catch (error) {
        throw new MigrationError(
          `Migration from ${step.fromVersion} to ${step.toVersion} failed`,
          { cause: error instanceof Error ? error : new Error(String(error)) }
        );
      }
    }

    return currentData as PersistedState;
  }

  /**
   * Create a migration context.
   *
   * @param data - Data to migrate
   * @param fromVersion - Source version
   * @returns Migration context
   */
  createContext(data: string, fromVersion: number): MigrationContext {
    const path = this.findMigrationPath(fromVersion, this.currentVersion);

    return {
      fromVersion,
      toVersion: this.currentVersion,
      data,
      migrations: path,
    };
  }

  /**
   * Get all registered migration keys.
   */
  getRegisteredMigrations(): string[] {
    return Array.from(this.migrations.keys());
  }

  /**
   * Clear all registered migrations.
   */
  clear(): void {
    this.migrations.clear();
  }

  /**
   * Find migration path between two versions.
   *
   * Uses BFS to find shortest path.
   *
   * @param fromVersion - Source version
   * @param toVersion - Target version
   * @returns Array of migration steps to apply
   */
  private findMigrationPath(fromVersion: number, toVersion: number): MigrationStep[] {
    if (fromVersion === toVersion) {
      return [];
    }

    // BFS to find path
    const queue: Array<{ version: number; path: MigrationStep[] }> = [
      { version: fromVersion, path: [] }
    ];
    const visited = new Set<number>([fromVersion]);

    while (queue.length > 0) {
      const current = queue.shift()!;

      // Check all possible next versions
      for (const [, step] of this.migrations) {
        let nextVersion: number | null = null;

        if (step.fromVersion === current.version) {
          nextVersion = step.toVersion;
        } else if (step.toVersion === current.version) {
          // Support reverse migration
          nextVersion = step.fromVersion;
        }

        if (nextVersion !== null && !visited.has(nextVersion)) {
          const newPath = [...current.path, step];

          if (nextVersion === toVersion) {
            return newPath;
          }

          visited.add(nextVersion);
          queue.push({ version: nextVersion, path: newPath });
        }
      }
    }

    return [];
  }

  /**
   * Get migration key.
   */
  private getMigrationKey(fromVersion: number, toVersion: number): string {
    return `${fromVersion}-${toVersion}`;
  }
}

/**
 * Create a MigrationManager instance.
 */
export function createMigrationManager(config: MigrationManagerConfig): MigrationManager {
  return new MigrationManager(config);
}
