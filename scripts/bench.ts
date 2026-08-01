/**
 * SoulCache Benchmark CLI
 *
 * Runs all core benchmark suites and records results under
 * benchmarks/results/. Results are fingerprinted by machine so baselines are
 * comparable across environments.
 *
 * Usage:
 *   pnpm bench               # run + record run-*.json (gitignored)
 *   pnpm bench --baseline    # also update benchmarks/results/baselines.json
 *   BENCH_TOLERANCE=loose    # widen regression band for noisy local runners
 *
 * Exit codes:
 *   0 - benchmarks ran cleanly, no regression vs baseline
 *   1 - benchmark failure or regression vs baseline (strict: >10% p95 / <90% ops)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, arch } from 'node:os';
import { gzipSync } from 'node:zlib';
import { runAllBenchmarks, BenchmarkRunner } from '../packages/core/src/benchmark/index.ts';
import type { BenchmarkReport, BenchmarkResult } from '../packages/core/src/benchmark/types.ts';
import { CacheEngine } from '../packages/core/src/cache/cache-engine.ts';
import { dehydrate, hydrate } from '../packages/core/src/hydration/hydration.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RESULTS_DIR = join(ROOT, 'benchmarks', 'results');
const BASELINES_FILE = join(RESULTS_DIR, 'baselines.json');

interface BaselineEntry {
  opsPerSecond: number;
  p95Ms: number;
  recordedAt: number;
}

type Baselines = Record<string, BaselineEntry>;

interface BaselineFile {
  fingerprint: string;
  recordedAt: number;
  benchmarks: Baselines;
}

// Strict thresholds mirror the EVT-1b contract (<= +10% p95). On noisy
// hardware (e.g. thermally throttled mobile/ARM CI-less runners) a single-run
// re-baseline can flake; set BENCH_TOLERANCE=loose for a 1.5x p95 / 0.7x ops
// band. CI keeps the strict default.
const LOOSE = process.env.BENCH_TOLERANCE === 'loose';
const REGRESSION_P95_MULTIPLIER = LOOSE ? 1.5 : 1.1;
const REGRESSION_OPS_MULTIPLIER = LOOSE ? 0.7 : 0.9;
const BEST_OF_RUNS = 3;
const BUNDLE_GZIP_MAX_GROWTH_BYTES = 2048;

function machineFingerprint(): string {
  const model = cpus()[0]?.model ?? 'unknown';
  return [
    platform(),
    arch(),
    model.replace(/\s+/g, '_').slice(0, 40),
    `node${process.versions.node}`,
  ].join('-');
}

function fmt(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (n >= 10) return n.toFixed(1);
  return n.toFixed(3);
}

function printReport(report: BenchmarkReport): void {
  console.log(`\n[${report.suiteName}] (${report.durationMs.toFixed(0)}ms)`);
  console.log('  ' + '─'.repeat(92));
  console.log(
    '  name'.padEnd(44) +
      'ops/s'.padStart(12) +
      'mean ms'.padStart(10) +
      'p95 ms'.padStart(10) +
      'p99 ms'.padStart(10) +
      'Δmem B'.padStart(10),
  );
  console.log('  ' + '─'.repeat(92));
  for (const r of report.results) {
    console.log(
      '  ' +
        r.name.padEnd(42) +
        fmt(r.opsPerSecond).padStart(12) +
        fmt(r.meanMs).padStart(10) +
        fmt(r.p95Ms).padStart(10) +
        fmt(r.p99Ms).padStart(10) +
        String(r.memoryDeltaBytes).padStart(10),
    );
  }
}

function loadBaselines(): BaselineFile | null {
  if (!existsSync(BASELINES_FILE)) return null;
  try {
    return JSON.parse(readFileSync(BASELINES_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const updateBaseline = process.argv.includes('--baseline');
  const fingerprint = machineFingerprint();

  console.log('SoulCache Benchmark Runner');
  console.log(`Machine: ${fingerprint}`);
  console.log(`Best-of-${BEST_OF_RUNS} (min p95 per benchmark)`);

  const bestBySuite = new Map<string, Map<string, BenchmarkResult>>();
  const suiteOrder: string[] = [];
  let started = performance.now();

  const hydrationRunner = new BenchmarkRunner();
  const hydrationSuite = {
    name: 'Hydration',
    benchmarks: [
      {
        name: 'dehydrate+hydrate (1000 entries)',
        fn: () => {
          const source = new CacheEngine();
          for (let i = 0; i < 1000; i++) {
            source.set({ queryKey: ['h', i], data: { i }, state: 'success' });
          }
          const state = dehydrate(source);
          const target = new CacheEngine();
          hydrate(target, state);
        },
        iterations: 50,
      },
    ],
  };

  for (let run = 0; run < BEST_OF_RUNS; run++) {
    const reports = [...(await runAllBenchmarks()), await hydrationRunner.run(hydrationSuite)];
    for (const report of reports) {
      if (!suiteOrder.includes(report.suiteName)) suiteOrder.push(report.suiteName);
      let suiteBest = bestBySuite.get(report.suiteName);
      if (!suiteBest) {
        suiteBest = new Map();
        bestBySuite.set(report.suiteName, suiteBest);
      }
      for (const r of report.results) {
        const cur = suiteBest.get(r.name);
        if (!cur || r.p95Ms < cur.p95Ms) suiteBest.set(r.name, r);
      }
    }
    console.log(
      `  run ${run + 1}/${BEST_OF_RUNS} complete (${((performance.now() - started) / 1000).toFixed(1)}s)`,
    );
  }

  // Bundle size baseline (F6): gzip bytes of the built core entry.
  const coreDist = join(ROOT, 'packages', 'core', 'dist', 'index.js');
  let bundleReport: BenchmarkReport | null = null;
  if (existsSync(coreDist)) {
    const gzipBytes = gzipSync(readFileSync(coreDist)).length;
    const rawBytes = statSync(coreDist).size;
    bundleReport = {
      suiteName: 'Bundle',
      results: [
        {
          name: 'core.dist.bundle.gzipBytes',
          opsPerSecond: 0,
          meanMs: gzipBytes,
          medianMs: gzipBytes,
          p95Ms: gzipBytes,
          p99Ms: gzipBytes,
          standardDeviation: 0,
          iterations: 1,
          memoryDeltaBytes: rawBytes,
        },
      ],
      timestamp: Date.now(),
      durationMs: 0,
    };
    bestBySuite.set('Bundle', new Map([['core.dist.bundle.gzipBytes', bundleReport.results[0]]]));
    suiteOrder.push('Bundle');
  }

  const reports: BenchmarkReport[] = suiteOrder.map((suiteName) => ({
    suiteName,
    results: [...(bestBySuite.get(suiteName)?.values() ?? [])],
    timestamp: Date.now(),
    durationMs: performance.now() - started,
  }));

  let errors = 0;
  const baselineFile = loadBaselines();
  const baselines = baselineFile?.benchmarks ?? null;
  const baselineMatchesMachine = baselineFile?.fingerprint === fingerprint;

  if (baselineFile && !baselineMatchesMachine) {
    console.log(
      `Note: committed baseline is for "${baselineFile.fingerprint}"; ` +
        'comparison is skipped for this machine (recording only). ' +
        'Run "pnpm bench:baseline" to record this machine\'s baseline.',
    );
  }

  const nextBaselines: Baselines = baselines ?? {};

  const run = {
    schema: 1,
    fingerprint,
    timestamp: Date.now(),
    reports,
  };

  mkdirSync(RESULTS_DIR, { recursive: true });
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const runFile = join(RESULTS_DIR, `run-${fingerprint}-${iso}.json`);
  writeFileSync(runFile, JSON.stringify(run, null, 2));

  for (const report of reports) {
    printReport(report);
    for (const r of report.results) {
      const previous = nextBaselines[r.name];
      if (previous && baselineMatchesMachine && !updateBaseline) {
        if (r.name === 'core.dist.bundle.gzipBytes') {
          const delta = r.meanMs - previous.meanMs;
          if (delta > BUNDLE_GZIP_MAX_GROWTH_BYTES) {
            errors++;
            console.error(
              `\n  REGRESSION: ${r.name} grew by ${delta} bytes gzip ` +
                `(${previous.meanMs} -> ${r.meanMs}; limit +${BUNDLE_GZIP_MAX_GROWTH_BYTES})`,
            );
          }
        } else {
          const p95Ratio = r.p95Ms / previous.p95Ms;
          const opsRatio = r.opsPerSecond / previous.opsPerSecond;
          if (p95Ratio > REGRESSION_P95_MULTIPLIER || opsRatio < REGRESSION_OPS_MULTIPLIER) {
            errors++;
            console.error(
              `\n  REGRESSION: ${r.name} p95 ${r.p95Ms.toFixed(3)}ms (baseline ${previous.p95Ms.toFixed(3)}ms, ×${p95Ratio.toFixed(2)}), ` +
                `ops/s ${fmt(r.opsPerSecond)} (baseline ${fmt(previous.opsPerSecond)}, ×${opsRatio.toFixed(2)})`,
            );
          }
        }
      }
      nextBaselines[r.name] = {
        opsPerSecond: r.opsPerSecond,
        p95Ms: r.p95Ms,
        recordedAt: Date.now(),
      };
    }
  }

  if (!baselines || updateBaseline) {
    writeFileSync(
      BASELINES_FILE,
      JSON.stringify({ fingerprint, recordedAt: Date.now(), benchmarks: nextBaselines }, null, 2),
    );
    console.log(
      `\nBaseline ${baselines ? 'updated' : 'created'}: benchmarks/results/baselines.json`,
    );
  }

  console.log(`\nRun recorded: benchmarks/results/${runFile.split('/').pop()}`);

  if (errors > 0) {
    console.error(`\n✖ ${errors} benchmark(s) exceeded the regression threshold.`);
    process.exit(1);
  }
  console.log('\n✓ No regressions vs baseline.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
