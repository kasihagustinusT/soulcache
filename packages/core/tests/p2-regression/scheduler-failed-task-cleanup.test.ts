import { describe, it, expect, beforeEach } from 'vitest';
import { Scheduler } from '../../src/scheduler/scheduler';

describe('Failed scheduler tasks cleaned up', () => {
  let scheduler: Scheduler;

  beforeEach(() => {
    scheduler = new Scheduler();
  });

  it('failed tasks are cleaned up after flush', async () => {
    scheduler.schedule({
      key: 'fail-task',
      category: 'test',
      fn: async () => {
        throw new Error('task failure');
      },
    });

    // Flush triggers execution + cleanup
    scheduler.flush();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const metrics = scheduler.getMetrics();
    expect(metrics.queueSize).toBe(0);
    expect(metrics.activeTaskCount).toBe(0);
  });

  it('completed tasks are cleaned up after flush', async () => {
    scheduler.schedule({
      key: 'ok-task',
      category: 'test',
      fn: async () => 'done',
    });

    scheduler.flush();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const metrics = scheduler.getMetrics();
    expect(metrics.queueSize).toBe(0);
    expect(metrics.activeTaskCount).toBe(0);
  });
});
