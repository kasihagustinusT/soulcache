#!/usr/bin/env node

/**
 * SoulCache Documentation Validator
 * Validates documentation quality, links, metadata, and structure.
 * Exit code 1 = validation failure (CI will fail).
 */

import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join, extname, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DOCS_DIR = join(__dirname, '..', 'content', 'docs');
const ERRORS = [];
const WARNINGS = [];

function error(msg) {
  ERRORS.push(msg);
  console.error(`  ✗ ${msg}`);
}

function warn(msg) {
  WARNINGS.push(msg);
  console.log(`  ⚠ ${msg}`);
}

function info(msg) {
  console.log(`  ✓ ${msg}`);
}

// ── Collect all MDX files ──────────────────────────────────────────
function collectMdxFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMdxFiles(fullPath));
    } else if (extname(entry.name) === '.mdx') {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Collect all meta.json ──────────────────────────────────────────
function collectMetaFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMetaFiles(fullPath));
    } else if (entry.name === 'meta.json') {
      results.push(fullPath);
    }
  }
  return results;
}

// ── Validate frontmatter ───────────────────────────────────────────
function validateFrontmatter(content, filePath) {
  const rel = relative(DOCS_DIR, filePath);
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    error(`Missing frontmatter in ${rel}`);
    return {};
  }

  const fm = {};
  for (const line of frontmatterMatch[1].split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length) {
      fm[key.trim()] = rest.join(':').trim();
    }
  }

  if (!fm.title) {
    error(`Missing 'title' in frontmatter: ${rel}`);
  }
  if (!fm.description) {
    error(`Missing 'description' in frontmatter: ${rel}`);
  }
  if (fm.title && fm.title.length > 70) {
    warn(`Title too long (${fm.title.length} chars, max 70): ${rel}`);
  }
  if (fm.description && fm.description.length > 160) {
    warn(`Description too long (${fm.description.length} chars, max 160): ${rel}`);
  }
  return fm;
}

// ── Validate heading structure ─────────────────────────────────────
function validateHeadings(content, filePath) {
  const rel = relative(DOCS_DIR, filePath);
  // Strip code blocks and MDX component content before checking headings
  const withoutCode = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/<[A-Z][a-zA-Z]*[^>]*>[\s\S]*?<\/[A-Z][a-zA-Z]*>/g, '');
  const headings = withoutCode.match(/^#{1,6}\s+.+$/gm) || [];
  if (headings.length === 0) {
    warn(`No headings found: ${rel}`);
  }
  const h1s = headings.filter((h) => h.startsWith('# ') && !h.startsWith('## '));
  if (h1s.length > 1) {
    warn(`Multiple h1 headings: ${rel}`);
  }
}

// ── Validate internal links ────────────────────────────────────────
function validateLinks(content, filePath, allSlugs) {
  const rel = relative(DOCS_DIR, filePath);
  const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const [, text, href] = match;
    if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
      continue;
    }
    // Internal link — strip leading /docs/ to get the slug
    const cleanHref = href.replace(/^\/docs\//, '').replace(/\.mdx?$/, '').replace(/\/$/, '');
    // Skip if it looks like a dynamic route
    if (cleanHref.includes('[')) continue;
    if (cleanHref === '') continue;
    if (!allSlugs.has(cleanHref)) {
      warn(`Broken internal link [${text}](${href}) in ${rel}`);
    }
  }
}

// ── Validate meta.json pages reference existing MDX files ──────────
function validateMeta(metaPath, mdxSlugs) {
  const rel = relative(DOCS_DIR, metaPath);
  const metaDir = dirname(metaPath);
  try {
    const content = JSON.parse(readFileSync(metaPath, 'utf-8'));
    if (content.pages) {
      for (const page of content.pages) {
        if (page.startsWith('---')) continue;
        // Check if it's an MDX file in the same directory
        const mdxPath = join(metaDir, page + '.mdx');
        // Check if it's a subdirectory with its own meta.json
        const subDir = join(metaDir, page);
        const subMeta = join(subDir, 'meta.json');
        const isDir = existsSync(subDir) && statSync(subDir).isDirectory();

        if (!existsSync(mdxPath) && !isDir && !existsSync(subMeta)) {
          error(`meta.json references non-existent page '${page}' in ${rel}`);
        }
      }
    }
  } catch (e) {
    error(`Invalid meta.json: ${rel} — ${e.message}`);
  }
}

// ── Main ───────────────────────────────────────────────────────────
console.log('\n🔍 SoulCache Documentation Validator\n');

// 1. Collect files
console.log('Collecting files...');
const mdxFiles = collectMdxFiles(DOCS_DIR);
const metaFiles = collectMetaFiles(DOCS_DIR);
info(`Found ${mdxFiles.length} MDX files`);
info(`Found ${metaFiles.length} meta.json files`);

// 2. Build slug set (relative to /docs, without .mdx extension)
const mdxSlugs = new Set();
for (const file of mdxFiles) {
  const rel = relative(DOCS_DIR, file);
  const slug = rel.replace(/\.mdx$/, '').replace(/\\/g, '/');
  mdxSlugs.add(slug);
}

// 3. Validate each MDX file
console.log('\nValidating MDX files...');
let totalPages = 0;
let pagesWithTitle = 0;
let pagesWithDescription = 0;
const titles = new Map();

for (const file of mdxFiles) {
  totalPages++;
  const content = readFileSync(file, 'utf-8');
  const fm = validateFrontmatter(content, file);
  validateHeadings(content, file);
  validateLinks(content, file, mdxSlugs);

  if (fm.title) pagesWithTitle++;
  if (fm.description) pagesWithDescription++;

  if (fm.title) {
    const normalized = fm.title.toLowerCase().trim();
    const rel = relative(DOCS_DIR, file);
    if (titles.has(normalized)) {
      warn(`Duplicate title '${fm.title}' in ${rel} and ${titles.get(normalized)}`);
    }
    titles.set(normalized, rel);
  }
}

info(`${pagesWithTitle}/${totalPages} pages have titles`);
info(`${pagesWithDescription}/${totalPages} pages have descriptions`);

// 4. Validate meta.json files
console.log('\nValidating meta.json files...');
for (const meta of metaFiles) {
  validateMeta(meta, mdxSlugs);
}

// 5. Check for orphan pages
console.log('\nChecking for orphan pages...');
// Build set of all pages referenced by meta.json
const rootMetaPages = new Set();
try {
  const rootMeta = JSON.parse(readFileSync(join(DOCS_DIR, 'meta.json'), 'utf-8'));
  if (rootMeta.pages) {
    for (const p of rootMeta.pages) {
      if (!p.startsWith('---')) rootMetaPages.add(p);
    }
  }
} catch {}

let orphanCount = 0;
for (const file of mdxFiles) {
  const rel = relative(DOCS_DIR, file).replace(/\\/g, '/');
  // Only check top-level MDX files (not in subdirectories)
  if (!rel.includes('/')) {
    const slug = rel.replace(/\.mdx$/, '');
    if (!rootMetaPages.has(slug)) {
      warn(`Orphan page (not in root meta.json): ${rel}`);
      orphanCount++;
    }
  }
}
if (orphanCount === 0) {
  info('No orphan pages found');
}

// 6. Summary
console.log('\n' + '─'.repeat(50));
if (ERRORS.length > 0) {
  console.error(`\n✖ ${ERRORS.length} error(s), ${WARNINGS.length} warning(s)\n`);
  process.exit(1);
} else if (WARNINGS.length > 0) {
  console.log(`\n⚠ ${WARNINGS.length} warning(s), 0 errors\n`);
  process.exit(0);
} else {
  console.log(`\n✓ All checks passed (${totalPages} pages, ${metaFiles.length} meta files)\n`);
  process.exit(0);
}
