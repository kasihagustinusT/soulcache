import type {
  Benchmark,
  BenchmarkSuite,
  BenchmarkRunOptions,
  BenchmarkReport,
  BenchmarkResult,
} from './types';

/**
 * Benchmark Runner
 *
 * Executes benchmark suites and produces performance reports.
 */
export class BenchmarkRunner {
  /**
   * Run a benchmark suite
   */
  async run(
    suite: BenchmarkSuite,
    options?: BenchmarkRunOptions,
  ): Promise<BenchmarkReport> {
    const globalIterations = options?.iterations ?? 100;
    const globalWarmup = options?.warmup ?? 10;

    const results: BenchmarkResult[] = [];
    const startTime = performance.now();

    for (const benchmark of suite.benchmarks) {
      const iterations = benchmark.iterations ?? globalIterations;
      const warmup = benchmark.warmupIterations ?? globalWarmup;

      const result = await this.runBenchmark(benchmark, iterations, warmup);
      results.push(result);
    }

    return {
      suiteName: suite.name,
      results,
      timestamp: Date.now(),
      durationMs: performance.now() - startTime,
    };
  }

  /**
   * Run a single benchmark
   */
  private async runBenchmark(
    benchmark: Benchmark,
    iterations: number,
    warmup: number,
  ): Promise<BenchmarkResult> {
    // Warmup
    for (let i = 0; i < warmup; i++) {
      await benchmark.fn();
    }

    // Force GC if available (Node.js with --expose-gc)
    if (typeof globalThis !== 'undefined' && typeof (globalThis as Record<string, unknown>).gc === 'function') {
      ((globalThis as Record<string, unknown>).gc as () => void)();
    }

    const memBefore = typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage().heapUsed
      : 0;

    // Measure
    const times: number[] = [];
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await benchmark.fn();
      times.push(performance.now() - start);
    }

    const memAfter = typeof process !== 'undefined' && typeof process.memoryUsage === 'function'
      ? process.memoryUsage().heapUsed
      : 0;

    times.sort((a, b) => a - b);

    const totalTime = times.reduce((a, b) => a + b, 0);
    const mean = totalTime / iterations;
    const median = times[Math.floor(iterations / 2)] ?? 0;
    const p95 = times[Math.floor(iterations * 0.95)] ?? 0;
    const p99 = times[Math.floor(iterations * 0.99)] ?? 0;
    const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / iterations;
    const stdDev = Math.sqrt(variance);

    return {
      name: benchmark.name,
      opsPerSecond: (iterations / totalTime) * 1000,
      meanMs: mean,
      medianMs: median,
      p95Ms: p95,
      p99Ms: p99,
      standardDeviation: stdDev,
      iterations,
      memoryDeltaBytes: memAfter - memBefore,
    };
  }
}
