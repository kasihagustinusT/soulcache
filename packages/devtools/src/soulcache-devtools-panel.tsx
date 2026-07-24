/**
 * SoulCacheDevToolsPanel
 *
 * Floating panel UI for inspecting SoulCache runtime state.
 * Renders as a portal at the bottom of the page with tabs for
 * queries, mutations, timeline, metrics, health, and settings.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SoulCacheDevTools } from './use-soulcache-devtools';
import type { DevToolsTab } from './devtools-context';
import { DevToolsContext } from './devtools-context';

export interface SoulCacheDevToolsPanelProps {
  readonly devtools: SoulCacheDevTools;
  /** Initial open state (default: false) */
  readonly defaultOpen?: boolean;
  /** Position of the panel (default: 'bottom') */
  readonly position?: 'bottom' | 'right';
  /** Whether to show the toggle button */
  readonly showToggleButton?: boolean;
  /** Custom toggle button render */
  readonly toggleButton?: (props: { isOpen: boolean; onToggle: () => void }) => React.ReactNode;
}

const TAB_LABELS: Record<DevToolsTab, string> = {
  queries: 'Queries',
  mutations: 'Mutations',
  timeline: 'Timeline',
  metrics: 'Metrics',
  health: 'Health',
  settings: 'Settings',
};

export function SoulCacheDevToolsPanel({
  devtools,
  defaultOpen = false,
  position = 'bottom',
  showToggleButton = true,
  toggleButton,
}: SoulCacheDevToolsPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<DevToolsTab>('queries');
  const [snapshot, setSnapshot] = useState(() => devtools.captureSnapshot());
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Refresh snapshot on tab change or when panel opens
  useEffect(() => {
    if (isOpen) {
      setSnapshot(devtools.captureSnapshot());
    }
  }, [isOpen, activeTab, devtools]);

  // Listen for keyboard shortcut to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        handleToggle();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggle]);

  return (
    <DevToolsContext.Provider value={{ devtools, isOpen, activeTab }}>
      {showToggleButton && !isOpen && (
        toggleButton ? (
          toggleButton({ isOpen, onToggle: handleToggle })
        ) : (
          <button
            onClick={handleToggle}
            style={{
              position: 'fixed',
              bottom: '16px',
              right: '16px',
              zIndex: 2147483647,
              background: '#1a1a2e',
              color: '#e0e0e0',
              border: '1px solid #333',
              borderRadius: '8px',
              padding: '8px 12px',
              cursor: 'pointer',
              fontSize: '12px',
              fontFamily: 'monospace',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}
            aria-label="Toggle SoulCache DevTools"
          >
            SoulCache
          </button>
        )
      )}
      {isOpen && (
        <div
          ref={panelRef}
          data-soulcache-devtools="true"
          style={{
            position: 'fixed',
            ...(position === 'bottom'
              ? { bottom: 0, left: 0, right: 0, height: '350px' }
              : { top: 0, right: 0, bottom: 0, width: '400px' }),
            zIndex: 2147483647,
            background: '#0d1117',
            color: '#c9d1d9',
            borderTop: '1px solid #30363d',
            borderLeft: position === 'right' ? '1px solid #30363d' : 'none',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
            fontSize: '13px',
            lineHeight: '1.5',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderBottom: '1px solid #30363d',
              background: '#161b22',
            }}
          >
            <span style={{ fontWeight: 600, color: '#58a6ff' }}>
              SoulCache DevTools
            </span>
            <button
              onClick={handleToggle}
              style={{
                background: 'none',
                border: 'none',
                color: '#8b949e',
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px',
              }}
              aria-label="Close DevTools"
            >
              ✕
            </button>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #30363d',
              background: '#161b22',
            }}
          >
            {(Object.keys(TAB_LABELS) as DevToolsTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  background: activeTab === tab ? '#0d1117' : 'transparent',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #58a6ff' : '2px solid transparent',
                  color: activeTab === tab ? '#58a6ff' : '#8b949e',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: activeTab === tab ? 600 : 400,
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {activeTab === 'queries' && <QueriesTab snapshot={snapshot} />}
            {activeTab === 'mutations' && <MutationsTab snapshot={snapshot} />}
            {activeTab === 'timeline' && <TimelineTab devtools={devtools} />}
            {activeTab === 'metrics' && <MetricsTab devtools={devtools} />}
            {activeTab === 'health' && <HealthTab devtools={devtools} />}
            {activeTab === 'settings' && <SettingsTab devtools={devtools} onRefresh={() => setSnapshot(devtools.captureSnapshot())} />}
          </div>
        </div>
      )}
    </DevToolsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Tab Components
// ---------------------------------------------------------------------------

function QueriesTab({ snapshot }: { snapshot: ReturnType<SoulCacheDevTools['captureSnapshot']> }) {
  if (snapshot.queries.length === 0) {
    return <EmptyState message="No cached queries" />;
  }

  return (
    <div>
      <div style={{ color: '#8b949e', marginBottom: '8px', fontSize: '12px' }}>
        {snapshot.queries.length} queries &middot; Cache size: {snapshot.cacheStats.size}
      </div>
      {snapshot.queries.map((q) => (
        <div
          key={q.keyHash}
          style={{
            padding: '8px',
            marginBottom: '4px',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <code style={{ color: '#58a6ff', fontSize: '12px' }}>{JSON.stringify(q.queryKey)}</code>
            <StatusBadge status={q.status} />
          </div>
          <div style={{ color: '#8b949e', fontSize: '11px' }}>
            Observers: {q.observerCount} &middot; Accesses: {q.accessCount} &middot; Size: {formatBytes(q.sizeBytes)}
          </div>
          {q.error && (
            <div style={{ color: '#f85149', fontSize: '11px', marginTop: '4px' }}>
              Error: {q.error.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MutationsTab({ snapshot }: { snapshot: ReturnType<SoulCacheDevTools['captureSnapshot']> }) {
  if (snapshot.mutations.length === 0) {
    return <EmptyState message="No mutations recorded" />;
  }

  return (
    <div>
      {snapshot.mutations.map((m) => (
        <div
          key={m.mutationId}
          style={{
            padding: '8px',
            marginBottom: '4px',
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: '6px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
            <code style={{ color: '#d2a8ff', fontSize: '12px' }}>{m.mutationId}</code>
            <StatusBadge status={m.status} />
          </div>
          <div style={{ color: '#8b949e', fontSize: '11px' }}>
            {m.duration !== null && <span>Duration: {m.duration}ms</span>}
            {m.error && <span style={{ color: '#f85149' }}> Error: {m.error.message}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function TimelineTab({ devtools }: { devtools: SoulCacheDevTools }) {
  const events = devtools.getTimeline();

  if (events.length === 0) {
    return <EmptyState message="No timeline events recorded" />;
  }

  return (
    <div>
      {events.slice(-50).reverse().map((event) => (
        <div
          key={event.id}
          style={{
            padding: '4px 8px',
            marginBottom: '2px',
            background: '#161b22',
            borderLeft: `3px solid ${getEventColor(event.type)}`,
            fontSize: '11px',
            fontFamily: 'monospace',
          }}
        >
          <span style={{ color: '#8b949e' }}>{new Date(event.timestamp).toLocaleTimeString()}</span>
          {' '}
          <span style={{ color: getEventColor(event.type) }}>{event.type}</span>
          {event.duration !== undefined && (
            <span style={{ color: '#8b949e' }}> ({event.duration}ms)</span>
          )}
        </div>
      ))}
    </div>
  );
}

function MetricsTab({ devtools }: { devtools: SoulCacheDevTools }) {
  const metrics = devtools.getMetrics();

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <MetricCard label="Total Queries" value={String(metrics.totalQueries)} />
        <MetricCard label="Total Fetches" value={String(metrics.totalFetches)} />
        <MetricCard label="Success Rate" value={`${metrics.overallSuccessRate.toFixed(1)}%`} />
        <MetricCard label="Avg Duration" value={`${metrics.averageFetchDuration.toFixed(0)}ms`} />
        <MetricCard label="P50" value={`${metrics.p50FetchDuration.toFixed(0)}ms`} />
        <MetricCard label="P95" value={`${metrics.p95FetchDuration.toFixed(0)}ms`} />
        <MetricCard label="P99" value={`${metrics.p99FetchDuration.toFixed(0)}ms`} />
        <MetricCard label="Errors" value={String(metrics.totalErrors)} />
      </div>
    </div>
  );
}

function HealthTab({ devtools }: { devtools: SoulCacheDevTools }) {
  const report = devtools.checkHealth();

  const statusColor = report.status === 'healthy' ? '#3fb950'
    : report.status === 'degraded' ? '#d29922'
    : '#f85149';

  return (
    <div>
      <div style={{
        padding: '12px',
        marginBottom: '12px',
        background: '#161b22',
        border: `1px solid ${statusColor}`,
        borderRadius: '6px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: statusColor, textTransform: 'uppercase' }}>
          {report.status}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div style={{ padding: '8px', background: '#161b22', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>Cache</div>
          <div>Size: {report.cacheHealth.size}/{report.cacheHealth.maxSize}</div>
          <div>Utilization: {report.cacheHealth.utilizationPercent.toFixed(1)}%</div>
          <div>GC Eligible: {report.cacheHealth.gcEligibleCount}</div>
        </div>
        <div style={{ padding: '8px', background: '#161b22', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '4px' }}>Scheduler</div>
          <div>Queue: {report.schedulerHealth.queueSize}/{report.schedulerHealth.maxQueueSize}</div>
          <div>Failure Rate: {report.schedulerHealth.failureRate.toFixed(1)}%</div>
        </div>
      </div>

      {report.issues.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '8px', color: '#c9d1d9' }}>
            Issues ({report.issues.length})
          </div>
          {report.issues.map((issue) => (
            <div
              key={issue.id}
              style={{
                padding: '8px',
                marginBottom: '4px',
                background: '#161b22',
                borderLeft: `3px solid ${
                  issue.severity === 'error' ? '#f85149'
                  : issue.severity === 'warning' ? '#d29922'
                  : '#58a6ff'
                }`,
                borderRadius: '0 6px 6px 0',
                fontSize: '12px',
              }}
            >
              <span style={{ fontWeight: 600 }}>[{issue.severity.toUpperCase()}]</span>{' '}
              {issue.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsTab({ devtools, onRefresh }: { devtools: SoulCacheDevTools; onRefresh: () => void }) {
  return (
    <div>
      <button
        onClick={() => { devtools.clear(); onRefresh(); }}
        style={buttonStyle}
      >
        Clear DevTools Data
      </button>
      <button
        onClick={() => { onRefresh(); }}
        style={buttonStyle}
      >
        Refresh Snapshot
      </button>
      <div style={{ marginTop: '16px', color: '#8b949e', fontSize: '12px' }}>
        <div>Keyboard shortcut: Ctrl/Cmd + Shift + D</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function EmptyState({ message }: { message: string }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: '#484f58',
      fontSize: '13px',
    }}>
      {message}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    success: '#3fb950',
    loading: '#d29922',
    error: '#f85149',
    idle: '#484f58',
    pending: '#d29922',
    fetching: '#58a6ff',
    stale: '#8b949e',
  };
  const color = colorMap[status] ?? '#484f58';

  return (
    <span style={{
      padding: '2px 6px',
      borderRadius: '4px',
      fontSize: '10px',
      fontWeight: 600,
      textTransform: 'uppercase',
      color,
      background: `${color}20`,
    }}>
      {status}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '8px',
      background: '#161b22',
      borderRadius: '6px',
      border: '1px solid #30363d',
    }}>
      <div style={{ fontSize: '11px', color: '#8b949e', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '16px', fontWeight: 600, color: '#c9d1d9' }}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getEventColor(type: string): string {
  if (type.includes('error')) return '#f85149';
  if (type.includes('success')) return '#3fb950';
  if (type.includes('fetch') || type.includes('pending')) return '#d29922';
  if (type.includes('created')) return '#58a6ff';
  if (type.includes('removed')) return '#8b949e';
  return '#c9d1d9';
}

const buttonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '8px 12px',
  marginBottom: '8px',
  background: '#21262d',
  border: '1px solid #30363d',
  borderRadius: '6px',
  color: '#c9d1d9',
  cursor: 'pointer',
  fontSize: '13px',
  textAlign: 'left' as const,
};
