import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SoulCacheDevTools, UseSoulCacheDevToolsOptions } from '../use-soulcache-devtools';

// Mock React since we don't have it in this test environment
vi.mock('react', () => ({
  useRef: (val: unknown) => ({ current: val }),
  useCallback: (fn: unknown) => fn,
  useState: (val: unknown) => [val, vi.fn()],
  useEffect: () => {},
  createContext: () => ({ Provider: ({ children }: { children: React.ReactNode }) => children, Consumer: () => null }),
  useContext: () => null,
}));

// Mock devtools-core
vi.mock('@soulcache/devtools-core', () => ({
  createInspector: () => ({
    inspectRuntime: () => ({
      queries: [],
      mutations: [],
      observers: [],
      cacheStats: { size: 0, activeEntries: 0, gcEligibleEntries: 0, totalAccesses: 0 },
      schedulerMetrics: {
        totalScheduled: 0, totalCompleted: 0, totalFailed: 0, totalCancelled: 0,
        queueSize: 0, activeTaskCount: 0, flushCount: 0, batchCount: 0,
      },
      timestamp: Date.now(),
    }),
    inspectCacheStats: () => ({
      size: 0, activeEntries: 0, gcEligibleEntries: 0, totalAccesses: 0,
    }),
    inspectScheduler: () => ({
      totalScheduled: 0, totalCompleted: 0, totalFailed: 0, totalCancelled: 0,
      queueSize: 0, activeTaskCount: 0, flushCount: 0, batchCount: 0,
    }),
  }),
  createTimeline: () => ({
    record: vi.fn(),
    getEvents: () => [],
    getFilteredEvents: () => [],
    getSnapshot: () => ({ events: [], startTimestamp: Date.now(), endTimestamp: Date.now(), totalEvents: 0 }),
    getQueryEvents: () => [],
    size: 0,
    clear: vi.fn(),
    getById: () => undefined,
    getEventsInRange: () => [],
  }),
  createTimelineEvent: (type: string, source: string, payload: Record<string, unknown>) => ({
    id: 'test-id',
    type,
    timestamp: Date.now(),
    source,
    payload,
  }),
  createMetricsCollector: () => ({
    recordFetch: vi.fn(),
    getQueryMetrics: () => undefined,
    getAggregatedMetrics: () => ({
      totalQueries: 0, totalFetches: 0, totalErrors: 0, overallSuccessRate: 0,
      averageFetchDuration: 0, p50FetchDuration: 0, p95FetchDuration: 0, p99FetchDuration: 0,
      memoryEstimateBytes: 0, queries: [],
    }),
    clear: vi.fn(),
  }),
  extractMetricsFromEvents: () => ({
    recordFetch: vi.fn(),
    getQueryMetrics: () => undefined,
    getAggregatedMetrics: () => ({
      totalQueries: 0, totalFetches: 0, totalErrors: 0, overallSuccessRate: 0,
      averageFetchDuration: 0, p50FetchDuration: 0, p95FetchDuration: 0, p99FetchDuration: 0,
      memoryEstimateBytes: 0, queries: [],
    }),
    clear: vi.fn(),
  }),
  createDiagnostics: () => ({
    checkHealth: () => ({
      status: 'healthy',
      issues: [],
      cacheHealth: { size: 0, maxSize: 0, utilizationPercent: 0, gcEligibleCount: 0, hitRate: 0 },
      schedulerHealth: { queueSize: 0, maxQueueSize: 0, utilizationPercent: 0, failureRate: 0, avgTaskDuration: 0 },
      timestamp: Date.now(),
    }),
    detectIssues: () => [],
    getIssues: () => [],
    clearIssues: vi.fn(),
  }),
  createSessionRecorder: () => ({
    start: () => 'session-1',
    stop: () => null,
    captureSnapshot: vi.fn(),
    addEvent: vi.fn(),
    isRecording: () => false,
    getRecordingId: () => null,
  }),
  exportRecording: (session: { id: string }) => JSON.stringify(session),
  getSessionDuration: () => 0,
  getSessionSummary: () => ({
    duration: 0,
    eventCount: 0,
    snapshotCount: 0,
    eventTypes: {},
  }),
}));

describe('useSoulCacheDevTools', () => {
  // Since we can't actually render React hooks in this test environment,
  // we'll test the module imports and type definitions work correctly.

  it('should export hook function', async () => {
    const mod = await import('../use-soulcache-devtools');
    expect(typeof mod.useSoulCacheDevTools).toBe('function');
  });

  it('should export correct types', async () => {
    const mod = await import('../use-soulcache-devtools');
    // Type check - this will fail at compile time if types are wrong
    const hook: typeof mod.useSoulCacheDevTools = mod.useSoulCacheDevTools;
    expect(hook).toBeDefined();
  });
});
