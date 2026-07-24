import type { BenchmarkSuite, BenchmarkRunOptions, BenchmarkReport } from './types';
import { BenchmarkRunner } from './runner';
import { CacheEngine } from '../cache/cache-engine';
import { QueryEngine } from '../query/query-engine';
import { ObserverManager } from '../observer/observer-manager';
import { PluginManager } from '../plugin/plugin-manager';
import { RetryEngine } from '../retry/retry-engine';

/**
 * Create Cache Write/Read Benchmark Suite
 */
export function createCacheSuite(): BenchmarkSuite {
  return {
    name: 'Cache Engine',
    benchmarks: [
      {
        name: 'cache.set (1000 writes)',
        fn: () => {
          const engine = new CacheEngine();
          for (let i = 0; i < 1000; i++) {
            engine.set({ queryKey: [`key-${i}`], data: { value: i } });
          }
        },
        iterations: 50,
      },
      {
        name: 'cache.get (1000 reads)',
        fn: () => {
          const engine = new CacheEngine();
          for (let i = 0; i < 1000; i++) {
            engine.set({ queryKey: [`key-${i}`], data: { value: i } });
          }
          for (let i = 0; i < 1000; i++) {
            engine.get([`key-${i}`]);
          }
        },
        iterations: 50,
      },
    ],
  };
}

/**
 * Create Query Engine Benchmark Suite
 */
export function createQuerySuite(): BenchmarkSuite {
  return {
    name: 'Query Engine',
    benchmarks: [
      {
        name: 'queryEngine.executeQuery (cache hit)',
        fn: async () => {
          const engine = new QueryEngine();
          engine.setQueryData(['test'], { value: 1 });
          await engine.executeQuery({
            queryKey: ['test'],
            queryFn: async () => ({ value: 1 }),
            staleTime: 10_000,
          });
          engine.destroy();
        },
        iterations: 100,
      },
    ],
  };
}

/**
 * Create Observer Benchmark Suite
 */
export function createObserverSuite(): BenchmarkSuite {
  return {
    name: 'Observer Manager',
    benchmarks: [
      {
        name: 'observerManager.createObserver (100 observers)',
        fn: () => {
          const manager = new ObserverManager();
          for (let i = 0; i < 100; i++) {
            manager.createObserver({
              queryId: `q-${i}`,
              queryKey: ['users', i],
            });
          }
          manager.destroy();
        },
        iterations: 50,
      },
      {
        name: 'observerManager.notify (100 observers)',
        fn: () => {
          const manager = new ObserverManager();
          for (let i = 0; i < 100; i++) {
            const obs = manager.createObserver({
              queryId: `q-${i}`,
              queryKey: ['users'],
            });
            obs.subscribe(() => {});
          }
          manager.notify(manager.hashKey(['users']), { data: { updated: true } });
          manager.destroy();
        },
        iterations: 50,
      },
    ],
  };
}

/**
 * Create Plugin System Benchmark Suite
 */
export function createPluginSuite(): BenchmarkSuite {
  return {
    name: 'Plugin System',
    benchmarks: [
      {
        name: 'pluginManager.register (100 plugins)',
        fn: () => {
          const manager = new PluginManager();
          for (let i = 0; i < 100; i++) {
            manager.register({
              metadata: { id: `p-${i}`, name: `Plugin ${i}`, version: '1.0.0' },
            });
          }
          manager.destroy();
        },
        iterations: 50,
      },
    ],
  };
}

/**
 * Create Retry Engine Benchmark Suite
 */
export function createRetrySuite(): BenchmarkSuite {
  return {
    name: 'Retry Engine',
    benchmarks: [
      {
        name: 'retryEngine.classifyError (1000 classifications)',
        fn: () => {
          const engine = new RetryEngine();
          const errors: Error[] = [
            new Error('network'),
            new Error('timeout'),
            new DOMException('aborted', 'AbortError') as unknown as Error,
            new TypeError('fetch failed'),
          ];
          for (let i = 0; i < 1000; i++) {
            engine.classifyError(errors[i % errors.length]!);
          }
        },
        iterations: 100,
      },
    ],
  };
}

/**
 * Run all benchmark suites
 */
export async function runAllBenchmarks(
  options?: BenchmarkRunOptions,
): Promise<BenchmarkReport[]> {
  const runner = new BenchmarkRunner();
  const suites = [
    createCacheSuite(),
    createQuerySuite(),
    createObserverSuite(),
    createPluginSuite(),
    createRetrySuite(),
  ];

  const reports: BenchmarkReport[] = [];
  for (const suite of suites) {
    reports.push(await runner.run(suite, options));
  }
  return reports;
}
