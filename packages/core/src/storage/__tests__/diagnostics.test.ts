/**
 * Diagnostics Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Diagnostics } from '../diagnostics';

describe('Diagnostics', () => {
  let diagnostics: Diagnostics;

  beforeEach(() => {
    diagnostics = new Diagnostics();
  });

  describe('Recording Operations', () => {
    it('should record a save operation', () => {
      diagnostics.recordSave(1024);

      const metrics = diagnostics.getMetrics();
      expect(metrics.saveCount).toBe(1);
      expect(metrics.lastSaveTime).toBeGreaterThan(0);
      expect(metrics.storageSize).toBe(1024);
    });

    it('should record a restore operation', () => {
      diagnostics.recordRestore();

      const metrics = diagnostics.getMetrics();
      expect(metrics.restoreCount).toBe(1);
      expect(metrics.lastRestoreTime).toBeGreaterThan(0);
    });

    it('should record a migration operation', () => {
      diagnostics.recordMigration();

      const metrics = diagnostics.getMetrics();
      expect(metrics.migrationCount).toBe(1);
    });

    it('should record a failure', () => {
      diagnostics.recordFailure();

      const metrics = diagnostics.getMetrics();
      expect(metrics.failureCount).toBe(1);
    });

    it('should track multiple saves', () => {
      diagnostics.recordSave(100);
      diagnostics.recordSave(200);
      diagnostics.recordSave(300);

      const metrics = diagnostics.getMetrics();
      expect(metrics.saveCount).toBe(3);
      expect(metrics.storageSize).toBe(300);
    });
  });

  describe('Metrics', () => {
    it('should return initial metrics', () => {
      const metrics = diagnostics.getMetrics();

      expect(metrics.saveCount).toBe(0);
      expect(metrics.restoreCount).toBe(0);
      expect(metrics.migrationCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.lastSaveTime).toBeNull();
      expect(metrics.lastRestoreTime).toBeNull();
      expect(metrics.storageSize).toBe(0);
    });

    it('should track storage size', () => {
      diagnostics.recordSave(1024);
      expect(diagnostics.getMetrics().storageSize).toBe(1024);

      diagnostics.updateStorageSize(2048);
      expect(diagnostics.getMetrics().storageSize).toBe(2048);
    });
  });

  describe('Reset', () => {
    it('should reset all diagnostics', () => {
      diagnostics.recordSave(100);
      diagnostics.recordRestore();
      diagnostics.recordFailure();

      diagnostics.reset();

      const metrics = diagnostics.getMetrics();
      expect(metrics.saveCount).toBe(0);
      expect(metrics.restoreCount).toBe(0);
      expect(metrics.migrationCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
      expect(metrics.lastSaveTime).toBeNull();
      expect(metrics.lastRestoreTime).toBeNull();
      expect(metrics.storageSize).toBe(0);
    });
  });
});
