/**
 * @soulcache/devtools
 *
 * React DevTools panel for inspecting and debugging SoulCache runtime state.
 *
 * @packageDocumentation
 */

// Hook
export { useSoulCacheDevTools } from './use-soulcache-devtools';
export type { SoulCacheDevTools, UseSoulCacheDevToolsOptions } from './use-soulcache-devtools';

// Panel
export { SoulCacheDevToolsPanel } from './soulcache-devtools-panel';
export type { SoulCacheDevToolsPanelProps } from './soulcache-devtools-panel';

// Context
export { DevToolsContext, useDevToolsContext } from './devtools-context';
export type { DevToolsContextValue, DevToolsTab } from './devtools-context';

// Re-export core types for convenience
export type {
  QueryInspectorSnapshot,
  MutationInspectorSnapshot,
  RuntimeInspectorSnapshot,
  CacheStatsSnapshot,
  SchedulerMetricsSnapshot,
  TimelineEvent,
  TimelineFilter,
  AggregatedMetrics,
  HealthReport,
  SessionRecording,
  DevToolsConfig,
} from '@soulcache/devtools-core';
