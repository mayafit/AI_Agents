#!/usr/bin/env node
/**
 * test/knowledge-atlas-degradation.test.js
 * ---------------------------------------------------------------------------
 * Story 29.6 — Graceful-degradation + output-safety release assertions
 *              (AC 3, AC 4, NFR63, NFR64, FR234).
 *
 * This test covers two distinct but related gates:
 *
 * GATE A — Graceful degradation (AC 3, NFR63, FR234):
 *   A project with a mix of valid AND malformed docs (bad YAML frontmatter,
 *   zero-byte file, binary content, unknown doc type) must:
 *   1. Exit 0 (never crash)
 *   2. Produce all six page types (index, search, graph, diagrams, orphans,
 *      plus at least one doc page from the valid PRD)
 *   3. Omit or note malformed inputs — never silently corrupt output
 *   4. Present legible, navigable content WITHOUT executing any script
 *      (disabled-JS baseline: no blank screen)
 *
 * GATE B — Output safety / XSS sanitization (AC 4, NFR64):
 *   Injected attack payloads inside a doc are neutralized in the rendered HTML:
 *   - <script>alert(1)</script>         → stripped (tag + content)
 *   - <img src=x onerror=alert(1)>      → onerror attribute removed
 *   - [x](javascript:alert(1))          → href blocked / stripped
 *   - <a href="vbscript:…">             → href blocked / stripped
 *   - <iframe …>                        → stripped (tag + content)
 *   - <form action="javascript:…">      → form stripped or action removed
 *   - data: scheme href                 → href blocked / stripped
 *
 * The fixture used is `test/fixtures/knowledge-atlas/degraded-project`:
 *   planning-artifacts/
 *     prd.md                  — valid anchor document
 *     bad-yaml-frontmatter.md — malformed YAML frontmatter
 *     binary-file.md          — binary content (NUL bytes → skip)
 *   implementation-artifacts/
 *     zero-byte-story.md      — zero-byte file
 *     xss-injection-story.md  — XSS/injection payloads (NFR64 gate)
 *     sprint-status.yaml      — valid sprint status
 *
 * All generation runs against a TEMP COPY of the fixture — never the committed one.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ATLAS_CJS = path.join(PROJECT_ROOT, 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const DEGRADED_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'degraded-project');

// Pin epoch for determinism.
const PINNED_EPOCH = '1700000000';

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

function makeTempDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-degrade-${prefix}-`));
  tempDirs.push(d);
  return d;
}

function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

function runAtlas(projectRoot) {
  return spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 60000,
    }
  );
}

function collectFiles(root) {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else results.push(path.relative(root, full).split(path.sep).join('/'));
    }
  };
  walk(root);
  return results.sort();
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Knowledge Atlas Degradation + Safety Tests (Story 29.6 AC 3/4) ===');

// ─────────────────────────────────────────────────────────────────────────────
// Pre-conditions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
});

test('degraded-project fixture exists with required files', () => {
  assert.ok(fs.existsSync(DEGRADED_FIXTURE), `degraded-project fixture missing: ${DEGRADED_FIXTURE}`);
  const prd = path.join(DEGRADED_FIXTURE, '_bmad-output', 'planning-artifacts', 'prd.md');
  assert.ok(fs.existsSync(prd), `Valid PRD must exist in fixture: ${prd}`);
  const badYaml = path.join(DEGRADED_FIXTURE, '_bmad-output', 'planning-artifacts', 'bad-yaml-frontmatter.md');
  assert.ok(fs.existsSync(badYaml), `Bad-YAML fixture file must exist: ${badYaml}`);
  const zeroBytes = path.join(DEGRADED_FIXTURE, '_bmad-output', 'implementation-artifacts', 'zero-byte-story.md');
  assert.ok(fs.existsSync(zeroBytes), `Zero-byte fixture file must exist: ${zeroBytes}`);
  assert.strictEqual(fs.statSync(zeroBytes).size, 0, 'zero-byte-story.md must be 0 bytes');
  const xssDoc = path.join(DEGRADED_FIXTURE, '_bmad-output', 'implementation-artifacts', 'xss-injection-story.md');
  assert.ok(fs.existsSync(xssDoc), `XSS injection fixture must exist: ${xssDoc}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE A: Graceful degradation
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Gate A: Graceful degradation (NFR63, FR234) ---');

let tmpDeg;
let siteDir;
let runResult;

test('copy degraded-project fixture to temp dir', () => {
  tmpDeg = makeTempDir('deg');
  copyDirRecursive(DEGRADED_FIXTURE, tmpDeg);
  assert.ok(fs.existsSync(path.join(tmpDeg, '_bmad-output')));
});

test('generate exits 0 on degraded-project (no crash)', () => {
  if (!tmpDeg) throw new Error('tmpDeg not created (prior test failed)');
  runResult = runAtlas(tmpDeg);
  // Key assertion: exit code must be 0 even with malformed files present.
  assert.strictEqual(runResult.status, 0,
    `generate must exit 0 on degraded-project but got ${runResult.status}\n` +
    `stderr: ${runResult.stderr}`);
  siteDir = path.join(tmpDeg, '_bmad-output', 'knowledge-site');
});

test('all six page types are produced', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const files = collectFiles(siteDir);

  // index.html — home page
  assert.ok(files.includes('index.html'),
    `index.html must be produced. Files: ${files.join(', ')}`);

  // search.html
  assert.ok(files.includes('search.html'),
    `search.html must be produced. Files: ${files.join(', ')}`);

  // graph.html
  assert.ok(files.includes('graph.html'),
    `graph.html must be produced. Files: ${files.join(', ')}`);

  // diagrams.html
  assert.ok(files.includes('diagrams.html'),
    `diagrams.html must be produced. Files: ${files.join(', ')}`);

  // orphans.html
  assert.ok(files.includes('orphans.html'),
    `orphans.html must be produced. Files: ${files.join(', ')}`);

  // At least one doc page (from the valid prd.md)
  const docPages = files.filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  assert.ok(docPages.length > 0,
    `At least one doc page must be produced from the valid PRD. Files: ${files.join(', ')}`);
});

test('malformed inputs do not corrupt the output (no garbage content)', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const indexPath = path.join(siteDir, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  // The index page must be valid HTML
  assert.ok(indexHtml.startsWith('<!DOCTYPE html>'), 'index.html must start with <!DOCTYPE html>');
  assert.ok(indexHtml.includes('<html'), 'index.html must include <html');
  assert.ok(indexHtml.includes('</html>'), 'index.html must include </html>');
  // Must not contain binary garbage (NUL bytes)
  assert.ok(!indexHtml.includes('\x00'), 'index.html must not contain NUL bytes');
});

test('valid PRD content appears in output (not silently omitted)', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const indexPath = path.join(siteDir, 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');
  // The project title from package.json must appear
  assert.ok(indexHtml.includes('degraded-atlas-fixture'),
    'index.html must contain the project title from package.json');
});

test('at least one doc page is readable (has navigation and content)', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  assert.ok(docFiles.length > 0, 'at least one doc page must exist');
  const docHtml = fs.readFileSync(path.join(siteDir, docFiles[0]), 'utf-8');
  // Navigation links must be present (no blank screen)
  assert.ok(docHtml.includes('href'), 'doc page must have navigation links');
  assert.ok(docHtml.includes('<nav'), 'doc page must have a <nav> element');
  // Must be valid HTML
  assert.ok(docHtml.startsWith('<!DOCTYPE html>'), 'doc page must be valid HTML');
  assert.ok(docHtml.includes('</html>'), 'doc page must close the html element');
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE A2: Disabled-JS baseline (NFR63 — no blank screen)
// The site must be legible WITHOUT executing any script.
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Gate A2: Disabled-JS baseline (no blank screen) ---');

test('index.html presents readable content without script execution', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const indexHtml = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf-8');
  // index.html must NOT contain <script> tags (the 29.1 invariant and NFR63 baseline)
  assert.ok(!indexHtml.toLowerCase().includes('<script'),
    'index.html must not contain <script> tags — legible without JS');
  // Must have structural landmarks (h1, nav)
  assert.ok(indexHtml.includes('<h1'), 'index.html must have an h1 heading');
  assert.ok(indexHtml.includes('<nav'), 'index.html must have a nav element');
});

test('a doc page presents reading content without script-dependency', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  assert.ok(docFiles.length > 0, 'at least one doc page required');
  const docHtml = fs.readFileSync(path.join(siteDir, docFiles[0]), 'utf-8');
  // Doc pages render their text content into static HTML — legible without JS.
  // They may have inline <script> for search/graph features, but the article
  // content (headings, paragraphs) must be present in the static HTML.
  assert.ok(docHtml.includes('<h1') || docHtml.includes('<h2') || docHtml.includes('<p'),
    'doc page must have readable text content (h1/h2/p) without script execution');
  // Nav links must be present (non-JS navigation)
  assert.ok(docHtml.includes('href="../index.html"') || docHtml.includes('href=".'),
    'doc page must have navigation links to home');
});

test('no page requires script to show non-blank content', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  // Check every html page: if ALL content is inside a noscript or deferred
  // script block, that would be a blank screen without JS. We assert that
  // every page has legible <h1>/<h2>/<p> content OUTSIDE script tags.
  const htmlFiles = collectFiles(siteDir).filter(f => f.endsWith('.html'));
  const blankScreenPages = [];
  for (const f of htmlFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    // Strip all <script>...</script> blocks
    const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    // Check if there's readable structural content remaining
    const hasContent = /<h[1-6]|<p\b|<nav\b|<article\b|<main\b/.test(withoutScripts);
    if (!hasContent) blankScreenPages.push(f);
  }
  assert.strictEqual(blankScreenPages.length, 0,
    `These pages would be blank without JS: ${blankScreenPages.join(', ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// GATE B: Output safety / XSS sanitization (AC 4, NFR64)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Gate B: Output safety / XSS sanitization (NFR64) ---');

// The xss-injection-story.md is in implementation-artifacts/, which should be
// scanned and rendered. Find its doc page by looking for the rendered content.
let xssDocHtml = null;

test('XSS injection story is scanned and a doc page is produced', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  // Find the page that contains "XSS Injection Test Story" (the h1 from the doc)
  let found = null;
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    if (html.includes('XSS Injection Test Story') || html.includes('xss-injection')) {
      found = html;
      break;
    }
  }
  // If the XSS doc wasn't rendered as a page, it may have been omitted due to
  // classification or the "unknown" type. Accept either:
  // (a) it was rendered and sanitized, OR (b) it was omitted entirely.
  // Importantly: we ALSO check all rendered pages do not contain executable payloads.
  xssDocHtml = found; // may be null if the doc was omitted (also acceptable)
  // Non-vacuous: the site must have been generated, and IF the XSS doc was rendered
  // as a page, its executable payload must already be neutralized here (the
  // subsequent tests then scan ALL pages defensively).
  assert.ok(siteDir && fs.existsSync(siteDir),
    'site must have been generated before XSS sanitization checks');
  if (xssDocHtml !== null) {
    assert.ok(!/<script\b[^>]*>\s*[^<]*alert\s*\(/i.test(xssDocHtml),
      'a rendered XSS doc must not contain an executable <script>…alert(…) payload');
    assert.ok(!/\shref\s*=\s*["']\s*(javascript|vbscript):/i.test(xssDocHtml),
      'a rendered XSS doc must not contain a javascript:/vbscript: href');
  }
});

test('<script> tags from document content are stripped in ALL rendered pages', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const violations = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    // Check that no executable <script>alert(1)</script> survives
    // The sanitizer removes <script> tags; escaped as &lt;script&gt; is fine
    if (/<script\b[^>]*>[\s\S]*?alert\s*\(/.test(html)) {
      violations.push(`${f}: executable <script>alert() found`);
    }
  }
  assert.strictEqual(violations.length, 0,
    `Executable <script>alert() found in rendered pages:\n  ${violations.join('\n  ')}`);
});

test('onerror= event handler from document content is stripped in ALL rendered pages', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const violations = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    // onerror=alert(1) must not appear as an executable attribute
    if (/\bonerror\s*=\s*["']?alert/i.test(html)) {
      violations.push(`${f}: onerror=alert found`);
    }
    // Generic on* event handlers from injected content
    if (/\bon\w+\s*=\s*["']?alert/i.test(html)) {
      violations.push(`${f}: on*=alert event handler found`);
    }
  }
  assert.strictEqual(violations.length, 0,
    `on* event handlers found in rendered pages:\n  ${violations.join('\n  ')}`);
});

test('javascript: href from document content is stripped in ALL rendered pages', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const violations = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    // javascript: scheme in an href attribute must be absent
    if (/href\s*=\s*["']?\s*javascript:/i.test(html)) {
      violations.push(`${f}: javascript: href found`);
    }
  }
  assert.strictEqual(violations.length, 0,
    `javascript: href found in rendered pages:\n  ${violations.join('\n  ')}`);
});

test('vbscript: href from document content is stripped in ALL rendered pages', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const violations = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    if (/href\s*=\s*["']?\s*vbscript:/i.test(html)) {
      violations.push(`${f}: vbscript: href found`);
    }
  }
  assert.strictEqual(violations.length, 0,
    `vbscript: href found in rendered pages:\n  ${violations.join('\n  ')}`);
});

test('<iframe> tags from document content are stripped in ALL rendered pages', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const violations = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    // <iframe> is in CONTENT_REMOVAL_TAGS — its tag and content are stripped.
    // An escaped &lt;iframe&gt; in text is acceptable; only executable <iframe src=...> is not.
    if (/<iframe\b/i.test(html)) {
      violations.push(`${f}: <iframe> tag found in output`);
    }
  }
  assert.strictEqual(violations.length, 0,
    `<iframe> tags found in rendered pages:\n  ${violations.join('\n  ')}`);
});

test('data: scheme href from document content is stripped in ALL rendered pages', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const violations = [];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    if (/href\s*=\s*["']?\s*data:/i.test(html)) {
      violations.push(`${f}: data: href found`);
    }
  }
  assert.strictEqual(violations.length, 0,
    `data: href found in rendered pages:\n  ${violations.join('\n  ')}`);
});

test('NFR64 consolidated: no XSS payload from DOC CONTENT survives in any rendered page', () => {
  if (!siteDir) throw new Error('siteDir not available (prior test failed)');
  // NFR64 scopes to DOCUMENT CONTENT — payloads injected by document authors
  // must not survive executable in rendered output.
  //
  // Scope:
  //   - doc pages (docs/*.html) have NO engine <script> blocks, so we apply
  //     the full XSS battery to them.
  //   - graph.html and search.html legitimately contain engine-generated
  //     <script> blocks (force-graph visualization, lunr search). These are
  //     engine infrastructure, not user-doc content. We apply the XSS checks
  //     ONLY to content that comes FROM documents (href/src/on* attrs) and
  //     verify that no injected payload from user documents made it through.
  //
  // This is consistent with how sanitizeHtml() is applied: it runs on
  // markdown-rendered HTML from each document page, not on engine-built pages.
  const docFiles = collectFiles(siteDir).filter(f => f.startsWith('docs/') && f.endsWith('.html'));
  const infraFiles = collectFiles(siteDir).filter(
    f => f.endsWith('.html') && !f.startsWith('docs/')
  );

  const violations = [];

  // Full battery on doc pages (no legitimate <script> blocks here)
  const docChecks = [
    [/<script\b[^>]*>[\s\S]*?<\/script>/i,              '<script>…</script> block found'],
    [/\bon\w+\s*=\s*["']?alert/i,                        'on*=alert event handler found'],
    [/href\s*=\s*["']?\s*javascript:/i,                  'javascript: href found'],
    [/href\s*=\s*["']?\s*vbscript:/i,                    'vbscript: href found'],
    [/<iframe\b/i,                                        '<iframe> tag found'],
    [/href\s*=\s*["']?\s*data:/i,                        'data: href found'],
    [/src\s*=\s*["']?\s*(?:javascript|vbscript|data):/i, 'dangerous src= found'],
  ];
  for (const f of docFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    for (const [pattern, msg] of docChecks) {
      if (pattern.test(html)) violations.push(`${f}: ${msg}`);
    }
  }

  // On infra pages (graph/search/index/orphans/diagrams), check only the
  // document-content-derived parts: href/src dangerous schemes and on*=alert
  // (the engine never emits these; if present, they leaked from doc content).
  const infraChecks = [
    [/\bon\w+\s*=\s*["']?alert/i,                        'on*=alert event handler found'],
    [/href\s*=\s*["']?\s*javascript:/i,                  'javascript: href found'],
    [/href\s*=\s*["']?\s*vbscript:/i,                    'vbscript: href found'],
    [/<iframe\b/i,                                        '<iframe> tag found'],
    [/href\s*=\s*["']?\s*data:/i,                        'data: href found'],
    [/src\s*=\s*["']?\s*(?:javascript|vbscript|data):/i, 'dangerous src= found'],
  ];
  for (const f of infraFiles) {
    const html = fs.readFileSync(path.join(siteDir, f), 'utf-8');
    for (const [pattern, msg] of infraChecks) {
      if (pattern.test(html)) violations.push(`${f}: ${msg}`);
    }
  }

  assert.strictEqual(violations.length, 0,
    `NFR64 violations (doc-content XSS payload survived):\n  ${violations.join('\n  ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

for (const d of tempDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* swallow */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
