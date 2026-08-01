import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Scheduler } from '../../src/scheduler/scheduler';

describe('scheduler dependency starvation', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  afterEach(() => {
    scheduler.destroy();
  });

  it('should not starve when a sync dependency completes in a prior flush', () => {
    // Schedule and complete depId in flush 1 (cleaned up before flush 2)
    const depId = scheduler.schedule({
      category: 'query-execution',
      fn: () => {},
    });
    scheduler.flush();

    // Schedule a dependent referencing the already-completed dep
    const fn = vi.fn();
    scheduler.schedule({
      category: 'query-execution',
      dependencies: [depId],
      fn,
    });

    // Without fix: depId cleaned up → _dependenciesMet returns false → re-queued forever
    scheduler.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(scheduler.getMetrics().totalCompleted).toBe(2);
  });

  it('should cancel dependent when its dependency fails', () => {
    const depId = scheduler.schedule({
      category: 'query-execution',
      fn: () => {
        throw new Error('dep failure');
      },
    });
    const fn = vi.fn();
    scheduler.schedule({
      category: 'query-execution',
      dependencies: [depId],
      fn,
    });

    scheduler.flush();

    // depId failed, dependant should be cancelled (not starved)
    expect(fn).not.toHaveBeenCalled();
    expect(scheduler.getMetrics().totalFailed).toBe(1);

    // Second flush: dependant was already cancelled, no re-queue
    scheduler.flush();
    expect(fn).not.toHaveBeenCalled();
    expect(scheduler.queueSize).toBe(0);
  });

  it('should cancel dependent when its dependency is cancelled', () => {
    const depId = scheduler.schedule({
      category: 'query-execution',
      fn: () => {},
    });
    const fn = vi.fn();
    scheduler.schedule({
      category: 'query-execution',
      dependencies: [depId],
      fn,
    });

    // Cancel the dependency before it runs
    scheduler.cancel(depId);

    scheduler.flush();

    // dependant should be cancelled (not starved)
    expect(fn).not.toHaveBeenCalled();
    expect(scheduler.getMetrics().totalCancelled).toBe(2);

    // No re-queue on subsequent flushes
    scheduler.flush();
    expect(fn).not.toHaveBeenCalled();
    expect(scheduler.queueSize).toBe(0);
  });

  it('should cancel dependent when its dependency never existed', () => {
    const fn = vi.fn();
    scheduler.schedule({
      category: 'query-execution',
      dependencies: ['nonexistent-task-id'],
      fn,
    });

    scheduler.flush();

    // dependant should be cancelled, not starved
    expect(fn).not.toHaveBeenCalled();
    expect(scheduler.getMetrics().totalCancelled).toBe(1);
    expect(scheduler.queueSize).toBe(0);
  });

  it('should allow valid dependency chain to complete across flushes', () => {
    const order: string[] = [];
    const depId = scheduler.schedule({
      category: 'query-execution',
      fn: () => {
        order.push('dep');
      },
    });
    const dependId = scheduler.schedule({
      category: 'query-execution',
      dependencies: [depId],
      fn: () => {
        order.push('dependent');
      },
    });

    scheduler.flush();
    scheduler.flush();

    expect(order).toEqual(['dep', 'dependent']);
    expect(scheduler.getMetrics().totalCompleted).toBe(2);
    expect(scheduler.queueSize).toBe(0);
  });

  it('should cascade cancellation through a dependency chain', () => {
    // dep → mid → leaf
    // If dep fails, mid and leaf should both be cancelled
    const depId = scheduler.schedule({
      category: 'query-execution',
      fn: () => {
        throw new Error('root failure');
      },
    });
    const midId = scheduler.schedule({
      category: 'query-execution',
      dependencies: [depId],
      fn: () => {},
    });
    const leafFn = vi.fn();
    scheduler.schedule({
      category: 'query-execution',
      dependencies: [midId],
      fn: leafFn,
    });

    scheduler.flush();

    expect(scheduler.getMetrics().totalFailed).toBe(1); // dep failed
    // mid and leaf should be cancelled, not starved
    expect(scheduler.getMetrics().totalCancelled).toBe(2);
    expect(leafFn).not.toHaveBeenCalled();

    scheduler.flush();
    expect(leafFn).not.toHaveBeenCalled();
    expect(scheduler.queueSize).toBe(0);
  });
});
