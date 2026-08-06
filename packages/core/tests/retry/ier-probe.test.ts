import { describe, it, expect, vi } from 'vitest';
import { RetryEngine } from '../../src/retry/retry-engine';
import type { RetryConfig } from '../../src/retry/types';

/**
 * IER probe (Stage 04) — independent reproduction of BUG-2.
 * Written fresh, distinct from the Stage 03 regression suite.
 */
const cfg: RetryConfig = {
  maxRetries: 3,
  baseDelay: 10,
  maxDelay: 100,
  backoff: 'constant',
  jitter: false,
};

describe('IER probe: BUG-2 listener dispatch', () => {
  it('P1: retry:success listener throw must not corrupt a successful execute', async () => {
    const engine = new RetryEngine();
    engine.on('retry:success', () => {
      throw new Error('p1-boom');
    });
    const result = await engine.execute(vi.fn().mockResolvedValue(42), cfg, ['p1']);
    expect(result.success).toBe(true);
    expect(result.data).toBe(42);
  });

  it('P2: retry:attempt listener throw must not reject execute()', async () => {
    const engine = new RetryEngine();
    engine.on('retry:attempt', () => {
      throw new Error('p2-boom');
    });
    const fn = vi.fn().mockRejectedValueOnce(new TypeError('net')).mockResolvedValue('ok');
    const result = await engine.execute(fn, cfg, ['p2']);
    expect(result.success).toBe(true);
  });

  it('P3: retry:exhausted listener throw must not reject execute()', async () => {
    const engine = new RetryEngine();
    engine.on('retry:exhausted', () => {
      throw new Error('p3-boom');
    });
    const result = await engine.execute(vi.fn().mockRejectedValue(new TypeError('net')), cfg, ['p3']);
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(TypeError);
  });

  it('P4: retry:cancelled listener throw (pre-start abort) must not reject execute()', async () => {
    const engine = new RetryEngine();
    engine.on('retry:cancelled', () => {
      throw new Error('p4-boom');
    });
    const ac = new AbortController();
    ac.abort();
    const result = await engine.execute(vi.fn().mockResolvedValue('x'), cfg, ['p4'], ac.signal);
    expect(result.success).toBe(false);
    expect(result.error?.name).toBe('AbortError');
  });

  it('P5: a throwing listener must not suppress subsequent listeners', async () => {
    const engine = new RetryEngine();
    const seen: string[] = [];
    engine.on('retry:success', () => {
      throw new Error('p5a-boom');
    });
    engine.on('retry:success', () => seen.push('second'));
    await engine.execute(vi.fn().mockResolvedValue('ok'), cfg, ['p5']);
    expect(seen).toEqual(['second']);
  });
});
