/**
 * Session Recording
 *
 * Records runtime sessions for debugging and replay.
 * Captures timeline events and state snapshots at configurable intervals.
 */

import type {
  SessionRecording,
  RecordingOptions,
  RuntimeInspectorSnapshot,
  TimelineEvent,
} from './types';

let sessionId = 0;

function generateSessionId(): string {
  sessionId++;
  return `session-${String(sessionId)}`;
}

/** Session recorder interface */
export interface SessionRecorder {
  /** Start recording */
  start(metadata?: Record<string, unknown>): string;
  /** Stop recording and return the session */
  stop(): SessionRecording | null;
  /** Capture a state snapshot during recording */
  captureSnapshot(snapshot: RuntimeInspectorSnapshot): void;
  /** Add a timeline event during recording */
  addEvent(event: TimelineEvent): void;
  /** Check if currently recording */
  isRecording(): boolean;
  /** Get current recording ID */
  getRecordingId(): string | null;
}

/**
 * Create a session recorder.
 */
export function createSessionRecorder(
  _timeline: unknown,
  options?: RecordingOptions,
): SessionRecorder {
  const maxEvents = options?.maxEvents ?? 10000;
  const maxSnapshots = options?.maxSnapshots ?? 100;
  const recordTimeline = options?.recordTimeline ?? true;
  const recordSnapshots = options?.recordSnapshots ?? true;

  // Internal mutable recording state
  interface MutableRecording {
    id: string;
    startTime: number;
    endTime: number | null;
    events: TimelineEvent[];
    snapshots: RuntimeInspectorSnapshot[];
    metadata: Record<string, unknown>;
  }

  let recording: MutableRecording | null = null;

  function start(metadata: Record<string, unknown> = {}): string {
    if (recording) {
      stop();
    }

    const id = generateSessionId();
    recording = {
      id,
      startTime: Date.now(),
      endTime: null,
      events: [],
      snapshots: [],
      metadata,
    };

    return id;
  }

  function stop(): SessionRecording | null {
    if (!recording) return null;

    const completed: SessionRecording = {
      ...recording,
      endTime: Date.now(),
    };

    recording = null;
    return completed;
  }

  function captureSnapshot(snapshot: RuntimeInspectorSnapshot): void {
    if (!recording || !recordSnapshots) return;

    if (recording.snapshots.length >= maxSnapshots) {
      recording.snapshots = recording.snapshots.slice(-maxSnapshots);
    }

    recording.snapshots.push(snapshot);
  }

  function addEvent(event: TimelineEvent): void {
    if (!recording || !recordTimeline) return;

    if (recording.events.length >= maxEvents) {
      recording.events = recording.events.slice(-(maxEvents - 1));
    }

    recording.events.push(event);
  }

  function isRecording(): boolean {
    return recording !== null;
  }

  function getRecordingId(): string | null {
    return recording?.id ?? null;
  }

  return {
    start,
    stop,
    captureSnapshot,
    addEvent,
    isRecording,
    getRecordingId,
  };
}

/** Export a session recording as JSON */
export function exportRecording(session: SessionRecording): string {
  return JSON.stringify(session, (_key, value) => {
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    return value;
  }, 2);
}

/** Calculate session duration in milliseconds */
export function getSessionDuration(session: SessionRecording): number {
  return (session.endTime ?? Date.now()) - session.startTime;
}

/** Get summary statistics for a session recording */
export function getSessionSummary(session: SessionRecording): {
  readonly duration: number;
  readonly eventCount: number;
  readonly snapshotCount: number;
  readonly eventTypes: Record<string, number>;
} {
  const eventTypes: Record<string, number> = {};
  for (const event of session.events) {
    eventTypes[event.type] = (eventTypes[event.type] ?? 0) + 1;
  }

  return {
    duration: getSessionDuration(session),
    eventCount: session.events.length,
    snapshotCount: session.snapshots.length,
    eventTypes,
  };
}
