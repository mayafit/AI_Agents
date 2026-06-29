#!/usr/bin/env node
/**
 * scripts/build-atlas.js
 * ---------------------------------------------------------------------------
 * Story 29.1 — Build script for the Knowledge Atlas engine bundle.
 *
 * Purpose:
 *   Bundle the TypeScript engine at `lib/knowledge-atlas/src/cli.ts` into a
 *   single committed CJS artifact `lib/knowledge-atlas/dist/atlas.cjs` via
 *   esbuild. The bundle is committed to the repo so consuming projects NEVER
 *   run `npm install` for the Atlas — the engine and its dependencies are
 *   vendored inside the ma-agents distribution (FR215, FR230, NFR61, NFR67).
 *
 * Contract:
 *   Input  : lib/knowledge-atlas/src/cli.ts
 *   Output : lib/knowledge-atlas/dist/atlas.cjs  (committed build artifact)
 *
 * esbuild options:
 *   bundle   : true    — inline all imports into the single output file
 *   platform : node    — Node.js built-ins (fs, path, …) are external by default
 *   format   : cjs     — CommonJS so `node atlas.cjs` works without --experimental-vm-modules
 *   target   : node18  — minimum supported Node runtime
 *   minify   : false   — keep diff-able (same discipline as build-plugin.js)
 *   sourcemap: false   — no source map in the shipped bundle
 *
 * Determinism (NFR62):
 *   - All paths are anchored to REPO_ROOT, not process.cwd().
 *   - esbuild output is deterministic for identical inputs.
 *   - LF line endings are enforced on the output file.
 *
 * Usage:
 *   node scripts/build-atlas.js            # bundle
 *   node scripts/build-atlas.js --verify   # bundle + print SHA-256
 *
 * Exit codes:
 *   0 — success
 *   1 — any error (missing source, build failure, I/O error)
 *
 * Dependencies:
 *   Node built-ins: fs, path, crypto
 *   devDependency:  esbuild (build-time only — never shipped to the consumer)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ──────────────────────────────────────────────────────────────────────────
// Paths — always anchored to the repo root, NOT process.cwd().
// ──────────────────────────────────────────────────────────────────────────
const REPO_ROOT = path.resolve(__dirname, '..');
const SRC_ENTRY = path.join(REPO_ROOT, 'lib', 'knowledge-atlas', 'src', 'cli.ts');
const OUT_DIR   = path.join(REPO_ROOT, 'lib', 'knowledge-atlas', 'dist');
const OUT_FILE  = path.join(OUT_DIR, 'atlas.cjs');
const TSCONFIG  = path.join(REPO_ROOT, 'lib', 'knowledge-atlas', 'tsconfig.json');

// ──────────────────────────────────────────────────────────────────────────
// Logging helpers — progress to stderr (keeps stdout silent for npm pack).
// ──────────────────────────────────────────────────────────────────────────
function info(msg) {
  process.stderr.write(`[build-atlas] ${msg}\n`);
}

function fail(msg, detail) {
  process.stderr.write(`[build-atlas] ERROR: ${msg}\n`);
  if (detail) process.stderr.write(`[build-atlas]        ${detail}\n`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// Fail-fast: required sources must exist before we invoke esbuild.
// ──────────────────────────────────────────────────────────────────────────
function assertRequiredSources() {
  if (!fs.existsSync(SRC_ENTRY)) {
    fail('missing required source entry point', SRC_ENTRY);
  }
  if (!fs.existsSync(TSCONFIG)) {
    fail('missing tsconfig.json', TSCONFIG);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Safety: refuse to write outside lib/knowledge-atlas/dist/.
// ──────────────────────────────────────────────────────────────────────────
function ensureOutputSafety() {
  const normalized = path.normalize(OUT_DIR);
  const expectedSuffix = path.join('lib', 'knowledge-atlas', 'dist');
  if (!normalized.endsWith(expectedSuffix)) {
    fail('refusing to write to unexpected output path', normalized);
  }
  const rel = path.relative(REPO_ROOT, normalized);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    fail('output path escapes repo root', normalized);
  }
}

// ──────────────────────────────────────────────────────────────────────────
// LF normalization — enforce LF line endings on the output file.
// esbuild output is already mostly LF on all platforms, but normalize
// defensively to guarantee byte-identical output on Windows (NFR62).
// ──────────────────────────────────────────────────────────────────────────
function normalizeLf(contents) {
  // esbuild's write:false returns a Uint8Array. Convert to Buffer first so
  // that Buffer.toString('utf8') decodes bytes correctly (Uint8Array.toString()
  // would give comma-separated decimal numbers, not the JS string).
  const buf = Buffer.isBuffer(contents) ? contents : Buffer.from(contents);
  const str = buf.toString('utf8');
  const lf = str.replace(/\r\n/g, '\n');
  return Buffer.from(lf, 'utf8');
}

// ──────────────────────────────────────────────────────────────────────────
// SHA-256 of a file — used for --verify and drift assertions.
// ──────────────────────────────────────────────────────────────────────────
function fileHash(filePath) {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ──────────────────────────────────────────────────────────────────────────
// Entry point.
// ──────────────────────────────────────────────────────────────────────────
async function main() {
  const verify = process.argv.includes('--verify');

  info(`entry  : ${path.relative(REPO_ROOT, SRC_ENTRY)}`);
  info(`output : ${path.relative(REPO_ROOT, OUT_FILE)}`);

  assertRequiredSources();
  ensureOutputSafety();

  // Load esbuild — it's a devDependency so must be installed before build.
  let esbuild;
  try {
    esbuild = require('esbuild');
  } catch (err) {
    fail(
      'esbuild not found — run `npm install` first',
      err.message,
    );
  }

  // Ensure the output directory exists.
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Run esbuild to produce the bundle.
  let result;
  try {
    result = await esbuild.build({
      entryPoints: [SRC_ENTRY],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      target: 'node18',
      minify: false,
      sourcemap: false,
      write: false,  // capture output in memory so we can normalize LF
      logLevel: 'warning',
    });
  } catch (err) {
    fail('esbuild failed', err.message || String(err));
  }

  if (!result || !result.outputFiles || result.outputFiles.length === 0) {
    fail('esbuild produced no output');
  }

  // Normalize LF and write atomically (temp → rename) to prevent half-written
  // output if the process is killed mid-run.
  const bundleBuf = normalizeLf(result.outputFiles[0].contents);
  const tmpPath = OUT_FILE + `.build-${process.pid}-${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, bundleBuf, { mode: 0o644 });
    if (fs.existsSync(OUT_FILE)) fs.unlinkSync(OUT_FILE);
    fs.renameSync(tmpPath, OUT_FILE);
  } catch (err) {
    // Best-effort cleanup
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch { /* swallow */ }
    fail('failed to write bundle', err.message);
  }

  info(`bundle written (${bundleBuf.length} bytes)`);

  if (verify) {
    const digest = fileHash(OUT_FILE);
    info(`sha256 : ${digest}`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    fail('unhandled exception', err && err.stack ? err.stack : String(err));
  });
}

module.exports = {
  REPO_ROOT,
  SRC_ENTRY,
  OUT_DIR,
  OUT_FILE,
  fileHash,
  normalizeLf,
};
