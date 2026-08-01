import { describe, it, expect } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';

describe('RetryEngine external signal listener leak', () => {
  it('does not accumulate abort listeners across retry iterations', async () => {
    const engine = new RetryEngine();
    const controller = new AbortController();
    const signal = controller.signal;

    let addCount = 0;
    let removeCount = 0;
    const origAdd = signal.addEventListener.bind(signal);
    const origRemove = signal.removeEventListener.bind(signal);

    signal.addEventListener = (type: string, listener: any, options?: any) => {
      if (type === 'abort') addCount++;
      return origAdd(type, listener, options);
    };
    signal.removeEventListener = (type: string, listener: any) => {
      if (type === 'abort') removeCount++;
      return origRemove(type, listener);
    };

    let attemptCount = 0;

    await engine.execute(
      async (_attempt, _signal) => {
        attemptCount++;
        throw new Error(`fail-${attemptCount}`);
      },
      { maxRetries: 5, baseDelay: 1, maxDelay: 5 },
      ['h2', 'listener-leak'],
      signal,
    );

    // 6 attempts × 2 listeners each (one from execute loop, one from sleep) = ~12 adds
    // All listeners should be cleaned up
    expect(addCount).toBeGreaterThanOrEqual(6);
    expect(removeCount).toBeGreaterThanOrEqual(addCount);
  });

  it('cleans up listener on early success', async () => {
    const engine = new RetryEngine();
    const controller = new AbortController();
    const signal = controller.signal;

    let addCount = 0;
    let removeCount = 0;
    const origAdd = signal.addEventListener.bind(signal);
    const origRemove = signal.removeEventListener.bind(signal);

    signal.addEventListener = (type: string, listener: any, options?: any) => {
      if (type === 'abort') addCount++;
      return origAdd(type, listener, options);
    };
    signal.removeEventListener = (type: string, listener: any) => {
      if (type === 'abort') removeCount++;
      return origRemove(type, listener);
    };

    await engine.execute(
      async () => 'ok',
      { maxRetries: 5, baseDelay: 1, maxDelay: 5 },
      ['h2', 'early-success'],
      signal,
    );

    expect(addCount).toBeGreaterThanOrEqual(1);
    expect(removeCount).toBeGreaterThanOrEqual(addCount);
  });

  it('cleans up listener on abort during retry', async () => {
    const engine = new RetryEngine();
    const controller = new AbortController();
    const signal = controller.signal;

    let addCount = 0;
    let removeCount = 0;
    const origAdd = signal.addEventListener.bind(signal);
    const origRemove = signal.removeEventListener.bind(signal);

    signal.addEventListener = (type: string, listener: any, options?: any) => {
      if (type === 'abort') addCount++;
      return origAdd(type, listener, options);
    };
    signal.removeEventListener = (type: string, listener: any) => {
      if (type === 'abort') removeCount++;
      return origRemove(type, listener);
    };

    let attempt = 0;
    const result = await engine.execute(
      async () => {
        attempt++;
        if (attempt === 2) {
          controller.abort();
        }
        throw new Error('fail');
      },
      { maxRetries: 5, baseDelay: 1, maxDelay: 5 },
      ['h2', 'abort-cleanup'],
      signal,
    );

    expect(result.success).toBe(false);
    expect(addCount).toBeGreaterThanOrEqual(1);
    expect(removeCount).toBeGreaterThanOrEqual(addCount);
  });
});
