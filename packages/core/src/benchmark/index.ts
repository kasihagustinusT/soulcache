/**
 * Benchmark Module
 *
 * @module benchmark
 */

export type {
  Benchmark,
  BenchmarkSuite,
  BenchmarkRunOptions,
  BenchmarkReport,
  BenchmarkResult,
} from './types';
export { BenchmarkRunner } from './runner';
export {
  createCacheSuite,
  createQuerySuite,
  createObserverSuite,
  createPluginSuite,
  createRetrySuite,
  runAllBenchmarks,
} from './benchmarks';
