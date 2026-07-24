import { describe, it, expect } from 'vitest';
import { BenchmarkRunner } from '../runner';
import type { BenchmarkSuite } from '../types';

describe('BenchmarkRunner', () => {
  it('should run a benchmark suite', async () => {
    const runner = new BenchmarkRunner();

    const suite: BenchmarkSuite = {
      name: 'Test Suite',
      benchmarks: [
        {
          name: 'test benchmark',
          fn: () => {
            // noop
          },
          iterations: 10,
          warmupIterations: 2,
        },
      ],
    };

    const report = await runner.run(suite);

    expect(report.suiteName).toBe('Test Suite');
    expect(report.results).toHaveLength(1);
    expect(report.results[0].name).toBe('test benchmark');
    expect(report.results[0].iterations).toBe(10);
    expect(report.results[0].opsPerSecond).toBeGreaterThan(0);
    expect(report.results[0].meanMs).toBeGreaterThanOrEqual(0);
    expect(report.timestamp).toBeGreaterThan(0);
  });

  it('should run async benchmarks', async () => {
    const runner = new BenchmarkRunner();

    const suite: BenchmarkSuite = {
      name: 'Async Suite',
      benchmarks: [
        {
          name: 'async benchmark',
          fn: async () => {
            await new Promise((r) => setTimeout(r, 1));
          },
          iterations: 5,
          warmupIterations: 1,
        },
      ],
    };

    const report = await runner.run(suite);

    expect(report.results[0].iterations).toBe(5);
    expect(report.results[0].meanMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle multiple benchmarks', async () => {
    const runner = new BenchmarkRunner();

    const suite: BenchmarkSuite = {
      name: 'Multi Suite',
      benchmarks: [
        {
          name: 'bench 1',
          fn: () => {},
          iterations: 5,
          warmupIterations: 1,
        },
        {
          name: 'bench 2',
          fn: () => {},
          iterations: 5,
          warmupIterations: 1,
        },
      ],
    };

    const report = await runner.run(suite);

    expect(report.results).toHaveLength(2);
    expect(report.results[0].name).toBe('bench 1');
    expect(report.results[1].name).toBe('bench 2');
  });
});
