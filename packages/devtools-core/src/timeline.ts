/**
 * Timeline
 *
 * Event recording, filtering, and playback engine for the DevTools timeline view.
 * Records all runtime events and provides query/filter/export capabilities.
 */

import type {
  TimelineEvent,
  TimelineEventType,
  TimelineFilter,
  TimelineSnapshot,
} from './types';

let timelineEventId = 0;

function generateTimelineEventId(): string {
  timelineEventId++;
  return `te-${String(timelineEventId)}`;
}

/**
 * Create a timeline event from partial data.
 */
export function createTimelineEvent(
  type: TimelineEventType,
  source: string,
  payload: Record<string, unknown>,
  options?: { duration?: number; metadata?: Record<string, unknown> },
): TimelineEvent {
  return {
    id: generateTimelineEventId(),
    type,
    timestamp: Date.now(),
    source,
    payload,
    duration: options?.duration,
    metadata: options?.metadata,
  };
}

/**
 * Timeline engine for recording and querying events.
 */
export interface TimelineEngine {
  /** Record a timeline event */
  record(event: TimelineEvent): void;
  /** Get all recorded events */
  getEvents(): readonly TimelineEvent[];
  /** Get events matching a filter */
  getFilteredEvents(filter: TimelineFilter): readonly TimelineEvent[];
  /** Get a snapshot of the timeline */
  getSnapshot(): TimelineSnapshot;
  /** Get events for a specific query */
  getQueryEvents(queryId: string): readonly TimelineEvent[];
  /** Get the number of recorded events */
  get size(): number;
  /** Clear all recorded events */
  clear(): void;
  /** Get event by ID */
  getById(id: string): TimelineEvent | undefined;
  /** Get events in a time range */
  getEventsInRange(start: number, end: number): readonly TimelineEvent[];
}

/**
 * Create a timeline engine with the given capacity.
 */
export function createTimeline(maxEvents: number = 1000): TimelineEngine {
  let events: TimelineEvent[] = [];

  function record(event: TimelineEvent): void {
    events.push(event);
    if (events.length > maxEvents) {
      events = events.slice(-maxEvents);
    }
  }

  function getEvents(): readonly TimelineEvent[] {
    return events;
  }

  function getFilteredEvents(filter: TimelineFilter): readonly TimelineEvent[] {
    return events.filter((event) => {
      if (filter.types && filter.types.length > 0) {
        if (!filter.types.includes(event.type)) return false;
      }
      if (filter.source && event.source !== filter.source) return false;
      if (filter.startTime && event.timestamp < filter.startTime) return false;
      if (filter.endTime && event.timestamp > filter.endTime) return false;
      if (filter.queryId) {
        const eventQueryId = event.payload['queryId'] as string | undefined;
        if (eventQueryId !== filter.queryId) return false;
      }
      return true;
    });
  }

  function getSnapshot(): TimelineSnapshot {
    return {
      events: [...events],
      startTimestamp: events[0]?.timestamp ?? Date.now(),
      endTimestamp: events[events.length - 1]?.timestamp ?? Date.now(),
      totalEvents: events.length,
    };
  }

  function getQueryEvents(queryId: string): readonly TimelineEvent[] {
    return events.filter((event) => {
      const eventQueryId = event.payload['queryId'] as string | undefined;
      return eventQueryId === queryId;
    });
  }

  function getById(id: string): TimelineEvent | undefined {
    return events.find((event) => event.id === id);
  }

  function getEventsInRange(start: number, end: number): readonly TimelineEvent[] {
    return events.filter((event) => event.timestamp >= start && event.timestamp <= end);
  }

  function clear(): void {
    events = [];
  }

  return {
    record,
    getEvents,
    getFilteredEvents,
    getSnapshot,
    getQueryEvents,
    get size() {
      return events.length;
    },
    clear,
    getById,
    getEventsInRange,
  };
}
