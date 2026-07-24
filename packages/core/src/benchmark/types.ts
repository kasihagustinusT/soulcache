/**
 * Benchmark Result
 */
export interface BenchmarkResult {
  readonly name: string;
  readonly opsPerSecond: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly standardDeviation: number;
  readonly iterations: number;
  readonly memoryDeltaBytes: number;
}

/**
 * Benchmark Run Options
 */
export interface BenchmarkRunOptions {
  readonly iterations?: number;
  readonly warmup?: number;
  readonly timeout?: number;
}

/**
 * Benchmark Report
 */
export interface BenchmarkReport {
  readonly suiteName: string;
  readonly results: readonly BenchmarkResult[];
  readonly timestamp: number;
  readonly durationMs: number;
}

/**
 * Benchmark Definition
 */
export interface Benchmark {
  readonly name: string;
  readonly fn: () => void | Promise<void>;
  readonly iterations?: number;
  readonly warmupIterations?: number;
}

/**
 * Benchmark Suite
 */
export interface BenchmarkSuite {
  readonly name: string;
  readonly benchmarks: readonly Benchmark[];
}
