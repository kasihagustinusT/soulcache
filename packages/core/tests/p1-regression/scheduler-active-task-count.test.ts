import { describe, it, expect, vi, afterEach } from 'vitest';
import { Scheduler } from '../../src/scheduler/scheduler';

describe('activeTaskCount must decrement after destroy', () => {
  let scheduler: Scheduler;

  afterEach(() => {
    if (!scheduler.isDestroyed) scheduler.destroy();
  });

  it('should decrement activeTaskCount after normal sync success', () => {
    scheduler = new Scheduler();
    scheduler.schedule({ category: 'query-execution', fn: () => {} });
    scheduler.flush();
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('should decrement activeTaskCount after normal sync failure', () => {
    scheduler = new Scheduler();
    scheduler.schedule({
      category: 'query-execution',
      fn: () => {
        throw new Error('fail');
      },
    });
    scheduler.flush();
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('should decrement activeTaskCount after async success then destroy', async () => {
    scheduler = new Scheduler();
    let resolve!: () => void;
    scheduler.schedule({
      category: 'query-execution',
      fn: () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    });
    scheduler.flush();
    expect(scheduler.activeTaskCount).toBe(1);
    scheduler.destroy();
    resolve();
    await new Promise((r) => setTimeout(r, 10));
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('should decrement activeTaskCount after async failure then destroy', async () => {
    scheduler = new Scheduler();
    let reject!: (err: Error) => void;
    scheduler.schedule({
      category: 'query-execution',
      fn: () =>
        new Promise<void>((_r, rej) => {
          reject = rej;
        }),
    });
    scheduler.flush();
    expect(scheduler.activeTaskCount).toBe(1);
    scheduler.destroy();
    reject(new Error('async fail'));
    await new Promise((r) => setTimeout(r, 10));
    expect(scheduler.activeTaskCount).toBe(0);
  });

  it('activeTaskCount should never become negative', () => {
    scheduler = new Scheduler();
    scheduler.schedule({ category: 'query-execution', fn: () => {} });
    scheduler.schedule({ category: 'query-execution', fn: () => {} });
    scheduler.flush();
    expect(scheduler.activeTaskCount).toBe(0);
    expect(scheduler.activeTaskCount).not.toBeLessThan(0);
  });

  it('should decrement correctly with multiple in-flight tasks destroyed simultaneously', async () => {
    scheduler = new Scheduler();
    let resolve1!: () => void;
    let resolve2!: () => void;
    let resolve3!: () => void;
    scheduler.schedule({
      category: 'query-execution',
      fn: () =>
        new Promise<void>((r) => {
          resolve1 = r;
        }),
    });
    scheduler.schedule({
      category: 'query-execution',
      fn: () =>
        new Promise<void>((r) => {
          resolve2 = r;
        }),
    });
    scheduler.schedule({
      category: 'query-execution',
      fn: () =>
        new Promise<void>((r) => {
          resolve3 = r;
        }),
    });
    scheduler.flush();
    expect(scheduler.activeTaskCount).toBe(3);
    scheduler.destroy();
    resolve1();
    resolve2();
    resolve3();
    await new Promise((r) => setTimeout(r, 10));
    expect(scheduler.activeTaskCount).toBe(0);
  });
});
