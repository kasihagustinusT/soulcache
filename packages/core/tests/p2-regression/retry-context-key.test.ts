import { describe, it, expect } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryEvent } from '../../src/retry/types';

describe('buildContext must include actual query key', () => {
  it('1. retry:attempt event includes the real key', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:attempt', (event) => events.push(event));

    const queryKey = ['users', 42, 'posts'];

    await engine.execute(
      async () => {
        throw new Error('network error');
      },
      { maxRetries: 1, baseDelay: 0, maxDelay: 0, backoff: 'constant', jitter: false },
      queryKey,
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
    // All events should have the correct key (one per attempt)
    for (const event of events) {
      expect(event.context.key).toEqual(queryKey);
    }
  });

  it('2. retry:success event includes the real key', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:success', (event) => events.push(event));

    const queryKey = ['products', 'abc'];

    await engine.execute(
      async () => 'ok',
      { maxRetries: 3, baseDelay: 0, maxDelay: 0, backoff: 'constant', jitter: false },
      queryKey,
    );

    expect(events).toHaveLength(1);
    expect(events[0].context.key).toEqual(queryKey);
  });

  it('3. retry:delay event includes the real key', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:delay', (event) => events.push(event));

    const queryKey = ['items', 99];

    await engine.execute(
      async () => {
        throw new Error('timeout');
      },
      { maxRetries: 2, baseDelay: 100, maxDelay: 1000, backoff: 'constant', jitter: false },
      queryKey,
    );

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].context.key).toEqual(queryKey);
  });

  it('4. retry:exhausted event includes the real key', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:exhausted', (event) => events.push(event));

    const queryKey = ['orders', 'xyz'];

    await engine.execute(
      async () => {
        throw new Error('server error');
      },
      { maxRetries: 1, baseDelay: 0, maxDelay: 0, backoff: 'constant', jitter: false },
      queryKey,
    );

    expect(events).toHaveLength(1);
    expect(events[0].context.key).toEqual(queryKey);
  });

  it('5. retry:cancelled event includes the real key', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:cancelled', (event) => events.push(event));

    const queryKey = ['cancelled', 'query'];
    const controller = new AbortController();

    // Abort immediately
    controller.abort();

    await engine.execute(
      async () => 'ok',
      { maxRetries: 3, baseDelay: 100, maxDelay: 1000, backoff: 'constant', jitter: false },
      queryKey,
      controller.signal,
    );

    expect(events).toHaveLength(1);
    expect(events[0].context.key).toEqual(queryKey);
  });

  it('6. retry:cancelled during sleep includes the real key', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:cancelled', (event) => events.push(event));

    const queryKey = ['sleep', 'cancel'];
    const controller = new AbortController();

    const promise = engine.execute(
      async () => {
        throw new Error('fail');
      },
      { maxRetries: 2, baseDelay: 50000, maxDelay: 50000, backoff: 'constant', jitter: false },
      queryKey,
      controller.signal,
    );

    // Abort during sleep
    await new Promise((r) => setTimeout(r, 10));
    controller.abort();

    await promise;

    expect(events).toHaveLength(1);
    expect(events[0].context.key).toEqual(queryKey);
  });

  it('7. key is not mutated after passing to buildContext', async () => {
    const engine = new RetryEngine();
    const events: RetryEvent[] = [];

    engine.on('retry:attempt', (event) => events.push(event));

    const queryKey = ['immutable', 'key'] as const;

    await engine.execute(
      async () => {
        throw new Error('err');
      },
      { maxRetries: 0, baseDelay: 0, maxDelay: 0, backoff: 'constant', jitter: false },
      queryKey as unknown as string[],
    );

    // Original key should be unchanged
    expect(queryKey).toEqual(['immutable', 'key']);
  });
});
