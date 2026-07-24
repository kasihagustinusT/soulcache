import { describe, it, expect, beforeEach } from 'vitest';
import { createTimeline, createTimelineEvent } from '../timeline';
import type { TimelineEvent } from '../types';

describe('Timeline', () => {
  describe('createTimelineEvent', () => {
    it('should create a timeline event', () => {
      const event = createTimelineEvent('query.created', 'test', { queryId: 'q1' });
      expect(event.type).toBe('query.created');
      expect(event.source).toBe('test');
      expect(event.payload).toEqual({ queryId: 'q1' });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeGreaterThan(0);
    });

    it('should include duration and metadata', () => {
      const event = createTimelineEvent('query.success', 'test', { queryId: 'q1' }, {
        duration: 100,
        metadata: { key: 'value' },
      });
      expect(event.duration).toBe(100);
      expect(event.metadata).toEqual({ key: 'value' });
    });
  });

  describe('createTimeline', () => {
    let timeline: ReturnType<typeof createTimeline>;

    beforeEach(() => {
      timeline = createTimeline(5);
    });

    it('should record events', () => {
      const event = createTimelineEvent('query.created', 'test', {});
      timeline.record(event);
      expect(timeline.size).toBe(1);
    });

    it('should enforce max capacity', () => {
      for (let i = 0; i < 10; i++) {
        timeline.record(createTimelineEvent('query.created', 'test', { i }));
      }
      expect(timeline.size).toBe(5);
    });

    it('should keep newest events when capacity exceeded', () => {
      for (let i = 0; i < 10; i++) {
        timeline.record(createTimelineEvent('query.created', 'test', { i }));
      }
      const events = timeline.getEvents();
      expect((events[0]!.payload['i'] as number)).toBe(5);
    });

    it('should return all events', () => {
      timeline.record(createTimelineEvent('query.created', 'test', {}));
      timeline.record(createTimelineEvent('query.success', 'test', {}));
      expect(timeline.getEvents()).toHaveLength(2);
    });

    it('should filter by type', () => {
      timeline.record(createTimelineEvent('query.created', 'test', {}));
      timeline.record(createTimelineEvent('query.success', 'test', {}));
      timeline.record(createTimelineEvent('mutation.created', 'test', {}));

      const filtered = timeline.getFilteredEvents({ types: ['query.created', 'query.success'] });
      expect(filtered).toHaveLength(2);
    });

    it('should filter by source', () => {
      timeline.record(createTimelineEvent('query.created', 'source-a', {}));
      timeline.record(createTimelineEvent('query.created', 'source-b', {}));

      const filtered = timeline.getFilteredEvents({ source: 'source-a' });
      expect(filtered).toHaveLength(1);
    });

    it('should filter by time range', () => {
      // Use explicit timestamps to avoid Date.now() coalescence
      const baseTime = Date.now();
      const e1 = { id: 'e1', type: 'query.created' as const, timestamp: baseTime, source: 'test', payload: {} };
      const e2 = { id: 'e2', type: 'query.success' as const, timestamp: baseTime + 100, source: 'test', payload: {} };
      timeline.record(e1);
      timeline.record(e2);

      // Filter to only include events at or before e1's timestamp
      const filtered = timeline.getFilteredEvents({
        startTime: baseTime,
        endTime: baseTime,
      });
      expect(filtered).toHaveLength(1);
    });

    it('should filter by queryId', () => {
      timeline.record(createTimelineEvent('query.created', 'test', { queryId: 'q1' }));
      timeline.record(createTimelineEvent('query.created', 'test', { queryId: 'q2' }));

      const filtered = timeline.getFilteredEvents({ queryId: 'q1' });
      expect(filtered).toHaveLength(1);
    });

    it('should get query-specific events', () => {
      timeline.record(createTimelineEvent('query.created', 'test', { queryId: 'q1' }));
      timeline.record(createTimelineEvent('query.success', 'test', { queryId: 'q1' }));
      timeline.record(createTimelineEvent('query.created', 'test', { queryId: 'q2' }));

      const events = timeline.getQueryEvents('q1');
      expect(events).toHaveLength(2);
    });

    it('should return snapshot', () => {
      timeline.record(createTimelineEvent('query.created', 'test', {}));
      const snapshot = timeline.getSnapshot();
      expect(snapshot.totalEvents).toBe(1);
      expect(snapshot.events).toHaveLength(1);
    });

    it('should get event by ID', () => {
      const event = createTimelineEvent('query.created', 'test', {});
      timeline.record(event);
      const found = timeline.getById(event.id);
      expect(found).toBe(event);
    });

    it('should return undefined for unknown ID', () => {
      expect(timeline.getById('unknown')).toBeUndefined();
    });

    it('should get events in time range', () => {
      const e1 = createTimelineEvent('query.created', 'test', {});
      timeline.record(e1);
      const e2 = createTimelineEvent('query.success', 'test', {});
      timeline.record(e2);

      const events = timeline.getEventsInRange(e1.timestamp, e2.timestamp);
      expect(events).toHaveLength(2);
    });

    it('should clear all events', () => {
      timeline.record(createTimelineEvent('query.created', 'test', {}));
      timeline.record(createTimelineEvent('query.success', 'test', {}));
      timeline.clear();
      expect(timeline.size).toBe(0);
    });

    it('should handle empty timeline', () => {
      expect(timeline.size).toBe(0);
      expect(timeline.getEvents()).toHaveLength(0);
      expect(timeline.getSnapshot().totalEvents).toBe(0);
    });
  });
});
