#!/usr/bin/env node

/**
 * SoulCache Package Export Validator
 * Validates that all published packages have correct exports, types, and structure.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '..');
const ERRORS = [];
const WARNINGS = [];

function error(msg) { ERRORS.push(msg); console.error(`  ✗ ${msg}`); }
function warn(msg) { WARNINGS.push(msg); console.log(`  ⚠ ${msg}`); }
function info(msg) { console.log(`  ✓ ${msg}`); }

const PACKAGES = ['packages/core', 'packages/react'];

for (const pkg of PACKAGES) {
  const pkgDir = join(ROOT, pkg);
  const pkgJson = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf-8'));
  const name = pkgJson.name;

  console.log(`\n📦 Validating ${name}...`);

  // 1. Required fields
  const requiredFields = ['name', 'version', 'description', 'license', 'type', 'main', 'types', 'exports'];
  for (const field of requiredFields) {
    if (!pkgJson[field]) {
      error(`Missing required field: ${field}`);
    }
  }

  // 2. NPM metadata
  if (!pkgJson.repository) warn(`Missing repository field`);
  if (!pkgJson.homepage) warn(`Missing homepage field`);
  if (!pkgJson.bugs) warn(`Missing bugs field`);
  if (!pkgJson.keywords) warn(`Missing keywords field`);
  if (!pkgJson.engines) warn(`Missing engines field`);
  if (!pkgJson.files) warn(`Missing files field`);

  // 3. Exports validation
  if (pkgJson.exports) {
    const mainExport = pkgJson.exports['.'];
    if (mainExport) {
      if (mainExport.import) {
        const typesPath = join(pkgDir, mainExport.import.types);
        const defaultPath = join(pkgDir, mainExport.import.default);
        if (!existsSync(typesPath)) {
          error(`Types file not found: ${mainExport.import.types}`);
        } else {
          info(`Types: ${mainExport.import.types}`);
        }
        if (!existsSync(defaultPath)) {
          error(`Main file not found: ${mainExport.import.default}`);
        } else {
          info(`Main: ${mainExport.import.default}`);
        }
      } else {
        error('Missing import condition in exports["."]');
      }
    } else {
      error('Missing exports["."] entry');
    }
  }

  // 4. sideEffects declaration
  if (pkgJson.sideEffects === undefined) {
    warn('Missing sideEffects field (recommended: false for tree shaking)');
  }

  // 5. License file
  if (!existsSync(join(pkgDir, 'LICENSE')) && !existsSync(join(pkgDir, 'license'))) {
    warn('Missing LICENSE file in package directory');
  }

  // 6. README
  if (!existsSync(join(pkgDir, 'README.md'))) {
    warn('Missing README.md in package directory');
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
  console.log(`\n✓ All packages valid\n`);
}
