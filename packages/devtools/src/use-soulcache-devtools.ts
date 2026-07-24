/**
 * useSoulCacheDevTools Hook
 *
 * React hook that connects a QueryClient to the DevTools inspection layer.
 * Provides read-only access to runtime state, timeline, metrics, and diagnostics.
 */

import { useRef, useCallback, useState } from 'react';
import type { QueryClient } from '@soulcache/core';
import type {
  RuntimeInspectorSnapshot,
  TimelineEvent,
  TimelineFilter,
  AggregatedMetrics,
  HealthReport,
  SessionRecording,
  DevToolsConfig,
} from '@soulcache/devtools-core';
import { createInspector } from '@soulcache/devtools-core';
import { createTimeline } from '@soulcache/devtools-core';
import { createMetricsCollector, extractMetricsFromEvents } from '@soulcache/devtools-core';
import { createDiagnostics } from '@soulcache/devtools-core';
import { createSessionRecorder, exportRecording, getSessionSummary } from '@soulcache/devtools-core';

export interface SoulCacheDevTools {
  /** Capture a full runtime snapshot */
  captureSnapshot: () => RuntimeInspectorSnapshot;
  /** Get timeline events */
  getTimeline: (filter?: TimelineFilter) => readonly TimelineEvent[];
  /** Get aggregated performance metrics */
  getMetrics: () => AggregatedMetrics;
  /** Run health diagnostics */
  checkHealth: () => HealthReport;
  /** Start session recording */
  startRecording: (metadata?: Record<string, unknown>) => string;
  /** Stop session recording and get the session */
  stopRecording: () => SessionRecording | null;
  /** Check if currently recording */
  isRecording: boolean;
  /** Export a recording as JSON */
  exportRecording: (session: SessionRecording) => string;
  /** Get recording summary */
  getSessionSummary: (session: SessionRecording) => {
    readonly duration: number;
    readonly eventCount: number;
    readonly snapshotCount: number;
    readonly eventTypes: Record<string, number>;
  };
  /** Clear all DevTools data */
  clear: () => void;
  /** Get timeline size */
  timelineSize: number;
}

export interface UseSoulCacheDevToolsOptions extends DevToolsConfig {
  /** The QueryClient instance to inspect */
  client: QueryClient;
  /** Whether to enable DevTools (default: true) */
  enabled?: boolean;
}

/**
 * React hook for SoulCache DevTools integration.
 *
 * @example
 * ```tsx
 * import { useSoulCacheDevTools } from '@soulcache/devtools';
 *
 * function App() {
 *   const devtools = useSoulCacheDevTools({ client: queryClient });
 *
 *   useEffect(() => {
 *     const report = devtools.checkHealth();
 *     console.log('Cache health:', report.status);
 *   }, []);
 *
 *   return <div>Cache size: {devtools.getMetrics().totalQueries}</div>;
 * }
 * ```
 */
export function useSoulCacheDevTools(options: UseSoulCacheDevToolsOptions): SoulCacheDevTools {
  const { client, enabled = true } = options;

  const inspectorRef = useRef(createInspector());
  const timelineRef = useRef(createTimeline(options.maxTimelineEvents ?? 1000));
  const metricsRef = useRef(createMetricsCollector());
  const diagnosticsRef = useRef(createDiagnostics());
  const recorderRef = useRef(createSessionRecorder(timelineRef.current, {
    maxEvents: options.maxSnapshots ?? 1000,
    maxSnapshots: options.maxSnapshots ?? 100,
  }));

  const [timelineSize, setTimelineSize] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const captureSnapshot = useCallback((): RuntimeInspectorSnapshot => {
    if (!enabled) {
      return {
        queries: [],
        mutations: [],
        observers: [],
        cacheStats: { size: 0, activeEntries: 0, gcEligibleEntries: 0, totalAccesses: 0 },
        schedulerMetrics: {
          totalScheduled: 0, totalCompleted: 0, totalFailed: 0, totalCancelled: 0,
          queueSize: 0, activeTaskCount: 0, flushCount: 0, batchCount: 0,
        },
        timestamp: Date.now(),
      };
    }

    const snapshot = inspectorRef.current.inspectRuntime(client);

    if (recorderRef.current.isRecording()) {
      recorderRef.current.captureSnapshot(snapshot);
    }

    return snapshot;
  }, [client, enabled]);

  const getTimeline = useCallback((filter?: TimelineFilter): readonly TimelineEvent[] => {
    if (!enabled) return [];
    return filter
      ? timelineRef.current.getFilteredEvents(filter)
      : timelineRef.current.getEvents();
  }, [enabled]);

  const getMetrics = useCallback((): AggregatedMetrics => {
    if (!enabled) {
      return {
        totalQueries: 0,
        totalFetches: 0,
        totalErrors: 0,
        overallSuccessRate: 0,
        averageFetchDuration: 0,
        p50FetchDuration: 0,
        p95FetchDuration: 0,
        p99FetchDuration: 0,
        memoryEstimateBytes: 0,
        queries: [],
      };
    }

    const events = timelineRef.current.getEvents();
    const collector = extractMetricsFromEvents(events);
    return collector.getAggregatedMetrics();
  }, [enabled]);

  const checkHealth = useCallback((): HealthReport => {
    if (!enabled) {
      return {
        status: 'healthy',
        issues: [],
        cacheHealth: { size: 0, maxSize: 0, utilizationPercent: 0, gcEligibleCount: 0, hitRate: 0 },
        schedulerHealth: {
          queueSize: 0, maxQueueSize: 0, utilizationPercent: 0, failureRate: 0, avgTaskDuration: 0,
        },
        timestamp: Date.now(),
      };
    }

    const cache = client.getCache();
    const scheduler = client.getScheduler();
    const cacheStats = inspectorRef.current.inspectCacheStats(cache);
    const schedulerMetrics = inspectorRef.current.inspectScheduler(scheduler);
    return diagnosticsRef.current.checkHealth(cacheStats, schedulerMetrics);
  }, [client, enabled]);

  const startRecording = useCallback((metadata?: Record<string, unknown>): string => {
    const id = recorderRef.current.start(metadata);
    setIsRecording(true);
    return id;
  }, []);

  const stopRecording = useCallback((): SessionRecording | null => {
    const session = recorderRef.current.stop();
    setIsRecording(false);
    return session;
  }, []);

  const clear = useCallback(() => {
    timelineRef.current.clear();
    metricsRef.current.clear();
    diagnosticsRef.current.clearIssues();
    setTimelineSize(0);
  }, []);

  return {
    captureSnapshot,
    getTimeline,
    getMetrics,
    checkHealth,
    startRecording,
    stopRecording,
    isRecording,
    exportRecording,
    getSessionSummary,
    clear,
    timelineSize,
  };
}
