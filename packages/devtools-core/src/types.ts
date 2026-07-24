/**
 * SoulCache DevTools Core Types
 *
 * Framework-agnostic type definitions for runtime inspection,
 * diagnostics, and developer tooling.
 */

import type { QueryKey } from '@soulcache/core';

// ---------------------------------------------------------------------------
// Inspector Types
// ---------------------------------------------------------------------------

/** Query cache entry snapshot */
export interface QueryInspectorSnapshot {
  readonly queryId: string;
  readonly queryKey: QueryKey;
  readonly keyHash: string;
  readonly status: string;
  readonly fetchStatus: string;
  readonly data: unknown;
  readonly error: Error | null;
  readonly observerCount: number;
  readonly accessCount: number;
  readonly updatedAt: string | null;
  readonly staleAt: string | null;
  readonly expiresAt: string | null;
  readonly meta: Record<string, unknown>;
  readonly dependencies: readonly string[];
  readonly sizeBytes: number;
}

/** Mutation cache entry snapshot */
export interface MutationInspectorSnapshot {
  readonly mutationId: string;
  readonly status: string;
  readonly variables: unknown;
  readonly data: unknown;
  readonly error: Error | null;
  readonly createdAt: number;
  readonly startedAt: number | null;
  readonly completedAt: number | null;
  readonly duration: number | null;
}

/** Observer snapshot for a query */
export interface ObserverInspectorSnapshot {
  readonly queryId: string;
  readonly observerCount: number;
  readonly status: string;
  readonly fetchStatus: string;
}

/** Full runtime state snapshot */
export interface RuntimeInspectorSnapshot {
  readonly queries: readonly QueryInspectorSnapshot[];
  readonly mutations: readonly MutationInspectorSnapshot[];
  readonly observers: readonly ObserverInspectorSnapshot[];
  readonly cacheStats: CacheStatsSnapshot;
  readonly schedulerMetrics: SchedulerMetricsSnapshot;
  readonly timestamp: number;
}

/** Cache statistics snapshot */
export interface CacheStatsSnapshot {
  readonly size: number;
  readonly activeEntries: number;
  readonly gcEligibleEntries: number;
  readonly totalAccesses: number;
}

/** Scheduler metrics snapshot */
export interface SchedulerMetricsSnapshot {
  readonly totalScheduled: number;
  readonly totalCompleted: number;
  readonly totalFailed: number;
  readonly totalCancelled: number;
  readonly queueSize: number;
  readonly activeTaskCount: number;
  readonly flushCount: number;
  readonly batchCount: number;
}

// ---------------------------------------------------------------------------
// Serialization Types
// ---------------------------------------------------------------------------

/** Custom serializer for non-JSON-safe values */
export interface CustomSerializer {
  readonly test: (value: unknown) => boolean;
  readonly serialize: (value: unknown) => unknown;
  readonly deserialize: (value: unknown) => unknown;
}

/** Serialization options */
export interface SerializationOptions {
  /** Maximum depth for nested object serialization */
  readonly maxDepth?: number;
  /** Maximum string length before truncation */
  readonly maxStringLength?: number;
  /** Maximum number of array items to serialize */
  readonly maxArrayLength?: number;
  /** Custom serializers for specific types */
  readonly customSerializers?: readonly CustomSerializer[];
  /** Whether to include function names (not bodies) */
  readonly includeFunctionNames?: boolean;
  /** Whether to handle circular references */
  readonly handleCircularRefs?: boolean;
}

/** Serialized value result */
export interface SerializedValue {
  readonly type: string;
  readonly value: unknown;
  readonly truncated?: boolean;
  readonly depth?: number;
}

// ---------------------------------------------------------------------------
// Timeline Types
// ---------------------------------------------------------------------------

/** Timeline event type */
export type TimelineEventType =
  | 'query.created'
  | 'query.fetching'
  | 'query.success'
  | 'query.error'
  | 'query.invalidated'
  | 'query.removed'
  | 'mutation.created'
  | 'mutation.pending'
  | 'mutation.success'
  | 'mutation.error'
  | 'mutation.removed'
  | 'cache.set'
  | 'cache.delete'
  | 'cache.invalidate'
  | 'cache.gc'
  | 'scheduler.task-registered'
  | 'scheduler.task-started'
  | 'scheduler.task-completed'
  | 'scheduler.task-failed'
  | 'scheduler.batch-started'
  | 'scheduler.batch-completed'
  | 'snapshot.captured'
  | 'custom';

/** Timeline event */
export interface TimelineEvent {
  readonly id: string;
  readonly type: TimelineEventType;
  readonly timestamp: number;
  readonly source: string;
  readonly payload: Record<string, unknown>;
  readonly duration?: number;
  readonly metadata?: Record<string, unknown>;
}

/** Timeline snapshot */
export interface TimelineSnapshot {
  readonly events: readonly TimelineEvent[];
  readonly startTimestamp: number;
  readonly endTimestamp: number;
  readonly totalEvents: number;
}

/** Timeline filter options */
export interface TimelineFilter {
  readonly types?: readonly TimelineEventType[];
  readonly source?: string;
  readonly startTime?: number;
  readonly endTime?: number;
  readonly queryId?: string;
}

// ---------------------------------------------------------------------------
// Metrics Types
// ---------------------------------------------------------------------------

/** Performance metrics for a query */
export interface QueryMetrics {
  readonly queryId: string;
  readonly keyHash: string;
  readonly fetchCount: number;
  readonly successCount: number;
  readonly errorCount: number;
  readonly averageFetchDuration: number;
  readonly lastFetchDuration: number | null;
  readonly totalFetchDuration: number;
  readonly observerCount: number;
}

/** Aggregated performance metrics */
export interface AggregatedMetrics {
  readonly totalQueries: number;
  readonly totalFetches: number;
  readonly totalErrors: number;
  readonly overallSuccessRate: number;
  readonly averageFetchDuration: number;
  readonly p50FetchDuration: number;
  readonly p95FetchDuration: number;
  readonly p99FetchDuration: number;
  readonly memoryEstimateBytes: number;
  readonly queries: readonly QueryMetrics[];
}

// ---------------------------------------------------------------------------
// Diagnostics Types
// ---------------------------------------------------------------------------

/** Diagnostic severity level */
export type DiagnosticSeverity = 'info' | 'warning' | 'error';

/** Diagnostic issue */
export interface DiagnosticIssue {
  readonly id: string;
  readonly severity: DiagnosticSeverity;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
  readonly timestamp: number;
}

/** Health status */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/** System health report */
export interface HealthReport {
  readonly status: HealthStatus;
  readonly issues: readonly DiagnosticIssue[];
  readonly cacheHealth: CacheHealthMetrics;
  readonly schedulerHealth: SchedulerHealthMetrics;
  readonly timestamp: number;
}

/** Cache health metrics */
export interface CacheHealthMetrics {
  readonly size: number;
  readonly maxSize: number;
  readonly utilizationPercent: number;
  readonly gcEligibleCount: number;
  readonly hitRate: number;
}

/** Scheduler health metrics */
export interface SchedulerHealthMetrics {
  readonly queueSize: number;
  readonly maxQueueSize: number;
  readonly utilizationPercent: number;
  readonly failureRate: number;
  readonly avgTaskDuration: number;
}

// ---------------------------------------------------------------------------
// Session Recording Types
// ---------------------------------------------------------------------------

/** Session recording */
export interface SessionRecording {
  readonly id: string;
  readonly startTime: number;
  readonly endTime: number | null;
  readonly events: readonly TimelineEvent[];
  readonly snapshots: readonly RuntimeInspectorSnapshot[];
  readonly metadata: Record<string, unknown>;
}

/** Recording options */
export interface RecordingOptions {
  /** Maximum events to record */
  readonly maxEvents?: number;
  /** Maximum snapshots to record */
  readonly maxSnapshots?: number;
  /** Whether to record timeline events */
  readonly recordTimeline?: boolean;
  /** Whether to record state snapshots */
  readonly recordSnapshots?: boolean;
  /** Interval for automatic snapshots (ms) */
  readonly snapshotInterval?: number;
}

// ---------------------------------------------------------------------------
// DevTools Manager Types
// ---------------------------------------------------------------------------

/** DevTools manager configuration */
export interface DevToolsConfig {
  /** Enable/disable DevTools */
  readonly enabled?: boolean;
  /** Maximum events to keep in timeline */
  readonly maxTimelineEvents?: number;
  /** Maximum snapshots to keep */
  readonly maxSnapshots?: number;
  /** Serialization options */
  readonly serialization?: SerializationOptions;
  /** Whether to enable performance tracking */
  readonly enablePerformanceTracking?: boolean;
  /** Whether to enable session recording */
  readonly enableRecording?: boolean;
  /** Custom event handlers */
  readonly onEvent?: (event: TimelineEvent) => void;
  /** Custom diagnostic handlers */
  readonly onDiagnostic?: (issue: DiagnosticIssue) => void;
}
