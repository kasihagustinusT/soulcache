import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryEngine } from '../../src/query/query-engine';

describe('removeQuery must cancel refetch timers via onRemoveQuery', () => {
  let engine: QueryEngine;

  beforeEach(() => {
    vi.useFakeTimers();
    engine = new QueryEngine({ refetchInterval: 1000 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('removeQuery triggers cancelQuery which clears timers', async () => {
    const fnA = vi.fn().mockResolvedValue('data-a');
    await engine.executeQuery({
      queryKey: ['bug88', 'key'],
      queryFn: fnA,
    });
    expect(engine.getMetrics().activeRefetches).toBe(1);
    const cancelSpy = vi.spyOn(engine as any, 'cancelQuery');
    engine.client.removeQuery(['bug88', 'key']);
    expect(cancelSpy).toHaveBeenCalledWith(['bug88', 'key']);
    expect(engine.getMetrics().activeRefetches).toBe(0);
  });

  it('after removeQuery, stale timer must not refetch with old fn', async () => {
    const fnA = vi.fn().mockResolvedValue('data-a');
    await engine.executeQuery({
      queryKey: ['bug88', 'stale'],
      queryFn: fnA,
    });
    engine.client.removeQuery(['bug88', 'stale']);
    await engine.executeQuery({
      queryKey: ['bug88', 'stale'],
      queryFn: async () => 'data-b',
    });
    vi.advanceTimersByTime(2000);
    expect(fnA).toHaveBeenCalledTimes(1);
    const data = engine.client.getQueryData(['bug88', 'stale']);
    expect(data).toBe('data-b');
  });

  it('removeQuery is idempotent for timer cleanup', () => {
    engine.client.removeQuery(['bug88', 'missing']);
    engine.client.removeQuery(['bug88', 'missing']);
  });

  it('removeQuery on destroyed client throws (expected)', () => {
    engine.destroy();
    expect(() => engine.client.removeQuery(['bug88', 'post-destroy'])).toThrow(
      'QueryClient has been destroyed',
    );
  });
});
