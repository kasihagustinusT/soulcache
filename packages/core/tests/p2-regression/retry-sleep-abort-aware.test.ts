import { describe, it, expect } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';

describe('RetryEngine sleep is abort-aware', () => {
  it('abort during retry delay resolves immediately', async () => {
    const engine = new RetryEngine();
    const controller = new AbortController();

    const start = Date.now();

    // Abort after 10ms
    setTimeout(() => controller.abort(), 10);

    const result = await engine.execute(
      async () => {
        throw new Error('always-fail');
      },
      { maxRetries: 3, retryDelay: 5000 },
      ['h6', 'abort-sleep'],
      controller.signal,
    );

    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    // Should complete well before the 5000ms delay thanks to abort
    expect(elapsed).toBeLessThan(1000);
  });

  it('non-aborted sleep still waits the full delay', async () => {
    const engine = new RetryEngine();

    const start = Date.now();

    const result = await engine.execute(
      async (_attempt) => {
        throw new Error('always-fail');
      },
      { maxRetries: 1, retryDelay: 100 },
      ['h6', 'full-sleep'],
    );

    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    // Should have waited at least the delay
    expect(elapsed).toBeGreaterThanOrEqual(80);
  });

  it('abort before sleep resolves immediately with no delay', async () => {
    const engine = new RetryEngine();
    const controller = new AbortController();
    controller.abort(); // Pre-abort

    const start = Date.now();

    const result = await engine.execute(
      async () => {
        throw new Error('fail');
      },
      { maxRetries: 3, retryDelay: 5000 },
      ['h6', 'pre-abort'],
      controller.signal,
    );

    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });
});
