/**
 * SoulCache Benchmark CLI
 *
 * Runs all core benchmark suites and records results under
 * benchmarks/results/. Results are fingerprinted by machine so baselines are
 * comparable across environments.
 *
 * Usage:
 *   pnpm bench              # run + record run-*.json (gitignored)
 *   pnpm bench --baseline   # also update benchmarks/results/baselines.json
 *
 * Exit codes:
 *   0 - benchmarks ran cleanly, no regression vs baseline
 *   1 - benchmark failure or regression vs baseline (>10% p95 / <90% ops)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, platform, arch } from 'node:os';
import { runAllBenchmarks } from '../packages/core/src/benchmark/index.ts';
import type { BenchmarkReport, BenchmarkResult } from '../packages/core/src/benchmark/types.ts';

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

const REGRESSION_P95_MULTIPLIER = 1.1;
const REGRESSION_OPS_MULTIPLIER = 0.9;
const BEST_OF_RUNS = 3;

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
  for (let run = 0; run < BEST_OF_RUNS; run++) {
    const reports = await runAllBenchmarks();
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
