#!/usr/bin/env node
/**
 * test/knowledge-atlas-smoke.test.js
 * ---------------------------------------------------------------------------
 * Story 29.1 — Smoke tests for the Knowledge Atlas engine.
 *
 * AC coverage:
 *   AC 1 — build:atlas produces lib/knowledge-atlas/dist/atlas.cjs
 *   AC 3 — generate writes only under _bmad-output/knowledge-site/
 *   AC 5 — output contains no external URLs or script/fetch calls (offline proof)
 *   AC 7 — smoke test is green; bundle-drift check passes
 *
 * Test style: plain Node assert (no framework), matching the repo's existing
 * test style (see test/build-plugin.test.js).
 *
 * Key principles:
 *   - NEVER mutate the committed fixture. All generation runs against a TEMP COPY.
 *   - Pin SOURCE_DATE_EPOCH for deterministic timestamp output.
 *   - Windows/Linux compatible (LF-normalized reads, path.join for all paths).
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'minimal-project');
const ATLAS_CJS = path.join(PROJECT_ROOT, 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
const BUILD_ATLAS_SCRIPT = path.join(PROJECT_ROOT, 'scripts', 'build-atlas.js');

// Pin the timestamp so output is deterministic (NFR62).
// SOURCE_DATE_EPOCH=1700000000 → 2023-11-14T22:13:20Z
const PINNED_EPOCH = '1700000000';
const PINNED_TIMESTAMP = '2023-11-14T22:13:20Z';

let passed = 0;
let failed = 0;

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

/**
 * Recursively collect all file paths under a directory as relative POSIX paths.
 * Used to verify the engine wrote nothing outside the expected output folder.
 */
function collectFiles(root) {
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        results.push(path.relative(root, full).split(path.sep).join('/'));
      }
    }
  };
  walk(root);
  return results.sort();
}

/**
 * Copy a directory tree recursively.
 */
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

/**
 * SHA-256 of a file's content.
 */
function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Run atlas.cjs against a projectRoot and return the generated index.html content.
 * Pins SOURCE_DATE_EPOCH for deterministic output.
 */
function runAtlasCli(projectRoot) {
  const result = spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 30000, // never hang CI on a wedged subprocess
    }
  );
  if (result.error) {
    throw new Error(`atlas.cjs failed to run: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `atlas.cjs exited with code ${result.status}\nstderr: ${result.stderr}`
    );
  }
  const indexPath = result.stdout.trim();
  const content = fs.readFileSync(indexPath, 'utf-8');
  return { indexPath, content, stdout: result.stdout, stderr: result.stderr };
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite: pre-conditions
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n=== Knowledge Atlas Smoke Tests (Story 29.1) ===');
console.log('\n--- Pre-conditions ---');

test('fixture directory exists', () => {
  assert.ok(fs.existsSync(FIXTURE_DIR), `Fixture missing: ${FIXTURE_DIR}`);
  assert.ok(fs.statSync(FIXTURE_DIR).isDirectory());
});

test('fixture has _bmad-output with planning and implementation artifacts', () => {
  const bmadDir = path.join(FIXTURE_DIR, '_bmad-output');
  assert.ok(fs.existsSync(bmadDir), '_bmad-output must exist in fixture');
  assert.ok(fs.existsSync(path.join(bmadDir, 'planning-artifacts')), 'planning-artifacts must exist');
  assert.ok(fs.existsSync(path.join(bmadDir, 'implementation-artifacts')), 'implementation-artifacts must exist');
  assert.ok(
    fs.existsSync(path.join(bmadDir, 'implementation-artifacts', 'sprint-status.yaml')),
    'sprint-status.yaml must exist'
  );
});

test('fixture has package.json with a name field', () => {
  const pkgPath = path.join(FIXTURE_DIR, 'package.json');
  assert.ok(fs.existsSync(pkgPath), 'package.json must exist in fixture');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  assert.ok(typeof pkg.name === 'string' && pkg.name.length > 0, 'package.json must have a name');
});

test('atlas.cjs bundle exists (build:atlas was run)', () => {
  assert.ok(
    fs.existsSync(ATLAS_CJS),
    `atlas.cjs not found at ${ATLAS_CJS} — run: npm run build:atlas`
  );
  const size = fs.statSync(ATLAS_CJS).size;
  assert.ok(size > 0, `atlas.cjs must not be empty (size=${size})`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: generate via CLI (atlas.cjs)
// All generation runs against a TEMP COPY of the fixture — never the committed one.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n--- Generate (atlas.cjs CLI) ---');

let tmpDir;
let genContent;

test('create a temp copy of the fixture', () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-smoke-'));
  copyDirRecursive(FIXTURE_DIR, tmpDir);
  assert.ok(fs.existsSync(path.join(tmpDir, '_bmad-output')), 'temp copy must have _bmad-output');
});

test('atlas.cjs CLI exits 0 and prints index.html path to stdout', () => {
  if (!tmpDir) { throw new Error('temp dir not created (prior test failed)'); }
  const { content, stdout } = runAtlasCli(tmpDir);
  genContent = content;
  assert.ok(stdout.trim().endsWith('index.html'),
    `stdout must end with index.html, got: ${stdout.trim()}`
  );
});

test('index.html exists at _bmad-output/knowledge-site/index.html', () => {
  if (!tmpDir) { throw new Error('temp dir not available (prior test failed)'); }
  const indexPath = path.join(tmpDir, '_bmad-output', 'knowledge-site', 'index.html');
  assert.ok(fs.existsSync(indexPath), `index.html must exist at ${indexPath}`);
});

test('index.html is non-empty and >= 500 bytes', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(genContent.length >= 500,
    `index.html is suspiciously short: ${genContent.length} bytes`
  );
});

test('index.html contains the project title from package.json', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  // fixture package.json name is "minimal-atlas-fixture"
  assert.ok(
    genContent.includes('minimal-atlas-fixture'),
    'index.html must contain the project title "minimal-atlas-fixture"'
  );
});

test('index.html contains the pinned generated-at timestamp', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(
    genContent.includes(PINNED_TIMESTAMP),
    `index.html must contain the pinned timestamp ${PINNED_TIMESTAMP}`
  );
});

test('index.html is valid HTML (DOCTYPE, html, head, body)', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(genContent.startsWith('<!DOCTYPE html>'), 'must start with <!DOCTYPE html>');
  assert.ok(genContent.includes('<html'), 'must include <html');
  assert.ok(genContent.includes('<head>'), 'must include <head>');
  assert.ok(genContent.includes('<body>'), 'must include <body>');
  assert.ok(genContent.includes('</html>'), 'must include </html>');
});

test('index.html uses LF line endings (not CRLF)', () => {
  if (!tmpDir) { throw new Error('temp dir not available (prior test failed)'); }
  const indexPath = path.join(tmpDir, '_bmad-output', 'knowledge-site', 'index.html');
  const raw = fs.readFileSync(indexPath);
  const str = raw.toString('binary');
  assert.ok(!str.includes('\r\n'), 'index.html must use LF line endings, not CRLF');
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: AC 5 — offline-by-construction (no external URLs or fetch calls)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n--- Offline proof (AC 5) ---');

test('index.html contains no http:// URLs', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(!genContent.includes('http://'), 'index.html must not contain http:// URLs');
});

test('index.html contains no https:// URLs', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(!genContent.includes('https://'), 'index.html must not contain https:// URLs');
});

test('index.html contains no src= attribute', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(!genContent.includes('src='), 'index.html must not contain src= attributes');
});

test('index.html contains no fetch() calls', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(!genContent.includes('fetch('), 'index.html must not contain fetch() calls');
});

test('index.html contains no XMLHttpRequest', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(!genContent.includes('XMLHttpRequest'), 'index.html must not contain XMLHttpRequest');
});

test('index.html contains no <script> tags (29.1 no-runtime-JS rule)', () => {
  if (!genContent) { throw new Error('genContent not available (prior test failed)'); }
  assert.ok(
    !genContent.toLowerCase().includes('<script'),
    'index.html must not contain <script> tags in 29.1'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: AC 3 — nothing written outside _bmad-output/knowledge-site/
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n--- Write isolation (AC 3) ---');

test('nothing written outside _bmad-output/knowledge-site/', () => {
  if (!tmpDir) { throw new Error('temp dir not available (prior test failed)'); }

  const allFiles = collectFiles(tmpDir);
  const outsideKnowledgeSite = allFiles.filter(f =>
    !f.startsWith('_bmad-output/knowledge-site/')
  );

  // Every file outside knowledge-site/ must have come from the original fixture
  const originalFiles = collectFiles(FIXTURE_DIR);

  for (const f of outsideKnowledgeSite) {
    assert.ok(
      originalFiles.includes(f),
      `Engine wrote a new file outside _bmad-output/knowledge-site/: ${f}`
    );
  }
});

test('committed fixture is not mutated (no knowledge-site/ in fixture dir)', () => {
  const knowledgeSiteInFixture = path.join(FIXTURE_DIR, '_bmad-output', 'knowledge-site');
  assert.ok(
    !fs.existsSync(knowledgeSiteInFixture),
    'Committed fixture must not have knowledge-site/ — the smoke test must use a temp copy'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Bundle drift (AC 2.5)
// The committed atlas.cjs must match a fresh build byte-for-byte.
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n--- Bundle drift check ---');

test('fresh build produces same atlas.cjs bytes as the committed bundle', () => {
  // Snapshot the committed bundle's BYTES (not just its hash) so we can both
  // (a) detect drift and (b) restore the committed artifact afterwards — a
  // fresh build writes to the same OUT_FILE, so without restore a developer who
  // edited src/ without rebuilding would have the committed file silently
  // overwritten and the drift would go unnoticed on the next run.
  const committedBytes = fs.readFileSync(ATLAS_CJS);
  const committedHash = crypto.createHash('sha256').update(committedBytes).digest('hex');

  // Build into a TEMP working copy of the dist dir by pointing the build at a
  // throwaway OUT_FILE is not supported by the script's fixed-path contract;
  // instead we rebuild in place, hash, then restore the original bytes.
  let rebuiltHash;
  try {
    const buildResult = spawnSync(
      process.execPath,
      [BUILD_ATLAS_SCRIPT],
      {
        encoding: 'utf-8',
        cwd: PROJECT_ROOT,
        timeout: 60000,
      }
    );
    assert.ok(!buildResult.error, `build-atlas.js failed to run: ${buildResult.error && buildResult.error.message}`);
    assert.strictEqual(
      buildResult.status, 0,
      `build-atlas.js failed (exit ${buildResult.status})\nstderr: ${buildResult.stderr}`
    );
    rebuiltHash = fileHash(ATLAS_CJS);
  } finally {
    // Restore the committed bytes regardless of the assertion outcome so the
    // working tree is never left mutated by the test run.
    fs.writeFileSync(ATLAS_CJS, committedBytes);
  }

  assert.strictEqual(
    rebuiltHash,
    committedHash,
    'Committed atlas.cjs does not match a fresh build — run `npm run build:atlas` and commit the result'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Determinism (same input + pinned epoch → same output)
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n--- Determinism ---');

test('two runs with pinned SOURCE_DATE_EPOCH produce byte-identical index.html', () => {
  const tmpA = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-detA-'));
  const tmpB = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-detB-'));
  try {
    copyDirRecursive(FIXTURE_DIR, tmpA);
    copyDirRecursive(FIXTURE_DIR, tmpB);

    runAtlasCli(tmpA);
    runAtlasCli(tmpB);

    const hA = fileHash(path.join(tmpA, '_bmad-output', 'knowledge-site', 'index.html'));
    const hB = fileHash(path.join(tmpB, '_bmad-output', 'knowledge-site', 'index.html'));

    assert.strictEqual(hA, hB,
      'Two atlas runs with pinned SOURCE_DATE_EPOCH must produce byte-identical index.html'
    );
  } finally {
    try { fs.rmSync(tmpA, { recursive: true, force: true }); } catch { /* swallow */ }
    try { fs.rmSync(tmpB, { recursive: true, force: true }); } catch { /* swallow */ }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Suite: Robustness guards (edge-case hunter)
//   - #6 out-of-range / invalid SOURCE_DATE_EPOCH degrades to wall clock
//   - #7 --out escaping projectRoot is rejected (write-anywhere guard)
//   - #8 non-existent projectRoot is rejected with a clear error
// ─────────────────────────────────────────────────────────────────────────────

console.log('\n--- Robustness guards ---');

/** Run atlas.cjs with arbitrary extra args + env; return the raw spawnSync result. */
function runAtlasRaw(args, extraEnv) {
  return spawnSync(
    process.execPath,
    [ATLAS_CJS, ...args],
    {
      encoding: 'utf-8',
      env: { ...process.env, ...(extraEnv || {}) },
      timeout: 30000,
    }
  );
}

test('non-existent projectRoot exits non-zero with a clear error', () => {
  const bogus = path.join(os.tmpdir(), 'atlas-does-not-exist-' + Date.now());
  const res = runAtlasRaw([bogus]);
  assert.notStrictEqual(res.status, 0, 'must exit non-zero for a missing projectRoot');
  assert.ok(
    /does not exist or is not a directory/i.test(res.stderr),
    `stderr must name the missing-directory problem, got: ${res.stderr}`
  );
});

test('--out escaping projectRoot is rejected (write-anywhere guard)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-escape-'));
  // A sibling temp dir that is NOT under `tmp` — path.relative starts with ".."
  const escape = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-escapeOUT-'));
  try {
    copyDirRecursive(FIXTURE_DIR, tmp);
    const res = runAtlasRaw([tmp, '--out', escape]);
    assert.notStrictEqual(res.status, 0, 'must exit non-zero when --out escapes projectRoot');
    assert.ok(
      /escapes projectRoot/i.test(res.stderr),
      `stderr must report the escape, got: ${res.stderr}`
    );
    // And it must NOT have written anything into the escape dir.
    const escapeFiles = collectFiles(escape);
    assert.deepStrictEqual(escapeFiles, [], `nothing must be written to the escape dir, found: ${escapeFiles.join(', ')}`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* swallow */ }
    try { fs.rmSync(escape, { recursive: true, force: true }); } catch { /* swallow */ }
  }
});

test('out-of-range SOURCE_DATE_EPOCH does not crash (degrades to wall clock)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-badepoch-'));
  try {
    copyDirRecursive(FIXTURE_DIR, tmp);
    // 999999999999999 seconds → *1000 overflows the JS Date time range.
    const res = runAtlasRaw([tmp], { SOURCE_DATE_EPOCH: '999999999999999' });
    assert.strictEqual(res.status, 0, `must succeed (wall-clock fallback), stderr: ${res.stderr}`);
    const indexPath = path.join(tmp, '_bmad-output', 'knowledge-site', 'index.html');
    const html = fs.readFileSync(indexPath, 'utf-8');
    // A valid ISO-8601 Z timestamp must be present (not "Invalid Date").
    assert.ok(/Generated at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z/.test(html),
      'index.html must contain a valid ISO-8601 timestamp after fallback'
    );
    assert.ok(!/Invalid Date/.test(html), 'index.html must not contain "Invalid Date"');
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* swallow */ }
  }
});

test('negative SOURCE_DATE_EPOCH does not crash (degrades to wall clock)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'atlas-negepoch-'));
  try {
    copyDirRecursive(FIXTURE_DIR, tmp);
    const res = runAtlasRaw([tmp], { SOURCE_DATE_EPOCH: '-1' });
    assert.strictEqual(res.status, 0, `must succeed (wall-clock fallback), stderr: ${res.stderr}`);
  } finally {
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* swallow */ }
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────

try { if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* swallow */ }

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n  Passed: ${passed}, Failed: ${failed}\n`);

if (failed > 0) {
  process.exit(1);
}
