import { describe, it, expect, beforeEach } from 'vitest';
import { createSessionRecorder, exportRecording, getSessionDuration, getSessionSummary } from '../recording';
import { createTimeline, createTimelineEvent } from '../timeline';
import type { RuntimeInspectorSnapshot } from '../types';

describe('Session Recording', () => {
  let timeline: ReturnType<typeof createTimeline>;
  let recorder: ReturnType<typeof createSessionRecorder>;

  const mockSnapshot: RuntimeInspectorSnapshot = {
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

  beforeEach(() => {
    timeline = createTimeline(100);
    recorder = createSessionRecorder(timeline);
  });

  describe('createSessionRecorder', () => {
    it('should start and stop recording', () => {
      const id = recorder.start({ app: 'test' });
      expect(id).toBeDefined();
      expect(recorder.isRecording()).toBe(true);
      expect(recorder.getRecordingId()).toBe(id);

      const session = recorder.stop();
      expect(session).not.toBeNull();
      expect(session!.id).toBe(id);
      expect(session!.endTime).toBeGreaterThanOrEqual(session!.startTime);
      expect(session!.metadata).toEqual({ app: 'test' });
      expect(recorder.isRecording()).toBe(false);
    });

    it('should capture snapshots during recording', () => {
      recorder.start();
      recorder.captureSnapshot(mockSnapshot);
      recorder.captureSnapshot(mockSnapshot);

      const session = recorder.stop();
      expect(session!.snapshots).toHaveLength(2);
    });

    it('should not capture snapshots when not recording', () => {
      recorder.captureSnapshot(mockSnapshot);
      const session = recorder.stop();
      expect(session).toBeNull();
    });

    it('should add events during recording', () => {
      recorder.start();
      const event = createTimelineEvent('query.created', 'test', {});
      recorder.addEvent(event);

      const session = recorder.stop();
      expect(session!.events).toHaveLength(1);
    });

    it('should not add events when not recording', () => {
      const event = createTimelineEvent('query.created', 'test', {});
      recorder.addEvent(event);
      const session = recorder.stop();
      expect(session).toBeNull();
    });

    it('should start new session if already recording', () => {
      recorder.start({ first: true });
      const id2 = recorder.start({ second: true });
      expect(recorder.getRecordingId()).toBe(id2);
    });

    it('should stop current session before starting new', () => {
      recorder.start({ first: true });
      recorder.addEvent(createTimelineEvent('query.created', 'test', {}));
      recorder.start({ second: true });
      const session = recorder.stop();
      expect(session!.metadata).toEqual({ second: true });
    });

    it('should stop when max events reached', () => {
      const limitedRecorder = createSessionRecorder(timeline, { maxEvents: 3 });
      limitedRecorder.start();
      for (let i = 0; i < 10; i++) {
        limitedRecorder.addEvent(createTimelineEvent('query.created', 'test', { i }));
      }
      const session = limitedRecorder.stop();
      expect(session!.events.length).toBeLessThanOrEqual(3);
    });
  });

  describe('exportRecording', () => {
    it('should export session as JSON', () => {
      recorder.start();
      recorder.addEvent(createTimelineEvent('query.created', 'test', {}));
      const session = recorder.stop();
      const json = exportRecording(session!);
      const parsed = JSON.parse(json);
      expect(parsed.id).toBe(session!.id);
      expect(parsed.events).toHaveLength(1);
    });

    it('should handle Error objects in export', () => {
      recorder.start();
      recorder.addEvent(createTimelineEvent('query.error', 'test', {
        error: new Error('test error'),
      }));
      const session = recorder.stop();
      const json = exportRecording(session!);
      expect(json).toContain('test error');
    });
  });

  describe('getSessionDuration', () => {
    it('should return duration in ms', () => {
      recorder.start();
      const session = recorder.stop();
      expect(getSessionDuration(session!)).toBeGreaterThanOrEqual(0);
    });

    it('should use current time if not stopped', () => {
      recorder.start({ app: 'test' });
      const id = recorder.getRecordingId();
      // Manually create a recording-like object for testing
      const fakeSession = {
        id: id!,
        startTime: Date.now() - 1000,
        endTime: null,
        events: [],
        snapshots: [],
        metadata: {},
      };
      expect(getSessionDuration(fakeSession)).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('getSessionSummary', () => {
    it('should return summary with event types', () => {
      recorder.start();
      recorder.addEvent(createTimelineEvent('query.created', 'test', {}));
      recorder.addEvent(createTimelineEvent('query.created', 'test', {}));
      recorder.addEvent(createTimelineEvent('query.success', 'test', {}));
      recorder.captureSnapshot(mockSnapshot);
      const session = recorder.stop();

      const summary = getSessionSummary(session!);
      expect(summary.eventCount).toBe(3);
      expect(summary.snapshotCount).toBe(1);
      expect(summary.eventTypes['query.created']).toBe(2);
      expect(summary.eventTypes['query.success']).toBe(1);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
    });
  });
});
