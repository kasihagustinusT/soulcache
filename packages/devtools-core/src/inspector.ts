/**
 * Inspector
 *
 * Framework-agnostic runtime state inspection for SoulCache.
 * Reads QueryClient internals and produces immutable snapshots.
 */

import type {
  QueryInspectorSnapshot,
  MutationInspectorSnapshot,
  RuntimeInspectorSnapshot,
  CacheStatsSnapshot,
  SchedulerMetricsSnapshot,
} from './types';
import { defaultSerializer } from './serializer';

/** Estimate the byte size of a value */
function estimateSize(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'string') return value.length * 2;
  if (typeof value === 'number') return 8;
  if (typeof value === 'boolean') return 4;
  if (Array.isArray(value)) {
    return value.reduce((sum, item) => sum + estimateSize(item), 0);
  }
  if (typeof value === 'object') {
    const serialized = defaultSerializer.serialize(value);
    return JSON.stringify(serialized.value).length * 2;
  }
  return 8;
}

/** Inspector interface */
export interface Inspector {
  /** Inspect a single query entry */
  inspectQuery(queryKey: readonly unknown[], cache: {
    get: <T>(queryKey: readonly unknown[]) => { data: T; state: string; fetchStatus: string; error: Error | null; observerCount: number; accessCount: number; updatedAt: string | null; staleAt: string | null; expiresAt: string | null; meta: Record<string, unknown>; dependencies: readonly string[] } | undefined;
    getByHash: <T>(keyHash: string) => { data: T; state: string; fetchStatus: string; error: Error | null; observerCount: number; accessCount: number; updatedAt: string | null; staleAt: string | null; expiresAt: string | null; meta: Record<string, unknown>; dependencies: readonly string[] } | undefined;
  }): QueryInspectorSnapshot | null;
  /** Inspect all mutations */
  inspectMutations(mutationCache: {
    entries: () => Array<{
      id: string;
      status: string;
      variables: unknown;
      data: unknown;
      error: Error | null;
      createdAt: number;
      startedAt: number | null;
      completedAt: number | null;
    }>;
  }): MutationInspectorSnapshot[];
  /** Inspect cache statistics */
  inspectCacheStats(cache: {
    getStats: () => { size: number; activeEntries: number; gcEligibleEntries: number; totalAccesses: number };
  }): CacheStatsSnapshot;
  /** Inspect scheduler metrics */
  inspectScheduler(scheduler: {
    getMetrics: () => SchedulerMetricsSnapshot;
  }): SchedulerMetricsSnapshot;
  /** Get full runtime snapshot */
  inspectRuntime(client: {
    queryCount: number;
    getCache: () => {
      entries: () => Array<{ queryKey: readonly unknown[]; keyHash: string; data: unknown; state: string; fetchStatus: string; error: Error | null; observerCount: number; accessCount: number; updatedAt: string | null; staleAt: string | null; expiresAt: string | null; meta: Record<string, unknown>; dependencies: readonly string[] }>;
      getStats: () => { size: number; activeEntries: number; gcEligibleEntries: number; totalAccesses: number };
    };
    getMutationCache: () => {
      entries: () => Array<{
        id: string;
        status: string;
        variables: unknown;
        data: unknown;
        error: Error | null;
        createdAt: number;
      }>;
    };
    getScheduler: () => {
      getMetrics: () => SchedulerMetricsSnapshot;
    };
  }): RuntimeInspectorSnapshot;
}

/**
 * Create an inspector instance.
 */
export function createInspector(): Inspector {
  function inspectQuery(queryKey: readonly unknown[], cache: {
    get: <T>(queryKey: readonly unknown[]) => { data: T; state: string; fetchStatus: string; error: Error | null; observerCount: number; accessCount: number; updatedAt: string | null; staleAt: string | null; expiresAt: string | null; meta: Record<string, unknown>; dependencies: readonly string[] } | undefined;
  }): QueryInspectorSnapshot | null {
    const entry = cache.get(queryKey);
    if (!entry) return null;

    const keyHash = computeKeyHash(queryKey);
    return {
      queryId: keyHash,
      queryKey: [...queryKey],
      keyHash,
      status: entry.state,
      fetchStatus: entry.fetchStatus,
      data: entry.data,
      error: entry.error,
      observerCount: entry.observerCount,
      accessCount: entry.accessCount,
      updatedAt: entry.updatedAt,
      staleAt: entry.staleAt,
      expiresAt: entry.expiresAt,
      meta: entry.meta,
      dependencies: entry.dependencies,
      sizeBytes: estimateSize(entry.data),
    };
  }

  function inspectMutations(mutationCache: {
    entries: () => Array<{
      id: string;
      status: string;
      variables: unknown;
      data: unknown;
      error: Error | null;
      createdAt: number;
    }>;
  }): MutationInspectorSnapshot[] {
    return mutationCache.entries().map((entry) => ({
      mutationId: entry.id,
      status: entry.status,
      variables: entry.variables,
      data: entry.data,
      error: entry.error,
      createdAt: entry.createdAt,
      startedAt: null,
      completedAt: null,
      duration: null,
    }));
  }

  function inspectCacheStats(cache: {
    getStats: () => { size: number; activeEntries: number; gcEligibleEntries: number; totalAccesses: number };
  }): CacheStatsSnapshot {
    const stats = cache.getStats();
    return {
      size: stats.size,
      activeEntries: stats.activeEntries,
      gcEligibleEntries: stats.gcEligibleEntries,
      totalAccesses: stats.totalAccesses,
    };
  }

  function inspectScheduler(scheduler: {
    getMetrics: () => SchedulerMetricsSnapshot;
  }): SchedulerMetricsSnapshot {
    return scheduler.getMetrics();
  }

  function inspectRuntime(client: {
    queryCount: number;
    getCache: () => {
      entries: () => Array<{ queryKey: readonly unknown[]; keyHash: string; data: unknown; state: string; fetchStatus: string; error: Error | null; observerCount: number; accessCount: number; updatedAt: string | null; staleAt: string | null; expiresAt: string | null; meta: Record<string, unknown>; dependencies: readonly string[] }>;
      getStats: () => { size: number; activeEntries: number; gcEligibleEntries: number; totalAccesses: number };
    };
    getMutationCache: () => {
      entries: () => Array<{
        id: string;
        status: string;
        variables: unknown;
        data: unknown;
        error: Error | null;
        createdAt: number;
      }>;
    };
    getScheduler: () => {
      getMetrics: () => SchedulerMetricsSnapshot;
    };
  }): RuntimeInspectorSnapshot {
    const cache = client.getCache();
    const mutations = client.getMutationCache();
    const scheduler = client.getScheduler();

    const querySnapshots: QueryInspectorSnapshot[] = cache.entries().map((entry) => ({
      queryId: entry.keyHash,
      queryKey: entry.queryKey,
      keyHash: entry.keyHash,
      status: entry.state,
      fetchStatus: entry.fetchStatus,
      data: entry.data,
      error: entry.error,
      observerCount: entry.observerCount,
      accessCount: entry.accessCount,
      updatedAt: entry.updatedAt,
      staleAt: entry.staleAt,
      expiresAt: entry.expiresAt,
      meta: entry.meta,
      dependencies: entry.dependencies,
      sizeBytes: estimateSize(entry.data),
    }));

    const mutationSnapshots: MutationInspectorSnapshot[] = mutations.entries().map((entry) => ({
      mutationId: entry.id,
      status: entry.status,
      variables: entry.variables,
      data: entry.data,
      error: entry.error,
      createdAt: entry.createdAt,
      startedAt: null,
      completedAt: null,
      duration: null,
    }));

    return {
      queries: querySnapshots,
      mutations: mutationSnapshots,
      observers: [],
      cacheStats: inspectCacheStats(cache),
      schedulerMetrics: inspectScheduler(scheduler),
      timestamp: Date.now(),
    };
  }

  return {
    inspectQuery,
    inspectMutations,
    inspectCacheStats,
    inspectScheduler,
    inspectRuntime,
  };
}

/** Simple key hash for devtools identification */
function computeKeyHash(queryKey: readonly unknown[]): string {
  return JSON.stringify(queryKey);
}
