/**
 * @soulcache/devtools-core
 *
 * Framework-agnostic inspection and diagnostics layer for SoulCache DevTools.
 *
 * @packageDocumentation
 */

// Types
export type {
  QueryInspectorSnapshot,
  MutationInspectorSnapshot,
  ObserverInspectorSnapshot,
  RuntimeInspectorSnapshot,
  CacheStatsSnapshot,
  SchedulerMetricsSnapshot,
  CustomSerializer,
  SerializationOptions,
  SerializedValue,
  TimelineEventType,
  TimelineEvent,
  TimelineSnapshot,
  TimelineFilter,
  QueryMetrics,
  AggregatedMetrics,
  DiagnosticSeverity,
  DiagnosticIssue,
  HealthStatus,
  HealthReport,
  CacheHealthMetrics,
  SchedulerHealthMetrics,
  SessionRecording,
  RecordingOptions,
  DevToolsConfig,
} from './types';

// Inspector
export { createInspector } from './inspector';
export type { Inspector } from './inspector';

// Serializer
export { createSerializer, defaultSerializer } from './serializer';

// Timeline
export { createTimeline, createTimelineEvent } from './timeline';
export type { TimelineEngine } from './timeline';

// Metrics
export { createMetricsCollector, extractMetricsFromEvents } from './metrics';
export type { MetricsCollector } from './metrics';

// Diagnostics
export { createDiagnostics } from './diagnostics';
export type { DiagnosticsEngine } from './diagnostics';

// Session Recording
export { createSessionRecorder, exportRecording, getSessionDuration, getSessionSummary } from './recording';
export type { SessionRecorder } from './recording';
