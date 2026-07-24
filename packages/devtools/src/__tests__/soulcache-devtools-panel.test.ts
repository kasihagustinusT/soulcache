import { describe, it, expect, vi } from 'vitest';

// Mock React
vi.mock('react', () => ({
  useState: (val: unknown) => [val, vi.fn()],
  useCallback: (fn: unknown) => fn,
  useEffect: () => {},
  useRef: (val: unknown) => ({ current: val }),
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
  }),
  createTimeline: () => ({
    getEvents: () => [],
    getFilteredEvents: () => [],
  }),
  createMetricsCollector: () => ({
    getAggregatedMetrics: () => ({
      totalQueries: 0, totalFetches: 0, totalErrors: 0, overallSuccessRate: 0,
      averageFetchDuration: 0, p50FetchDuration: 0, p95FetchDuration: 0, p99FetchDuration: 0,
      memoryEstimateBytes: 0, queries: [],
    }),
  }),
  extractMetricsFromEvents: () => ({
    getAggregatedMetrics: () => ({
      totalQueries: 0, totalFetches: 0, totalErrors: 0, overallSuccessRate: 0,
      averageFetchDuration: 0, p50FetchDuration: 0, p95FetchDuration: 0, p99FetchDuration: 0,
      memoryEstimateBytes: 0, queries: [],
    }),
  }),
  createDiagnostics: () => ({
    checkHealth: () => ({
      status: 'healthy',
      issues: [],
      cacheHealth: { size: 0, maxSize: 0, utilizationPercent: 0, gcEligibleCount: 0, hitRate: 0 },
      schedulerHealth: { queueSize: 0, maxQueueSize: 0, utilizationPercent: 0, failureRate: 0, avgTaskDuration: 0 },
      timestamp: Date.now(),
    }),
  }),
  createSessionRecorder: () => ({
    start: () => 'session-1',
    stop: () => null,
    isRecording: () => false,
  }),
  exportRecording: (s: { id: string }) => JSON.stringify(s),
  getSessionSummary: () => ({
    duration: 0,
    eventCount: 0,
    snapshotCount: 0,
    eventTypes: {},
  }),
  createTimelineEvent: (type: string, source: string, payload: Record<string, unknown>) => ({
    id: 'test-id',
    type,
    timestamp: Date.now(),
    source,
    payload,
  }),
}));

describe('SoulCacheDevToolsPanel', () => {
  it('should export panel component', async () => {
    const mod = await import('../soulcache-devtools-panel');
    expect(typeof mod.SoulCacheDevToolsPanel).toBe('function');
  });

  it('should export correct props type', async () => {
    const mod = await import('../soulcache-devtools-panel');
    const Component: typeof mod.SoulCacheDevToolsPanel = mod.SoulCacheDevToolsPanel;
    expect(Component).toBeDefined();
  });
});
