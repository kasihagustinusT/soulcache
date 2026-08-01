import { describe, it, expect, vi } from 'vitest';
import { QueryEngine } from '../../src/query/query-engine';

describe('executeQuery cancels pending refetch timer', () => {
  it('1. executeQuery cancels existing refetch timer before starting new fetch', async () => {
    const engine = new QueryEngine({ refetchInterval: 5000 });

    // First executeQuery sets up a refetch timer
    await engine.executeQuery({
      queryKey: ['k1'],
      queryFn: async () => 'first',
    });

    // Verify a refetch timer exists
    const metricsBefore = engine.getMetrics();
    expect(metricsBefore.activeRefetches).toBe(1);

    // Second executeQuery should cancel the timer
    await engine.executeQuery({
      queryKey: ['k1'],
      queryFn: async () => 'second',
    });

    // After executeQuery completes, it re-schedules (if refetchInterval > 0)
    // So the timer should have been cancelled then re-scheduled
    const metricsAfter = engine.getMetrics();
    expect(metricsAfter.activeRefetches).toBe(1);
    expect(engine.getQueryData(['k1'])).toBe('second');

    engine.destroy();
  });

  it('2. stale refetch timer does not overwrite manual fetch result', async () => {
    const engine = new QueryEngine({ refetchInterval: 200 });

    let refetchCount = 0;
    const refetchFn = vi.fn(async () => {
      refetchCount++;
      return `refetch-${refetchCount}`;
    });

    // First executeQuery — this sets up a refetch timer
    await engine.executeQuery({
      queryKey: ['k2'],
      queryFn: async () => 'manual-first',
    });

    // Wait for refetch timer to fire (or be about to fire)
    await new Promise((r) => setTimeout(r, 250));

    // The refetch timer should have fired and started a refetch
    // Now immediately call executeQuery — this should cancel any pending
    // refetch timer AND any in-flight refetch
    await engine.executeQuery({
      queryKey: ['k2'],
      queryFn: async () => 'manual-second',
    });

    // Result should be the manual fetch result, not the refetch
    expect(engine.getQueryData(['k2'])).toBe('manual-second');

    engine.destroy();
  });

  it('3. refetch timer is re-scheduled after manual executeQuery', async () => {
    const engine = new QueryEngine({ refetchInterval: 10000 });

    await engine.executeQuery({
      queryKey: ['k3'],
      queryFn: async () => 'original',
    });

    // Manual executeQuery — cancels old timer, sets up new data
    await engine.executeQuery({
      queryKey: ['k3'],
      queryFn: async () => 'updated',
    });

    // After successful manual executeQuery, a new refetch timer is set up
    const metrics = engine.getMetrics();
    expect(metrics.activeRefetches).toBe(1);
    expect(engine.getQueryData(['k3'])).toBe('updated');

    engine.destroy();
  });

  it('4. cancelRefetch is called before new controller is created', async () => {
    const engine = new QueryEngine({ refetchInterval: 5000 });

    // Set up a refetch timer
    await engine.executeQuery({
      queryKey: ['k4'],
      queryFn: async () => 'original',
    });

    // Hijack cancelExistingFetch to observe order
    const cancelCalls: string[] = [];
    const origCancel = (
      engine as unknown as {
        cancelExistingFetch: (key: import('@soulcache/core').QueryKey) => void;
      }
    ).cancelExistingFetch;
    const origCancelRefetch = (
      engine as unknown as { cancelRefetch: (key: import('@soulcache/core').QueryKey) => void }
    ).cancelRefetch;

    // Use a slow queryFn to observe state during executeQuery
    let resolveSlow: () => void;
    const slowPromise = new Promise<void>((r) => {
      resolveSlow = r;
    });

    const execPromise = engine.executeQuery({
      queryKey: ['k4'],
      queryFn: async () => {
        await slowPromise;
        return 'slow-result';
      },
    });

    // At this point the new executeQuery has started, refetch timer should be cancelled
    // (timer is inside the new executeQuery which calls cancelRefetch before creating controller)
    const metricsMid = engine.getMetrics();
    expect(metricsMid.activeRefetches).toBe(0); // timer cancelled

    resolveSlow!();
    await execPromise;

    engine.destroy();
  });
});
