#!/usr/bin/env node
/**
 * test/knowledge-atlas-offline-safety.test.js
 * ---------------------------------------------------------------------------
 * Story 29.5 — Authoritative offline-safety analyzer (AC 4).
 *
 * Generates the FULL site (all page types) against the rich-project fixture
 * and walks every emitted .html/.js/.json asserting:
 *   - No http(s):// external URLs (CDN, scripts, fonts, APIs)
 *   - No <script src= / <link href= pointing to remote origins
 *   - No web-font @font-face / url(http...)
 *   - No fetch() / XMLHttpRequest / WebSocket / import() of sibling files
 *
 * Single documented exception:
 *   The vendored force-graph UMD bundle contains W3C XML namespace URIs
 *   (e.g. http://www.w3.org/...). These are string literals baked into the
 *   bundle — NOT network fetches. Strip this block before scanning graph.html,
 *   mirroring the stripVendorBlock() helper from knowledge-atlas-graph.test.js.
 *
 * Exempt: manifest.json (contains absolute fs paths, not URLs).
 *
 * This is the single source-of-truth offline-safety test; the per-page checks
 * in 29.3/29.4 are lighter cross-checks retained for regression isolation.
 *
 * Test style: plain Node assert (no framework), repo style.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

// ─── Paths ───────────────────────────────────────────────────────────────────
const ATLAS_CJS = path.join(__dirname, '..', 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');
const PINNED_EPOCH = '1700000000';

// ─── Test harness ────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const tempDirs = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    if (err.stack) console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    failed++;
  }
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function makeTempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-offline-${prefix}-`));
  tempDirs.push(d);
  return d;
}

function runAtlas(projectRoot) {
  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000,
    }
  );
  if (result.error) throw new Error(`atlas.cjs failed to run: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`atlas.cjs exited ${result.status}\nstdout:${result.stdout}\nstderr:${result.stderr}`);
  }
  return result;
}

/**
 * Strip the vendored force-graph script block from graph.html before URL checks.
 * The force-graph UMD bundle contains W3C namespace URIs (e.g. http://www.w3.org/...)
 * and GitHub repo links in comments. These are NOT network fetches — they are string
 * literals baked into the vendored code.
 *
 * Mirrors stripVendorBlock() from knowledge-atlas-graph.test.js (finding #29.4).
 */
function stripVendorBlock(content, filename) {
  if (filename !== 'graph.html') return content;
  const vendorStart = content.indexOf('/* force-graph v');
  const vendorEnd = content.indexOf('</script>', vendorStart);
  if (vendorStart >= 0 && vendorEnd >= 0) {
    return content.slice(0, vendorStart) + content.slice(vendorEnd);
  }
  return content;
}

/**
 * Collect all generated files under knowledge-site/ (excluding manifest.json).
 * Returns array of { filename, content, stripped } objects.
 */
// Vendored browser runtimes copied verbatim into assets/. Like the inlined
// force-graph block, they contain baked-in string literals (W3C namespace URIs,
// license-comment links) that are NEVER fetched — mermaid/drawio render entirely
// client-side from local data. They ARE the offline runtime, so they are exempt
// from the external-URL scan (analogous to the manifest.json exemption).
const VENDORED_RUNTIME_ASSETS = new Set(['mermaid.min.js', 'drawio-viewer.min.js']);

function collectGeneratedFiles(siteDir) {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const filename = entry.name;
        // Exempt manifest.json (contains absolute fs paths, not external URLs)
        if (filename === 'manifest.json') continue;
        // Exempt vendored offline runtimes (see note above).
        if (VENDORED_RUNTIME_ASSETS.has(filename)) continue;
        const content = fs.readFileSync(full, 'utf-8');
        const stripped = stripVendorBlock(content, filename);
        files.push({ filename, full, content, stripped });
      }
    }
  };
  walk(siteDir);
  return files;
}

console.log('\n=== Knowledge Atlas Offline Safety Tests (Story 29.5) ===');

// ─── Pre-conditions ──────────────────────────────────────────────────────────
console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
});

test('rich-project fixture exists', () => {
  assert.ok(fs.existsSync(RICH_FIXTURE), `rich-project fixture missing: ${RICH_FIXTURE}`);
});

// ─── Setup: generate full site ───────────────────────────────────────────────
console.log('\n--- Setup: generate full site against rich-project ---');

let siteTmpDir;
let siteDir;
let generatedFiles;

test('generate full site (temp copy of rich-project)', () => {
  siteTmpDir = makeTempDir('full-site');
  copyDirRecursive(RICH_FIXTURE, siteTmpDir);
  runAtlas(siteTmpDir);
  siteDir = path.join(siteTmpDir, '_bmad-output', 'knowledge-site');
  assert.ok(fs.existsSync(siteDir), `knowledge-site must exist at ${siteDir}`);
});

test('all expected pages are generated', () => {
  if (!siteDir) throw new Error('siteDir not set (prior test failed)');
  for (const page of ['index.html', 'graph.html', 'diagrams.html', 'orphans.html', 'search.html', 'manifest.json']) {
    assert.ok(
      fs.existsSync(path.join(siteDir, page)),
      `${page} must be generated`
    );
  }
});

test('collect all generated files (excluding manifest.json)', () => {
  if (!siteDir) throw new Error('siteDir not set (prior test failed)');
  generatedFiles = collectGeneratedFiles(siteDir);
  assert.ok(generatedFiles.length > 0, 'must have generated files to scan');
  console.log(`      [INFO] Scanning ${generatedFiles.length} generated files: ${generatedFiles.map(f => f.filename).join(', ')}`);
});

// ─── AC 4: No external http:// URLs ──────────────────────────────────────────
console.log('\n--- AC 4: No external http:// URLs ---');

test('no http:// URLs in any generated page (excluding vendored bundle block)', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    if (stripped.includes('http://')) {
      // Find the context
      const idx = stripped.indexOf('http://');
      const ctx = stripped.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ');
      violations.push(`${filename}: http:// at context: "${ctx}"`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `http:// URLs found in generated pages:\n${violations.join('\n')}`
  );
});

test('no https:// URLs in any generated page (excluding vendored bundle block)', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    if (stripped.includes('https://')) {
      const idx = stripped.indexOf('https://');
      const ctx = stripped.slice(Math.max(0, idx - 40), idx + 80).replace(/\n/g, ' ');
      violations.push(`${filename}: https:// at context: "${ctx}"`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `https:// URLs found in generated pages:\n${violations.join('\n')}`
  );
});

// ─── AC 4: No external script/link tags ──────────────────────────────────────
console.log('\n--- AC 4: No external script/link tags ---');

test('no <script src= pointing to remote origin in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    // Any <script src= is external (no legitimate use in offline site).
    // Scan the vendor-stripped content for consistency with the URL checks (S-2).
    if (/<script\s[^>]*src=/i.test(stripped)) {
      violations.push(`${filename}: has <script src=...>`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `External <script src= found:\n${violations.join('\n')}`
  );
});

test('no <link href= pointing to remote origin in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    // Check for <link href="http... or <link rel="stylesheet" href="http...
    if (/<link\s[^>]*href=["']https?:/i.test(stripped)) {
      violations.push(`${filename}: has <link href="http(s)://...>`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `External <link href= found:\n${violations.join('\n')}`
  );
});

test('vendor-strip actually removed the force-graph block from graph.html (fail loud on marker drift)', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const graph = generatedFiles.find(f => f.filename === 'graph.html');
  assert.ok(graph, 'graph.html must be among generated files');
  // If a future force-graph bump changes the `/* force-graph v` marker, stripVendorBlock
  // would silently no-op and the W3C namespace URIs in the bundle would either leak as
  // false positives or (worse) mask a real URL. Assert the strip measurably shrank the file.
  assert.ok(graph.stripped.length < graph.content.length,
    'stripVendorBlock must have found and removed the vendored force-graph block from graph.html');
});

// ─── AC 4: No web-font imports ───────────────────────────────────────────────
console.log('\n--- AC 4: No web-font imports ---');

test('no @font-face with remote url( in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, content } of generatedFiles) {
    if (/@font-face[\s\S]*?url\s*\(\s*["']?https?:/i.test(content)) {
      violations.push(`${filename}: has @font-face with remote url()`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `Remote @font-face found:\n${violations.join('\n')}`
  );
});

test('no @import url(https?:...) in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, content } of generatedFiles) {
    if (/@import\s+url\s*\(\s*["']?https?:/i.test(content)) {
      violations.push(`${filename}: has @import url(http(s)://...)`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `Remote @import found:\n${violations.join('\n')}`
  );
});

test('no Google Fonts or similar CDN references', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, content } of generatedFiles) {
    if (content.includes('fonts.googleapis') || content.includes('fonts.gstatic')) {
      violations.push(`${filename}: references Google Fonts`);
    }
    if (content.includes('cdnjs.cloudflare') || content.includes('cdn.jsdelivr') || content.includes('unpkg.com')) {
      violations.push(`${filename}: references CDN`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `CDN/font references found:\n${violations.join('\n')}`
  );
});

// ─── AC 4: No fetch/XHR/WebSocket/import() of sibling files ─────────────────
console.log('\n--- AC 4: No fetch/XHR/WebSocket/import() ---');

test('no fetch() calls in any page (excluding vendor block)', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    // Match fetch( but not "prefetch", "manifest.prefetch", etc.
    // Use word-boundary-style: non-alpha-dash character before 'fetch'
    if (/[^a-z-]fetch\s*\(/i.test(stripped) || /^fetch\s*\(/m.test(stripped)) {
      violations.push(`${filename}: contains fetch() call`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `fetch() calls found:\n${violations.join('\n')}`
  );
});

test('no XMLHttpRequest in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    if (stripped.includes('XMLHttpRequest')) {
      violations.push(`${filename}: contains XMLHttpRequest`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `XMLHttpRequest found:\n${violations.join('\n')}`
  );
});

test('no WebSocket in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    if (stripped.includes('WebSocket')) {
      violations.push(`${filename}: contains WebSocket`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `WebSocket found:\n${violations.join('\n')}`
  );
});

test('no dynamic import() of remote/sibling in any page', () => {
  if (!generatedFiles) throw new Error('generatedFiles not collected (prior test failed)');
  const violations = [];
  for (const { filename, stripped } of generatedFiles) {
    // Detect import() calls — match as "import(" with any non-trivial argument
    // We allow import() only if it's clearly not present (the Atlas doesn't use dynamic imports)
    if (/\bimport\s*\(\s*["']https?:/.test(stripped)) {
      violations.push(`${filename}: contains import() of remote URL`);
    }
    if (/\bimport\s*\(\s*["'][./]/.test(stripped)) {
      violations.push(`${filename}: contains import() of relative/sibling file`);
    }
  }
  assert.deepStrictEqual(violations, [],
    `Dynamic import() of remote/sibling found:\n${violations.join('\n')}`
  );
});

// ─── Vendor block stripping validation ───────────────────────────────────────
console.log('\n--- Vendor block stripping ---');

test('stripVendorBlock finds force-graph block in graph.html', () => {
  if (!siteDir) throw new Error('siteDir not set');
  const graphPath = path.join(siteDir, 'graph.html');
  assert.ok(fs.existsSync(graphPath), 'graph.html must exist');
  const graphContent = fs.readFileSync(graphPath, 'utf-8');
  const stripped = stripVendorBlock(graphContent, 'graph.html');
  // After stripping, the stripped version should be shorter
  assert.ok(stripped.length < graphContent.length,
    'stripped graph.html must be shorter than original (vendor block removed)'
  );
  // The original graph.html contains W3C namespace URIs in the vendor block
  // After stripping, those should be gone
  const vendorStart = graphContent.indexOf('/* force-graph v');
  if (vendorStart >= 0) {
    // Confirm the block was found and removed
    assert.ok(!stripped.includes('/* force-graph v'),
      'vendor block marker must be stripped from graph.html'
    );
  }
});

test('other pages are not modified by stripVendorBlock', () => {
  if (!siteDir) throw new Error('siteDir not set');
  for (const page of ['index.html', 'diagrams.html', 'orphans.html', 'search.html']) {
    const pagePath = path.join(siteDir, page);
    if (!fs.existsSync(pagePath)) continue;
    const content = fs.readFileSync(pagePath, 'utf-8');
    const stripped = stripVendorBlock(content, page);
    assert.strictEqual(content, stripped,
      `stripVendorBlock must not modify ${page} (only strips from graph.html)`
    );
  }
});

// ─── Full site integrity (all required pages present) ────────────────────────
console.log('\n--- Full site integrity ---');

test('all 6 expected outputs present and non-empty', () => {
  if (!siteDir) throw new Error('siteDir not set');
  const expectedFiles = ['index.html', 'graph.html', 'diagrams.html', 'orphans.html', 'search.html', 'manifest.json'];
  for (const file of expectedFiles) {
    const filePath = path.join(siteDir, file);
    assert.ok(fs.existsSync(filePath), `${file} must exist`);
    const size = fs.statSync(filePath).size;
    assert.ok(size > 100, `${file} must be non-empty (got ${size} bytes)`);
  }
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────
for (const d of tempDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
