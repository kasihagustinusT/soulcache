import { describe, it, expect, beforeEach } from 'vitest';
import { createDiagnostics } from '../diagnostics';
import type { CacheStatsSnapshot, SchedulerMetricsSnapshot } from '../types';

describe('Diagnostics', () => {
  describe('createDiagnostics', () => {
    let diagnostics: ReturnType<typeof createDiagnostics>;

    const emptyCacheStats: CacheStatsSnapshot = {
      size: 0,
      activeEntries: 0,
      gcEligibleEntries: 0,
      totalAccesses: 0,
    };

    const emptySchedulerMetrics: SchedulerMetricsSnapshot = {
      totalScheduled: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalCancelled: 0,
      queueSize: 0,
      activeTaskCount: 0,
      flushCount: 0,
      batchCount: 0,
    };

    beforeEach(() => {
      diagnostics = createDiagnostics(100, 1000);
    });

    it('should report healthy when everything is fine', () => {
      const cacheStats: CacheStatsSnapshot = { size: 5, activeEntries: 3, gcEligibleEntries: 0, totalAccesses: 50 };
      const schedulerMetrics: SchedulerMetricsSnapshot = {
        totalScheduled: 20, totalCompleted: 20, totalFailed: 0, totalCancelled: 0,
        queueSize: 0, activeTaskCount: 0, flushCount: 10, batchCount: 5,
      };
      const report = diagnostics.checkHealth(cacheStats, schedulerMetrics);
      expect(report.status).toBe('healthy');
      expect(report.issues).toHaveLength(0);
    });

    it('should detect high cache utilization', () => {
      const cacheStats: CacheStatsSnapshot = { size: 95, activeEntries: 10, gcEligibleEntries: 5, totalAccesses: 200 };
      const report = diagnostics.checkHealth(cacheStats, emptySchedulerMetrics);
      expect(report.status).toBe('degraded');
      expect(report.issues.some((i) => i.code === 'CACHE_HIGH_UTILIZATION')).toBe(true);
    });

    it('should detect full cache', () => {
      const cacheStats: CacheStatsSnapshot = { size: 100, activeEntries: 10, gcEligibleEntries: 5, totalAccesses: 200 };
      const report = diagnostics.checkHealth(cacheStats, emptySchedulerMetrics);
      expect(report.status).toBe('unhealthy');
      expect(report.issues.some((i) => i.code === 'CACHE_FULL')).toBe(true);
    });

    it('should detect GC pressure', () => {
      const cacheStats: CacheStatsSnapshot = { size: 20, activeEntries: 2, gcEligibleEntries: 15, totalAccesses: 50 };
      const report = diagnostics.checkHealth(cacheStats, emptySchedulerMetrics);
      expect(report.issues.some((i) => i.code === 'GC_PRESSURE')).toBe(true);
    });

    it('should detect high scheduler queue', () => {
      const schedulerMetrics: SchedulerMetricsSnapshot = {
        totalScheduled: 100, totalCompleted: 100, totalFailed: 0, totalCancelled: 0,
        queueSize: 850, activeTaskCount: 0, flushCount: 50, batchCount: 25,
      };
      const report = diagnostics.checkHealth(emptyCacheStats, schedulerMetrics);
      expect(report.issues.some((i) => i.code === 'SCHEDULER_QUEUE_HIGH')).toBe(true);
    });

    it('should detect full scheduler queue', () => {
      const schedulerMetrics: SchedulerMetricsSnapshot = {
        totalScheduled: 100, totalCompleted: 100, totalFailed: 0, totalCancelled: 0,
        queueSize: 1000, activeTaskCount: 0, flushCount: 50, batchCount: 25,
      };
      const report = diagnostics.checkHealth(emptyCacheStats, schedulerMetrics);
      expect(report.status).toBe('unhealthy');
      expect(report.issues.some((i) => i.code === 'SCHEDULER_QUEUE_FULL')).toBe(true);
    });

    it('should detect high failure rate', () => {
      const schedulerMetrics: SchedulerMetricsSnapshot = {
        totalScheduled: 100, totalCompleted: 85, totalFailed: 15, totalCancelled: 0,
        queueSize: 0, activeTaskCount: 0, flushCount: 50, batchCount: 25,
      };
      const report = diagnostics.checkHealth(emptyCacheStats, schedulerMetrics);
      expect(report.issues.some((i) => i.code === 'HIGH_FAILURE_RATE')).toBe(true);
    });

    it('should detect critical failure rate', () => {
      const schedulerMetrics: SchedulerMetricsSnapshot = {
        totalScheduled: 100, totalCompleted: 40, totalFailed: 60, totalCancelled: 0,
        queueSize: 0, activeTaskCount: 0, flushCount: 50, batchCount: 25,
      };
      const report = diagnostics.checkHealth(emptyCacheStats, schedulerMetrics);
      expect(report.status).toBe('unhealthy');
      expect(report.issues.some((i) => i.code === 'CRITICAL_FAILURE_RATE')).toBe(true);
    });

    it('should detect low cache efficiency', () => {
      const cacheStats: CacheStatsSnapshot = { size: 100, activeEntries: 0, gcEligibleEntries: 0, totalAccesses: 50 };
      const report = diagnostics.checkHealth(cacheStats, emptySchedulerMetrics);
      expect(report.issues.some((i) => i.code === 'LOW_CACHE_EFFICIENCY')).toBe(true);
    });

    it('should detect no active observers', () => {
      const cacheStats: CacheStatsSnapshot = { size: 10, activeEntries: 0, gcEligibleEntries: 0, totalAccesses: 100 };
      const report = diagnostics.checkHealth(cacheStats, emptySchedulerMetrics);
      expect(report.issues.some((i) => i.code === 'NO_ACTIVE_OBSERVERS')).toBe(true);
    });

    it('should include health metrics in report', () => {
      const cacheStats: CacheStatsSnapshot = { size: 50, activeEntries: 10, gcEligibleEntries: 5, totalAccesses: 200 };
      const schedulerMetrics: SchedulerMetricsSnapshot = {
        totalScheduled: 30, totalCompleted: 28, totalFailed: 2, totalCancelled: 0,
        queueSize: 5, activeTaskCount: 1, flushCount: 15, batchCount: 8,
      };
      const report = diagnostics.checkHealth(cacheStats, schedulerMetrics);
      expect(report.cacheHealth.size).toBe(50);
      expect(report.cacheHealth.maxSize).toBe(100);
      expect(report.cacheHealth.utilizationPercent).toBe(50);
      expect(report.schedulerHealth.queueSize).toBe(5);
      expect(report.schedulerHealth.failureRate).toBeCloseTo(6.67, 1);
    });

    it('should get recorded issues', () => {
      diagnostics.checkHealth(
        { size: 95, activeEntries: 5, gcEligibleEntries: 2, totalAccesses: 100 },
        emptySchedulerMetrics,
      );
      expect(diagnostics.getIssues().length).toBeGreaterThan(0);
    });

    it('should clear issues', () => {
      diagnostics.checkHealth(
        { size: 95, activeEntries: 5, gcEligibleEntries: 2, totalAccesses: 100 },
        emptySchedulerMetrics,
      );
      diagnostics.clearIssues();
      expect(diagnostics.getIssues()).toHaveLength(0);
    });
  });
});
