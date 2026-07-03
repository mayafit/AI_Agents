#!/usr/bin/env node
/**
 * test/knowledge-atlas-determinism.test.js
 * ---------------------------------------------------------------------------
 * Story 29.6 — Cross-platform determinism gate (AC 2, NFR62).
 *
 * Invariants verified:
 *   1. Full site generated twice from the SAME fixture (different absolute temp
 *      paths) produces byte-identical output for EVERY emitted file
 *      (html, js, json).
 *   2. manifest.json contains no machine-specific absolute path (proof that
 *      persist.ts relativizes projectRoot → "." and bmadOutputDir → "_bmad-output").
 *   3. A CRLF-converted copy of the fixture inputs produces byte-identical
 *      site output to the LF form — no CRLF-induced hash churn.
 *
 * SOURCE_DATE_EPOCH is pinned so the generated timestamps are deterministic.
 *
 * Test style: plain Node assert (no framework), matching repo style.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const ATLAS_CJS = path.join(PROJECT_ROOT, 'lib', 'knowledge-atlas', 'dist', 'atlas.cjs');
// Use the rich-project fixture — it has a richer graph, multiple doc types, a
// knowledge-graph.json, etc. This exercises more of the rendering pipeline than
// the minimal fixture.
const RICH_FIXTURE = path.join(__dirname, 'fixtures', 'knowledge-atlas', 'rich-project');

// Pin SOURCE_DATE_EPOCH for deterministic timestamps (NFR62).
// 1700000000 → 2023-11-14T22:13:20Z
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
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `atlas-det-${prefix}-`));
  tempDirs.push(d);
  return d;
}

/**
 * Recursively copy a directory tree.
 */
function copyDirRecursive(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(s, d);
    else fs.copyFileSync(s, d);
  }
}

/**
 * Recursively copy a directory tree, converting LF → CRLF in text files.
 * Binary files (detected by extension) are copied as-is.
 */
const TEXT_EXTS = new Set(['.md', '.yaml', '.yml', '.json', '.txt', '.ts', '.js']);
function copyDirCrlf(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirCrlf(s, d);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (TEXT_EXTS.has(ext)) {
        const content = fs.readFileSync(s, 'utf-8');
        // Convert LF → CRLF (idempotent: avoid double-converting existing CRLF)
        const crlf = content.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
        fs.writeFileSync(d, crlf, { encoding: 'utf-8' });
      } else {
        fs.copyFileSync(s, d);
      }
    }
  }
}

/** SHA-256 of a file's raw bytes. */
function fileHash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * Collect all file paths recursively under a directory, returning relative
 * POSIX paths sorted lexicographically.
 */
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

/**
 * Run atlas.cjs against a projectRoot with the pinned epoch.
 * Returns { status, stdout, stderr }.
 */
function runAtlas(projectRoot) {
  const res = spawnSync(
    process.execPath,
    [ATLAS_CJS, projectRoot],
    {
      encoding: 'utf-8',
      env: { ...process.env, SOURCE_DATE_EPOCH: PINNED_EPOCH },
      timeout: 60000,
    }
  );
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pre-conditions
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n=== Knowledge Atlas Determinism Tests (Story 29.6 AC 2) ===');
console.log('\n--- Pre-conditions ---');

test('atlas.cjs bundle exists', () => {
  assert.ok(fs.existsSync(ATLAS_CJS), `atlas.cjs not found: ${ATLAS_CJS}`);
  assert.ok(fs.statSync(ATLAS_CJS).size > 0, 'atlas.cjs must not be empty');
});

test('rich-project fixture exists', () => {
  assert.ok(fs.existsSync(RICH_FIXTURE), `rich-project fixture missing: ${RICH_FIXTURE}`);
  assert.ok(fs.existsSync(path.join(RICH_FIXTURE, '_bmad-output')),
    'rich-project must have _bmad-output');
});

// ─────────────────────────────────────────────────────────────────────────────
// Gate 1: two runs from DIFFERENT absolute temp paths → byte-identical output
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Gate 1: two-path byte-identity ---');

let tmpA, tmpB;

test('copy rich-project to two different temp dirs', () => {
  tmpA = makeTempDir('A');
  tmpB = makeTempDir('B');
  copyDirRecursive(RICH_FIXTURE, tmpA);
  copyDirRecursive(RICH_FIXTURE, tmpB);
  assert.ok(fs.existsSync(path.join(tmpA, '_bmad-output')), 'tmpA must have _bmad-output');
  assert.ok(fs.existsSync(path.join(tmpB, '_bmad-output')), 'tmpB must have _bmad-output');
  // The two absolute paths MUST differ for this gate to be meaningful.
  assert.notStrictEqual(tmpA, tmpB, 'temp dirs must differ');
});

test('atlas.cjs exits 0 on both temp dirs', () => {
  if (!tmpA || !tmpB) throw new Error('temp dirs not created (prior test failed)');
  const resA = runAtlas(tmpA);
  const resB = runAtlas(tmpB);
  assert.strictEqual(resA.status, 0, `run A failed (${resA.status}): ${resA.stderr}`);
  assert.strictEqual(resB.status, 0, `run B failed (${resB.status}): ${resB.stderr}`);
});

test('ALL emitted files (html/js/json) are byte-identical between the two runs', () => {
  if (!tmpA || !tmpB) throw new Error('temp dirs not available (prior test failed)');
  const siteA = path.join(tmpA, '_bmad-output', 'knowledge-site');
  const siteB = path.join(tmpB, '_bmad-output', 'knowledge-site');
  assert.ok(fs.existsSync(siteA), `knowledge-site missing in run A: ${siteA}`);
  assert.ok(fs.existsSync(siteB), `knowledge-site missing in run B: ${siteB}`);

  const filesA = collectFiles(siteA).filter(f => /\.(html|js|json)$/.test(f));
  const filesB = collectFiles(siteB).filter(f => /\.(html|js|json)$/.test(f));

  assert.deepStrictEqual(filesA, filesB,
    `File lists differ between runs:\n  A: ${filesA.join(', ')}\n  B: ${filesB.join(', ')}`);
  assert.ok(filesA.length > 0, 'At least one html/js/json file must be emitted');

  const diffs = [];
  for (const f of filesA) {
    const hA = fileHash(path.join(siteA, f));
    const hB = fileHash(path.join(siteB, f));
    if (hA !== hB) diffs.push(`${f}: A=${hA} B=${hB}`);
  }
  assert.strictEqual(diffs.length, 0,
    `${diffs.length} file(s) differ between runs:\n  ${diffs.join('\n  ')}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Gate 2: manifest.json has no absolute machine path
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Gate 2: manifest has no absolute machine path ---');

test('manifest.json exists in at least one run output', () => {
  if (!tmpA) throw new Error('tmpA not available (prior test failed)');
  const manifestPath = path.join(tmpA, '_bmad-output', 'knowledge-site', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), `manifest.json missing: ${manifestPath}`);
});

test('manifest.json projectRoot is "." (not an absolute machine path)', () => {
  if (!tmpA) throw new Error('tmpA not available (prior test failed)');
  const manifestPath = path.join(tmpA, '_bmad-output', 'knowledge-site', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  assert.strictEqual(manifest.projectRoot, '.',
    `manifest.json must have projectRoot="." but got: ${JSON.stringify(manifest.projectRoot)}`);
});

test('manifest.json bmadOutputDir is relative POSIX path (not absolute)', () => {
  if (!tmpA) throw new Error('tmpA not available (prior test failed)');
  const manifestPath = path.join(tmpA, '_bmad-output', 'knowledge-site', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  const bmad = manifest.bmadOutputDir;
  assert.ok(typeof bmad === 'string', 'bmadOutputDir must be a string');
  assert.ok(!path.isAbsolute(bmad),
    `manifest.json bmadOutputDir must be relative, got: ${JSON.stringify(bmad)}`);
  // Must not contain a drive letter (Windows absolute path leak)
  assert.ok(!/^[A-Za-z]:/.test(bmad),
    `manifest.json bmadOutputDir must not be a Windows absolute path: ${JSON.stringify(bmad)}`);
});

test('manifest.json does not contain the temp dir absolute path', () => {
  if (!tmpA) throw new Error('tmpA not available (prior test failed)');
  const manifestPath = path.join(tmpA, '_bmad-output', 'knowledge-site', 'manifest.json');
  const content = fs.readFileSync(manifestPath, 'utf-8');
  // tmpA is the machine-specific temp path — it must not appear in the manifest.
  assert.ok(!content.includes(tmpA),
    `manifest.json leaks the machine-specific temp path: ${tmpA}`);
  // Also check that tmpB's path (a different machine path) would differ — only
  // possible if no absolute path is embedded.
  assert.ok(!content.includes(tmpB),
    `manifest.json leaks tmpB's machine-specific temp path: ${tmpB}`);
});

test('manifest.json is byte-identical between the two runs', () => {
  if (!tmpA || !tmpB) throw new Error('temp dirs not available (prior test failed)');
  const mA = path.join(tmpA, '_bmad-output', 'knowledge-site', 'manifest.json');
  const mB = path.join(tmpB, '_bmad-output', 'knowledge-site', 'manifest.json');
  const hA = fileHash(mA);
  const hB = fileHash(mB);
  assert.strictEqual(hA, hB,
    `manifest.json differs between runs:\n  A: ${hA}\n  B: ${hB}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// Gate 3: CRLF inputs → identical output to LF form
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Gate 3: CRLF inputs ≡ LF inputs ---');

let tmpLF, tmpCRLF;

test('copy rich-project to LF and CRLF temp dirs', () => {
  tmpLF = makeTempDir('LF');
  tmpCRLF = makeTempDir('CRLF');
  copyDirRecursive(RICH_FIXTURE, tmpLF);   // LF form — straight copy
  copyDirCrlf(RICH_FIXTURE, tmpCRLF);      // CRLF form — convert text files
  assert.ok(fs.existsSync(path.join(tmpLF, '_bmad-output')), 'tmpLF must have _bmad-output');
  assert.ok(fs.existsSync(path.join(tmpCRLF, '_bmad-output')), 'tmpCRLF must have _bmad-output');
});

test('atlas.cjs exits 0 on CRLF fixture', () => {
  if (!tmpCRLF) throw new Error('tmpCRLF not created (prior test failed)');
  const res = runAtlas(tmpCRLF);
  assert.strictEqual(res.status, 0, `CRLF run failed (${res.status}): ${res.stderr}`);
});

test('atlas.cjs exits 0 on LF fixture (control)', () => {
  if (!tmpLF) throw new Error('tmpLF not created (prior test failed)');
  const res = runAtlas(tmpLF);
  assert.strictEqual(res.status, 0, `LF run failed (${res.status}): ${res.stderr}`);
});

test('CRLF input produces byte-identical site output to LF input', () => {
  if (!tmpLF || !tmpCRLF) throw new Error('temp dirs not available (prior test failed)');
  const siteLF   = path.join(tmpLF,   '_bmad-output', 'knowledge-site');
  const siteCRLF = path.join(tmpCRLF, '_bmad-output', 'knowledge-site');
  assert.ok(fs.existsSync(siteLF),   `LF site dir missing: ${siteLF}`);
  assert.ok(fs.existsSync(siteCRLF), `CRLF site dir missing: ${siteCRLF}`);

  const filesLF   = collectFiles(siteLF).filter(f => /\.(html|js|json)$/.test(f));
  const filesCRLF = collectFiles(siteCRLF).filter(f => /\.(html|js|json)$/.test(f));

  assert.deepStrictEqual(filesLF, filesCRLF,
    `File lists differ:\n  LF:   ${filesLF.join(', ')}\n  CRLF: ${filesCRLF.join(', ')}`);

  const diffs = [];
  for (const f of filesLF) {
    const hLF   = fileHash(path.join(siteLF,   f));
    const hCRLF = fileHash(path.join(siteCRLF, f));
    if (hLF !== hCRLF) diffs.push(`${f}: LF=${hLF} CRLF=${hCRLF}`);
  }
  assert.strictEqual(diffs.length, 0,
    `${diffs.length} file(s) differ between LF and CRLF runs:\n  ${diffs.join('\n  ')}`);
});

test('CRLF output files use LF line endings (never CRLF in output)', () => {
  if (!tmpCRLF) throw new Error('tmpCRLF not available (prior test failed)');
  const siteCRLF = path.join(tmpCRLF, '_bmad-output', 'knowledge-site');
  const htmlFiles = collectFiles(siteCRLF).filter(f => f.endsWith('.html'));
  assert.ok(htmlFiles.length > 0, 'must have at least one html file');
  const crlfFiles = htmlFiles.filter(f => {
    const raw = fs.readFileSync(path.join(siteCRLF, f), 'binary');
    return raw.includes('\r\n');
  });
  assert.strictEqual(crlfFiles.length, 0,
    `Output html files must use LF, but these have CRLF: ${crlfFiles.join(', ')}`);
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
