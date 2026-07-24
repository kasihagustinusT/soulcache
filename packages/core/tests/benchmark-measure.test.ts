import { describe, it, expect } from 'vitest';
import { CacheEngine } from '../src/cache/cache-engine';

describe('Performance Benchmarks', () => {
  it('cache set/get throughput', () => {
    const engine = new CacheEngine();
    const iterations = 10000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      engine.set(['key', i], { data: i, timestamp: Date.now() });
    }
    for (let i = 0; i < iterations; i++) {
      engine.get(['key', i]);
    }
    const elapsed = performance.now() - start;
    const opsPerSec = (iterations * 2) / (elapsed / 1000);
    expect(opsPerSec).toBeGreaterThan(10000);
  });

  it('cache invalidation throughput', () => {
    const engine = new CacheEngine();
    const n = 1000;
    for (let i = 0; i < n; i++) {
      engine.set(['item', i], { data: i, timestamp: Date.now() });
    }
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      engine.invalidate(['item', i]);
    }
    const elapsed = performance.now() - start;
    const opsPerSec = n / (elapsed / 1000);
    expect(opsPerSec).toBeGreaterThan(500);
  });

  it('bulk set throughput', () => {
    const engine = new CacheEngine();
    const n = 5000;
    const start = performance.now();
    for (let i = 0; i < n; i++) {
      engine.set(['bulk', i], { data: i, timestamp: Date.now() });
    }
    const elapsed = performance.now() - start;
    const opsPerSec = n / (elapsed / 1000);
    expect(opsPerSec).toBeGreaterThan(5000);
  });
});
