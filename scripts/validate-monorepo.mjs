#!/usr/bin/env node

/**
 * SoulCache Monorepo Validator
 * Validates workspace configuration, inter-package dependencies, and build order.
 */

import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const ERRORS = [];
const WARNINGS = [];

function error(msg) { ERRORS.push(msg); console.error(`  ✗ ${msg}`); }
function warn(msg) { WARNINGS.push(msg); console.log(`  ⚠ ${msg}`); }
function info(msg) { console.log(`  ✓ ${msg}`); }

// 1. Workspace config
console.log('🔍 SoulCache Monorepo Validator\n');

const workspacePath = join(ROOT, 'pnpm-workspace.yaml');
if (!existsSync(workspacePath)) {
  error('pnpm-workspace.yaml not found');
} else {
  info('pnpm-workspace.yaml exists');
}

const rootPkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8'));
info(`Root: ${rootPkg.name} v${rootPkg.version}`);

// 2. Check workspace packages
const workspaceDirs = ['packages/core', 'packages/react', 'docs'];
const workspaceMap = new Map();

for (const dir of workspaceDirs) {
  const pkgPath = join(ROOT, dir, 'package.json');
  if (!existsSync(pkgPath)) {
    error(`Package not found: ${dir}/package.json`);
    continue;
  }
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  workspaceMap.set(pkg.name, { dir, pkg });
  info(`${pkg.name} v${pkg.version} (${dir})`);
}

// 3. Validate inter-package dependencies
console.log('\nValidating dependencies...');
for (const [name, { dir, pkg }] of workspaceMap) {
  const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  for (const [dep, version] of Object.entries(allDeps || {})) {
    if (version === 'workspace:*' || version === 'workspace:^' || version === 'workspace:~') {
      if (!workspaceMap.has(dep)) {
        error(`${name} depends on workspace package ${dep} which is not in the workspace`);
      } else {
        info(`${name} → ${dep} (${version})`);
      }
    }
  }
}

// 4. Validate publish ordering (topological sort)
console.log('\nValidating publish order...');
const depGraph = new Map();
for (const [name, { pkg }] of workspaceMap) {
  const deps = [];
  const allDeps = { ...pkg.dependencies };
  for (const [dep, version] of Object.entries(allDeps || {})) {
    if (version?.startsWith('workspace:') && workspaceMap.has(dep)) {
      deps.push(dep);
    }
  }
  depGraph.set(name, deps);
}

// Simple topological sort
const visited = new Set();
const order = [];
function visit(name) {
  if (visited.has(name)) return;
  visited.add(name);
  for (const dep of (depGraph.get(name) || [])) {
    visit(dep);
  }
  order.push(name);
}
for (const name of depGraph.keys()) {
  visit(name);
}
info(`Publish order: ${order.join(' → ')}`);

// 5. Validate version consistency
console.log('\nChecking versions...');
for (const [name, { pkg }] of workspaceMap) {
  if (pkg.version !== '0.1.0') {
    warn(`${name} version is ${pkg.version} (expected 0.1.0 for pre-release)`);
  }
}

// 6. Validate build outputs
console.log('\nChecking build outputs...');
for (const [name, { dir, pkg }] of workspaceMap) {
  if (dir === 'docs') continue;
  const distDir = join(ROOT, dir, 'dist');
  if (!existsSync(distDir)) {
    warn(`${name}: dist/ directory not found (run pnpm build first)`);
  } else {
    const indexJs = join(distDir, 'index.js');
    const indexDts = join(distDir, 'index.d.ts');
    if (!existsSync(indexJs)) error(`${name}: dist/index.js not found`);
    else info(`${name}: dist/index.js exists`);
    if (!existsSync(indexDts)) error(`${name}: dist/index.d.ts not found`);
    else info(`${name}: dist/index.d.ts exists`);
  }
}

// Summary
console.log('\n' + '─'.repeat(50));
if (ERRORS.length > 0) {
  console.error(`\n✖ ${ERRORS.length} error(s), ${WARNINGS.length} warning(s)\n`);
  process.exit(1);
} else if (WARNINGS.length > 0) {
  console.log(`\n⚠ ${WARNINGS.length} warning(s), 0 errors\n`);
} else {
  console.log(`\n✓ All checks passed\n`);
}
