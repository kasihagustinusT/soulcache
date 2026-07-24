/**
 * Diagnostics
 *
 * Health monitoring and issue detection for SoulCache runtime.
 * Detects common problems like stale caches, memory pressure,
 * and performance degradation.
 */

import type {
  DiagnosticIssue,
  DiagnosticSeverity,
  HealthReport,
  HealthStatus,
  CacheHealthMetrics,
  SchedulerHealthMetrics,
  CacheStatsSnapshot,
  SchedulerMetricsSnapshot,
} from './types';

let diagnosticId = 0;

function generateDiagnosticId(): string {
  diagnosticId++;
  return `diag-${String(diagnosticId)}`;
}

/** Diagnostics engine interface */
export interface DiagnosticsEngine {
  /** Run health check and return report */
  checkHealth(cacheStats: CacheStatsSnapshot, schedulerMetrics: SchedulerMetricsSnapshot): HealthReport;
  /** Check for specific issues */
  detectIssues(cacheStats: CacheStatsSnapshot, schedulerMetrics: SchedulerMetricsSnapshot): DiagnosticIssue[];
  /** Get recorded issues */
  getIssues(): readonly DiagnosticIssue[];
  /** Clear recorded issues */
  clearIssues(): void;
}

/**
 * Create a diagnostics engine.
 */
export function createDiagnostics(maxCacheSize: number = 1000, maxQueueSize: number = 10000): DiagnosticsEngine {
  let issues: DiagnosticIssue[] = [];
  const maxIssues = 100;

  function addIssue(severity: DiagnosticSeverity, code: string, message: string, details?: Record<string, unknown>): DiagnosticIssue {
    const issue: DiagnosticIssue = {
      id: generateDiagnosticId(),
      severity,
      code,
      message,
      details,
      timestamp: Date.now(),
    };
    issues.push(issue);
    if (issues.length > maxIssues) {
      issues = issues.slice(-maxIssues);
    }
    return issue;
  }

  function detectIssues(
    cacheStats: CacheStatsSnapshot,
    schedulerMetrics: SchedulerMetricsSnapshot,
  ): DiagnosticIssue[] {
    const detected: DiagnosticIssue[] = [];

    // Check cache utilization
    const cacheUtilization = maxCacheSize > 0 ? (cacheStats.size / maxCacheSize) * 100 : 0;
    if (cacheUtilization > 90) {
      detected.push(addIssue(
        'warning',
        'CACHE_HIGH_UTILIZATION',
        `Cache utilization at ${cacheUtilization.toFixed(1)}% (${cacheStats.size}/${maxCacheSize})`,
        { utilization: cacheUtilization, size: cacheStats.size, maxSize: maxCacheSize },
      ));
    }

    if (cacheUtilization >= 100) {
      detected.push(addIssue(
        'error',
        'CACHE_FULL',
        'Cache is at maximum capacity. LRU eviction active.',
        { size: cacheStats.size, maxSize: maxCacheSize },
      ));
    }

    // Check for GC pressure
    if (cacheStats.gcEligibleEntries > cacheStats.size * 0.5 && cacheStats.size > 10) {
      detected.push(addIssue(
        'warning',
        'GC_PRESSURE',
        `${cacheStats.gcEligibleEntries} of ${cacheStats.size} entries are GC-eligible`,
        { gcEligible: cacheStats.gcEligibleEntries, total: cacheStats.size },
      ));
    }

    // Check scheduler queue
    const queueUtilization = maxQueueSize > 0 ? (schedulerMetrics.queueSize / maxQueueSize) * 100 : 0;
    if (queueUtilization > 80) {
      detected.push(addIssue(
        'warning',
        'SCHEDULER_QUEUE_HIGH',
        `Scheduler queue utilization at ${queueUtilization.toFixed(1)}%`,
        { utilization: queueUtilization, queueSize: schedulerMetrics.queueSize },
      ));
    }

    if (schedulerMetrics.queueSize >= maxQueueSize) {
      detected.push(addIssue(
        'error',
        'SCHEDULER_QUEUE_FULL',
        'Scheduler queue is full. Tasks may be dropped.',
        { queueSize: schedulerMetrics.queueSize, maxQueueSize },
      ));
    }

    // Check failure rate
    const totalTasks = schedulerMetrics.totalCompleted + schedulerMetrics.totalFailed;
    if (totalTasks > 10) {
      const failureRate = (schedulerMetrics.totalFailed / totalTasks) * 100;
      if (failureRate > 10) {
        detected.push(addIssue(
          'warning',
          'HIGH_FAILURE_RATE',
          `Task failure rate at ${failureRate.toFixed(1)}% (${schedulerMetrics.totalFailed}/${totalTasks})`,
          { failureRate, failed: schedulerMetrics.totalFailed, total: totalTasks },
        ));
      }
      if (failureRate > 50) {
        detected.push(addIssue(
          'error',
          'CRITICAL_FAILURE_RATE',
          `Task failure rate at ${failureRate.toFixed(1)}% — investigate runtime errors`,
          { failureRate, failed: schedulerMetrics.totalFailed, total: totalTasks },
        ));
      }
    }

    // Check memory (rough heuristic)
    if (cacheStats.totalAccesses > 0 && cacheStats.size > 0) {
      const avgAccessesPerEntry = cacheStats.totalAccesses / cacheStats.size;
      if (avgAccessesPerEntry < 1 && cacheStats.size > 50) {
        detected.push(addIssue(
          'info',
          'LOW_CACHE_EFFICIENCY',
          `Low average accesses per cache entry (${avgAccessesPerEntry.toFixed(2)}). Consider reducing staleTime.`,
          { avgAccesses: avgAccessesPerEntry, size: cacheStats.size },
        ));
      }
    }

    // Check active vs total entries
    if (cacheStats.size > 0 && cacheStats.activeEntries === 0) {
      detected.push(addIssue(
        'info',
        'NO_ACTIVE_OBSERVERS',
        'Cache has entries but no active observers. Entries will eventually be GC\'d.',
        { size: cacheStats.size, activeEntries: cacheStats.activeEntries },
      ));
    }

    return detected;
  }

  function checkHealth(
    cacheStats: CacheStatsSnapshot,
    schedulerMetrics: SchedulerMetricsSnapshot,
  ): HealthReport {
    const detectedIssues = detectIssues(cacheStats, schedulerMetrics);

    const hasErrors = detectedIssues.some((i) => i.severity === 'error');
    const hasWarnings = detectedIssues.some((i) => i.severity === 'warning');

    let status: HealthStatus;
    if (hasErrors) {
      status = 'unhealthy';
    } else if (hasWarnings) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    const cacheUtilization = maxCacheSize > 0 ? (cacheStats.size / maxCacheSize) * 100 : 0;
    const queueUtilization = maxQueueSize > 0 ? (schedulerMetrics.queueSize / maxQueueSize) * 100 : 0;
    const totalTasks = schedulerMetrics.totalCompleted + schedulerMetrics.totalFailed;
    const failureRate = totalTasks > 0 ? (schedulerMetrics.totalFailed / totalTasks) * 100 : 0;

    const cacheHealth: CacheHealthMetrics = {
      size: cacheStats.size,
      maxSize: maxCacheSize,
      utilizationPercent: cacheUtilization,
      gcEligibleCount: cacheStats.gcEligibleEntries,
      hitRate: cacheStats.totalAccesses > 0 && cacheStats.size > 0
        ? (cacheStats.totalAccesses / cacheStats.size) * 100
        : 0,
    };

    const schedulerHealth: SchedulerHealthMetrics = {
      queueSize: schedulerMetrics.queueSize,
      maxQueueSize,
      utilizationPercent: queueUtilization,
      failureRate,
      avgTaskDuration: schedulerMetrics.totalCompleted > 0
        ? (schedulerMetrics.totalCompleted * 10) // rough estimate
        : 0,
    };

    return {
      status,
      issues: detectedIssues,
      cacheHealth,
      schedulerHealth,
      timestamp: Date.now(),
    };
  }

  function getIssues(): readonly DiagnosticIssue[] {
    return issues;
  }

  function clearIssues(): void {
    issues = [];
  }

  return {
    checkHealth,
    detectIssues,
    getIssues,
    clearIssues,
  };
}
