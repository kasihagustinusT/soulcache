/**
 * Metrics
 *
 * Performance metrics collection and aggregation for SoulCache queries.
 * Tracks fetch durations, success rates, and memory usage.
 */

import type {
  QueryMetrics,
  AggregatedMetrics,
  TimelineEvent,
} from './types';

/** Metrics collector interface */
export interface MetricsCollector {
  /** Record a fetch event */
  recordFetch(queryId: string, keyHash: string, duration: number, success: boolean): void;
  /** Get metrics for a specific query */
  getQueryMetrics(queryId: string): QueryMetrics | undefined;
  /** Get aggregated metrics across all queries */
  getAggregatedMetrics(): AggregatedMetrics;
  /** Clear all collected metrics */
  clear(): void;
}

interface FetchRecord {
  readonly duration: number;
  readonly success: boolean;
  readonly timestamp: number;
}

interface QueryMetricData {
  keyHash: string;
  fetchCount: number;
  successCount: number;
  errorCount: number;
  totalFetchDuration: number;
  lastFetchDuration: number | null;
  fetchHistory: FetchRecord[];
}

/**
 * Create a metrics collector.
 */
export function createMetricsCollector(): MetricsCollector {
  const queryMetrics = new Map<string, QueryMetricData>();
  const maxHistoryPerQuery = 100;

  function recordFetch(queryId: string, keyHash: string, duration: number, success: boolean): void {
    let data = queryMetrics.get(queryId);
    if (!data) {
      data = {
        keyHash,
        fetchCount: 0,
        successCount: 0,
        errorCount: 0,
        totalFetchDuration: 0,
        lastFetchDuration: null,
        fetchHistory: [],
      };
      queryMetrics.set(queryId, data);
    }

    data.fetchCount++;
    if (success) {
      data.successCount++;
    } else {
      data.errorCount++;
    }
    data.totalFetchDuration += duration;
    data.lastFetchDuration = duration;

    data.fetchHistory.push({ duration, success, timestamp: Date.now() });
    if (data.fetchHistory.length > maxHistoryPerQuery) {
      data.fetchHistory = data.fetchHistory.slice(-maxHistoryPerQuery);
    }
  }

  function getQueryMetrics(queryId: string): QueryMetrics | undefined {
    const data = queryMetrics.get(queryId);
    if (!data) return undefined;

    return {
      queryId,
      keyHash: data.keyHash,
      fetchCount: data.fetchCount,
      successCount: data.successCount,
      errorCount: data.errorCount,
      averageFetchDuration: data.fetchCount > 0 ? data.totalFetchDuration / data.fetchCount : 0,
      lastFetchDuration: data.lastFetchDuration,
      totalFetchDuration: data.totalFetchDuration,
      observerCount: 0,
    };
  }

  function getAggregatedMetrics(): AggregatedMetrics {
    let totalFetches = 0;
    let totalErrors = 0;
    let totalDuration = 0;
    const allDurations: number[] = [];
    const queries: QueryMetrics[] = [];

    for (const [queryId, data] of queryMetrics) {
      totalFetches += data.fetchCount;
      totalErrors += data.errorCount;
      totalDuration += data.totalFetchDuration;

      for (const record of data.fetchHistory) {
        allDurations.push(record.duration);
      }

      queries.push({
        queryId,
        keyHash: data.keyHash,
        fetchCount: data.fetchCount,
        successCount: data.successCount,
        errorCount: data.errorCount,
        averageFetchDuration: data.fetchCount > 0 ? data.totalFetchDuration / data.fetchCount : 0,
        lastFetchDuration: data.lastFetchDuration,
        totalFetchDuration: data.totalFetchDuration,
        observerCount: 0,
      });
    }

    allDurations.sort((a, b) => a - b);

    const totalQueries = queryMetrics.size;
    const overallSuccessRate = totalFetches > 0
      ? ((totalFetches - totalErrors) / totalFetches) * 100
      : 0;
    const averageFetchDuration = totalFetches > 0 ? totalDuration / totalFetches : 0;

    return {
      totalQueries,
      totalFetches,
      totalErrors,
      overallSuccessRate,
      averageFetchDuration,
      p50FetchDuration: percentile(allDurations, 0.5),
      p95FetchDuration: percentile(allDurations, 0.95),
      p99FetchDuration: percentile(allDurations, 0.99),
      memoryEstimateBytes: estimateMemoryUsage(queries),
      queries,
    };
  }

  function clear(): void {
    queryMetrics.clear();
  }

  return {
    recordFetch,
    getQueryMetrics,
    getAggregatedMetrics,
    clear,
  };
}

/** Extract metrics from timeline events */
export function extractMetricsFromEvents(events: readonly TimelineEvent[]): MetricsCollector {
  const collector = createMetricsCollector();

  for (const event of events) {
    if (event.type === 'query.fetching' && event.duration !== undefined) {
      const queryId = (event.payload['queryId'] as string) ?? 'unknown';
      const keyHash = (event.payload['keyHash'] as string) ?? queryId;
      const success = true; // query.fetching events are successful fetches
      collector.recordFetch(queryId, keyHash, event.duration, success);
    }
  }

  return collector;
}

/** Calculate percentile from sorted array */
function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)]!;
}

/** Rough memory estimation in bytes */
function estimateMemoryUsage(queries: readonly QueryMetrics[]): number {
  let bytes = 0;
  for (const q of queries) {
    bytes += 200; // Base overhead per query metrics object
    bytes += q.keyHash.length * 2;
  }
  return bytes;
}
