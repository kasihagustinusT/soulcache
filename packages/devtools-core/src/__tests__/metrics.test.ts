import { describe, it, expect, beforeEach } from 'vitest';
import { createMetricsCollector, extractMetricsFromEvents } from '../metrics';

describe('Metrics', () => {
  describe('createMetricsCollector', () => {
    let collector: ReturnType<typeof createMetricsCollector>;

    beforeEach(() => {
      collector = createMetricsCollector();
    });

    it('should record fetch events', () => {
      collector.recordFetch('q1', 'hash1', 100, true);
      const metrics = collector.getQueryMetrics('q1');
      expect(metrics).toBeDefined();
      expect(metrics!.fetchCount).toBe(1);
      expect(metrics!.successCount).toBe(1);
      expect(metrics!.errorCount).toBe(0);
      expect(metrics!.averageFetchDuration).toBe(100);
      expect(metrics!.lastFetchDuration).toBe(100);
    });

    it('should record errors', () => {
      collector.recordFetch('q1', 'hash1', 50, false);
      const metrics = collector.getQueryMetrics('q1');
      expect(metrics!.errorCount).toBe(1);
      expect(metrics!.successCount).toBe(0);
    });

    it('should track multiple fetches', () => {
      collector.recordFetch('q1', 'hash1', 100, true);
      collector.recordFetch('q1', 'hash1', 200, true);
      collector.recordFetch('q1', 'hash1', 150, false);
      const metrics = collector.getQueryMetrics('q1');
      expect(metrics!.fetchCount).toBe(3);
      expect(metrics!.successCount).toBe(2);
      expect(metrics!.errorCount).toBe(1);
      expect(metrics!.averageFetchDuration).toBe(150);
      expect(metrics!.totalFetchDuration).toBe(450);
    });

    it('should return undefined for unknown query', () => {
      expect(collector.getQueryMetrics('unknown')).toBeUndefined();
    });

    it('should get aggregated metrics', () => {
      collector.recordFetch('q1', 'hash1', 100, true);
      collector.recordFetch('q2', 'hash2', 200, true);
      collector.recordFetch('q1', 'hash1', 150, false);

      const agg = collector.getAggregatedMetrics();
      expect(agg.totalQueries).toBe(2);
      expect(agg.totalFetches).toBe(3);
      expect(agg.totalErrors).toBe(1);
      expect(agg.overallSuccessRate).toBeCloseTo(66.67, 1);
      expect(agg.queries).toHaveLength(2);
    });

    it('should handle empty metrics', () => {
      const agg = collector.getAggregatedMetrics();
      expect(agg.totalQueries).toBe(0);
      expect(agg.totalFetches).toBe(0);
      expect(agg.overallSuccessRate).toBe(0);
      expect(agg.p50FetchDuration).toBe(0);
    });

    it('should clear metrics', () => {
      collector.recordFetch('q1', 'hash1', 100, true);
      collector.clear();
      expect(collector.getQueryMetrics('q1')).toBeUndefined();
    });
  });

  describe('extractMetricsFromEvents', () => {
    it('should extract metrics from timeline events', () => {
      const events = [
        {
          id: 'e1',
          type: 'query.fetching' as const,
          timestamp: Date.now(),
          source: 'test',
          payload: { queryId: 'q1', keyHash: 'hash1' },
          duration: 100,
        },
        {
          id: 'e2',
          type: 'query.fetching' as const,
          timestamp: Date.now(),
          source: 'test',
          payload: { queryId: 'q1', keyHash: 'hash1' },
          duration: 200,
        },
      ];
      const collector = extractMetricsFromEvents(events);
      const metrics = collector.getQueryMetrics('q1');
      expect(metrics).toBeDefined();
      expect(metrics!.fetchCount).toBe(2);
    });
  });
});
