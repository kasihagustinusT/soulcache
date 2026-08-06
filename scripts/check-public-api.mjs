#!/usr/bin/env node

/**
 * SoulCache Public API Compatibility Checker (CA-7)
 *
 * Verifies that the current public export surface of each published package is
 * a SUPERSET of the committed v1.0.0 baseline. Any removed export is a breaking
 * change and fails the check, keeping 1.1.0 a legal MINOR (add-only) release.
 *
 * Baseline files: scripts/api-baselines/<pkg>.json (generated from the
 * v1.0.0 tree). Regenerate with: node scripts/check-public-api.mjs --update
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASELINE_DIR = join(__dirname, 'api-baselines');

const PACKAGES = ['core', 'react', 'devtools', 'devtools-core'];

function listExports(pkgDir) {
  const entry = join(pkgDir, 'src', 'index.ts');
  const options = {
    allowJs: false,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    target: ts.ScriptTarget.ES2022,
    strict: true,
    skipLibCheck: true,
    esModuleInterop: true,
    resolveJsonModule: true,
    jsx: ts.JsxEmit.ReactJSX,
    allowImportingTsExtensions: false,
    noEmit: true,
  };
  const program = ts.createProgram([entry], options);
  const checker = program.getTypeChecker();
  const sourceFile = program.getSourceFile(entry);
  if (!sourceFile) throw new Error(`Cannot resolve entry: ${entry}`);

  const exports = {};
  const symbol = checker.getSymbolAtLocation(sourceFile);
  if (!symbol || !symbol.exports) return exports;

  for (const [name, exp] of symbol.exports) {
    const flags = exp.flags;
    const isType = (flags & ts.SymbolFlags.Type) !== 0 || (flags & ts.SymbolFlags.Interface) !== 0;
    const isValue = (flags & ts.SymbolFlags.Value) !== 0;
    exports[name] = isType && !isValue ? 'type' : 'value';
  }
  return exports;
}

function loadBaseline(pkgName) {
  const file = join(BASELINE_DIR, `${pkgName}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf-8'));
}

const update = process.argv.includes('--update');
let errors = 0;

for (const pkg of PACKAGES) {
  const pkgDir = join(ROOT, 'packages', pkg);
  const current = listExports(pkgDir);
  const currentNames = Object.keys(current).sort();

  if (update) {
    mkdirSync(BASELINE_DIR, { recursive: true });
    writeFileSync(
      join(BASELINE_DIR, `${pkg}.json`),
      JSON.stringify({ package: pkg, exports: current }, null, 2) + '\n',
    );
    console.log(`✓ @soulcache/${pkg}: baseline updated (${currentNames.length} exports)`);
    continue;
  }

  const baseline = loadBaseline(pkg);
  if (!baseline) {
    console.error(`✗ @soulcache/${pkg}: no baseline at scripts/api-baselines/${pkg}.json`);
    errors++;
    continue;
  }

  const baselineNames = Object.keys(baseline.exports).sort();
  const removed = baselineNames.filter((n) => !currentNames.includes(n));
  const added = currentNames.filter((n) => !baselineNames.includes(n));

  if (removed.length > 0) {
    errors++;
    console.error(`✗ @soulcache/${pkg}: REMOVED exports (breaking): ${removed.join(', ')}`);
  }
  if (added.length > 0) {
    console.log(`  @soulcache/${pkg}: added exports (additive, allowed): ${added.join(', ')}`);
  }
  if (removed.length === 0) {
    console.log(
      `✓ @soulcache/${pkg}: ${currentNames.length} exports, API-compatible with v1.0.0 baseline`,
    );
  }
}

console.log('');
if (errors > 0) {
  console.error(`✖ ${errors} package(s) have API-compat violations`);
  process.exit(1);
}
console.log(
  update ? 'Baselines regenerated.' : '✓ All packages are API-compatible with the v1.0.0 baseline',
);
