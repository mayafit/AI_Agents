#!/usr/bin/env node
/**
 * Tests for Story 22.7: Migrate Config Reads to `_bmad/bmm/config.yaml`
 *
 * Covers:
 *  - AC 1: canonical reads come from `_bmad/bmm/config.yaml`
 *  - AC 5: legacy `_bmad/_config/manifest.yaml` is never silently read
 *  - AC 6: migration shim behavior (legacy-only, both-present, neither,
 *          empty/malformed) is idempotent and never reads legacy as fallback
 *  - AC 7: regression tests lock in the new path as the sole value source
 *
 * Uses only `node:assert` + `fs-extra` — no runner dependencies beyond what
 * the rest of the ma-agents test suite already uses.
 */
'use strict';

const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs-extra');

const bmad = require('../lib/bmad.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    if (err.stack) {
      console.error(err.stack.split('\n').slice(1, 4).join('\n'));
    }
    failed++;
  }
}

// ─── Test-root scaffolding ──────────────────────────────────────────────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-22-7-'));

process.on('exit', () => {
  try {
    fs.removeSync(tmpRoot);
  } catch {
    // Non-fatal — OS will clean up /tmp eventually.
  }
});

function makeProject(label) {
  const root = path.join(tmpRoot, label);
  fs.ensureDirSync(root);
  return root;
}

function writeCanonicalConfig(projectRoot, yamlBody) {
  const configPath = path.join(projectRoot, '_bmad', 'bmm', 'config.yaml');
  fs.ensureDirSync(path.dirname(configPath));
  fs.writeFileSync(configPath, yamlBody, 'utf-8');
  return configPath;
}

function writeLegacyManifest(projectRoot, yamlBody) {
  const manifestPath = path.join(projectRoot, '_bmad', '_config', 'manifest.yaml');
  fs.ensureDirSync(path.dirname(manifestPath));
  fs.writeFileSync(manifestPath, yamlBody, 'utf-8');
  return manifestPath;
}

// ─── Exports surface ────────────────────────────────────────────────────────
console.log('\nStory 22.7 — exports surface');

test('lib/bmad.js exports readCanonicalBmadConfig', () => {
  assert.strictEqual(typeof bmad.readCanonicalBmadConfig, 'function');
});

test('lib/bmad.js exports ensureCanonicalConfigLocation', () => {
  assert.strictEqual(typeof bmad.ensureCanonicalConfigLocation, 'function');
});

test('lib/bmad.js exports CANONICAL_CONFIG_REL at _bmad/bmm/config.yaml', () => {
  // Normalize for cross-platform (path.join uses backslash on Windows).
  const normalized = bmad.CANONICAL_CONFIG_REL.replace(/\\/g, '/');
  assert.strictEqual(normalized, '_bmad/bmm/config.yaml');
});

test('lib/bmad.js exports LEGACY_MANIFEST_REL at _bmad/_config/manifest.yaml', () => {
  const normalized = bmad.LEGACY_MANIFEST_REL.replace(/\\/g, '/');
  assert.strictEqual(normalized, '_bmad/_config/manifest.yaml');
});

// ─── AC 1 + AC 7: canonical read comes from the new path ────────────────────
console.log('\nAC 1 + AC 7 — canonical config is read from _bmad/bmm/config.yaml');

test('readCanonicalBmadConfig returns parsed config from the new path', () => {
  const root = makeProject('ac1-new-path');
  writeCanonicalConfig(root, [
    'project_name: demo-new',
    'output_folder: _bmad-output',
    'planning_artifacts: custom/plan',
    ''
  ].join('\n'));

  const result = bmad.readCanonicalBmadConfig(root);
  assert.strictEqual(result.project_name, 'demo-new');
  assert.strictEqual(result.output_folder, '_bmad-output');
  assert.strictEqual(result.planning_artifacts, 'custom/plan');
});

test('readCanonicalBmadConfig returns null when the new path is absent', () => {
  const root = makeProject('ac1-absent');
  const result = bmad.readCanonicalBmadConfig(root);
  assert.strictEqual(result, null);
});

test('AC 5/7 regression — legacy manifest.yaml is IGNORED when canonical is absent', () => {
  // This is the "do not silently fall back" guarantee. When only the legacy
  // file exists, the canonical reader must NOT see its values.
  const root = makeProject('ac7-legacy-only');
  writeLegacyManifest(root, [
    'project_name: should-NOT-be-read',
    'output_folder: legacy-out',
    ''
  ].join('\n'));

  const result = bmad.readCanonicalBmadConfig(root);
  assert.strictEqual(result, null,
    'canonical reader must return null — never fall back to _bmad/_config/manifest.yaml');
});

test('AC 5/7 regression — when BOTH files exist, canonical (new) wins, legacy is ignored', () => {
  const root = makeProject('ac7-both');
  writeCanonicalConfig(root, [
    'project_name: new-wins',
    'output_folder: new/out',
    ''
  ].join('\n'));
  writeLegacyManifest(root, [
    'project_name: legacy-should-not-leak',
    'output_folder: legacy/out',
    ''
  ].join('\n'));

  const result = bmad.readCanonicalBmadConfig(root);
  assert.strictEqual(result.project_name, 'new-wins');
  assert.strictEqual(result.output_folder, 'new/out');
  assert.notStrictEqual(result.project_name, 'legacy-should-not-leak');
});

// ─── Edge cases on readCanonicalBmadConfig ──────────────────────────────────
console.log('\nEdge cases — readCanonicalBmadConfig');

test('empty canonical file parses to {} (not null)', () => {
  const root = makeProject('edge-empty');
  writeCanonicalConfig(root, '');
  const result = bmad.readCanonicalBmadConfig(root);
  assert.deepStrictEqual(result, {});
});

test('whitespace-only canonical file parses to {}', () => {
  const root = makeProject('edge-whitespace');
  writeCanonicalConfig(root, '   \n \n');
  const result = bmad.readCanonicalBmadConfig(root);
  assert.deepStrictEqual(result, {});
});

test('YAML literal `{}` parses to {}', () => {
  const root = makeProject('edge-empty-object');
  writeCanonicalConfig(root, '{}\n');
  const result = bmad.readCanonicalBmadConfig(root);
  assert.deepStrictEqual(result, {});
});

test('malformed YAML returns null and does NOT throw', () => {
  const root = makeProject('edge-malformed');
  // Unbalanced quotes / control chars — yaml.parse rejects this.
  writeCanonicalConfig(root, 'bad: "unterminated\n:key value\n');
  let thrown = null;
  let result;
  try {
    result = bmad.readCanonicalBmadConfig(root);
  } catch (err) {
    thrown = err;
  }
  assert.strictEqual(thrown, null, 'must swallow parse errors');
  assert.strictEqual(result, null, 'must return null on malformed YAML');
});

// ─── AC 6: migration shim behavior ──────────────────────────────────────────
console.log('\nAC 6 — ensureCanonicalConfigLocation (migration shim)');

test('fresh install — neither file exists → no-op (needsRegeneration=false)', () => {
  const root = makeProject('shim-fresh');
  const out = bmad.ensureCanonicalConfigLocation(root);
  assert.strictEqual(out.newExists, false);
  assert.strictEqual(out.legacyExists, false);
  assert.strictEqual(out.needsRegeneration, false);
  // Must NOT create any file as a side effect.
  assert.strictEqual(
    fs.existsSync(path.join(root, '_bmad', 'bmm', 'config.yaml')),
    false
  );
  assert.strictEqual(
    fs.existsSync(path.join(root, '_bmad', '_config', 'manifest.yaml')),
    false
  );
});

test('new path only — standard 6.3+ install → no-op (needsRegeneration=false)', () => {
  const root = makeProject('shim-new-only');
  writeCanonicalConfig(root, 'project_name: already-6-3\n');
  const out = bmad.ensureCanonicalConfigLocation(root);
  assert.strictEqual(out.newExists, true);
  assert.strictEqual(out.legacyExists, false);
  assert.strictEqual(out.needsRegeneration, false);
});

test('legacy only — old install upgrading → needsRegeneration=true, no silent read', () => {
  const root = makeProject('shim-legacy-only');
  writeLegacyManifest(root, 'modules: [bmm, bmb]\n');
  const out = bmad.ensureCanonicalConfigLocation(root);
  assert.strictEqual(out.newExists, false);
  assert.strictEqual(out.legacyExists, true);
  assert.strictEqual(out.needsRegeneration, true,
    'legacy-only state must signal regeneration (never silent fallback)');
  // Critically: the shim MUST NOT have created a new-path file by copying
  // from legacy — regeneration is bmad-method's job.
  assert.strictEqual(
    fs.existsSync(path.join(root, '_bmad', 'bmm', 'config.yaml')),
    false,
    'shim must not translate legacy → canonical in place'
  );
});

test('both files — drift state → new wins, needsRegeneration=false', () => {
  const root = makeProject('shim-both');
  writeCanonicalConfig(root, 'project_name: new-wins\n');
  writeLegacyManifest(root, 'modules: [legacy]\n');
  const out = bmad.ensureCanonicalConfigLocation(root);
  assert.strictEqual(out.newExists, true);
  assert.strictEqual(out.legacyExists, true);
  assert.strictEqual(out.needsRegeneration, false);
});

test('shim is idempotent — running twice produces the same result', () => {
  const root = makeProject('shim-idempotent');
  writeLegacyManifest(root, 'modules: [bmm]\n');
  const first = bmad.ensureCanonicalConfigLocation(root);
  const second = bmad.ensureCanonicalConfigLocation(root);
  assert.deepStrictEqual(first, second,
    'shim output must be stable across repeated invocations');
  // Still no on-disk side effect.
  assert.strictEqual(
    fs.existsSync(path.join(root, '_bmad', 'bmm', 'config.yaml')),
    false
  );
});

// ─── Cross-module AC: installer.js resolver also honors the new path ────────
console.log('\nAC 3 — installer.js resolver reads _bmad/bmm/config.yaml (already wired)');

test('installer.resolveBmadOutputDirs honors canonical path (smoke)', () => {
  // Clear any module cache on installer.js so the per-project cache inside
  // the module does not bleed across scenarios in this test.
  const installerPath = require.resolve('../lib/installer.js');
  delete require.cache[installerPath];
  const installer = require('../lib/installer.js');

  const root = makeProject('resolver-new-path');
  writeCanonicalConfig(root, [
    'planning_artifacts: custom-plan',
    'architecture_artifacts: custom-arch',
    'implementation_artifacts: custom-impl',
    ''
  ].join('\n'));
  const dirs = installer.resolveBmadOutputDirs(root);
  assert.strictEqual(dirs.planning, 'custom-plan');
  assert.strictEqual(dirs.architecture, 'custom-arch');
  assert.strictEqual(dirs.stories, 'custom-impl');
});

test('installer.resolveBmadOutputDirs does NOT read legacy manifest.yaml', () => {
  const installerPath = require.resolve('../lib/installer.js');
  delete require.cache[installerPath];
  const installer = require('../lib/installer.js');

  const root = makeProject('resolver-legacy-only');
  // Populate legacy location with values that — if silently read — would
  // surface here and fail the assertion.
  writeLegacyManifest(root, [
    'planning_artifacts: legacy-should-not-leak',
    'architecture_artifacts: legacy-arch',
    'implementation_artifacts: legacy-impl',
    ''
  ].join('\n'));

  const dirs = installer.resolveBmadOutputDirs(root);
  // Defaults must apply because the canonical file is absent — the legacy
  // file must NEVER be used as a fallback.
  assert.strictEqual(dirs.planning, '_bmad-output/planning-artifacts');
  assert.strictEqual(dirs.architecture, '_bmad-output/planning-artifacts');
  assert.strictEqual(dirs.stories, '_bmad-output/implementation-artifacts');
});

// ─── F3 Section 6: preInstallHooks invoked from all 3 entry points ──────────
console.log('\nF3 Section 6 — preInstallHooks (ensureCanonicalConfigLocation) wiring');

// Static-source assertions: we assert the call sites exist in lib/bmad.js
// rather than running a full install (which requires bmad-method to be
// network-installable and a writable workspace). The risk this guards
// against is regression — a future refactor that removes the call from
// updateBmad() or runMigration() must not silently land.
const bmadSrc = fs.readFileSync(
  path.join(__dirname, '..', 'lib', 'bmad.js'),
  'utf-8'
);

/**
 * Extract the body of a function declaration from `bmadSrc`, bounded by the
 * function's start and the next top-level function declaration (or end of
 * file). Earlier revisions used a fixed-size slice (e.g. 4000 chars), which
 * could either run past the function and match a later one's body, or run
 * short and miss the call site as the function grows.
 *
 * Code-review fix (Blind Hunter B10/B15) — bound the slice deterministically.
 *
 * @param {string} src - Full source of lib/bmad.js
 * @param {RegExp} signatureRegex - Matches the function declaration line
 *   (e.g. /async function installBmad\(/)
 * @returns {string} The slice from the matched declaration to the next
 *   top-level function declaration (or end of file).
 * @throws {Error} when the signature is not found.
 */
function extractFunctionBody(src, signatureRegex) {
  const match = signatureRegex.exec(src);
  if (!match) {
    throw new Error(`signature not found: ${signatureRegex}`);
  }
  const start = match.index;
  // Find the next top-level function declaration AFTER the start. Top-level
  // means a line that begins with 'function ' or 'async function ' — JSDoc
  // comments and block strings won't match because the regex anchors the
  // line via the leading newline.
  const nextDecl = /\n(?:async )?function [A-Za-z_$][\w$]*\(/g;
  nextDecl.lastIndex = start + match[0].length;
  const next = nextDecl.exec(src);
  const end = next ? next.index : src.length;
  return src.slice(start, end);
}

test('lib/bmad.js declares preInstallHooks helper (F3 #6)', () => {
  assert.ok(/function preInstallHooks\(projectRoot\)/.test(bmadSrc),
    'lib/bmad.js must declare preInstallHooks(projectRoot) helper');
  const helperSlice = extractFunctionBody(bmadSrc, /function preInstallHooks\(projectRoot\)/);
  assert.ok(/ensureCanonicalConfigLocation\(projectRoot\)/.test(helperSlice),
    'preInstallHooks must invoke ensureCanonicalConfigLocation');
});

test('installBmad invokes preInstallHooks (F3 #6)', () => {
  const slice = extractFunctionBody(bmadSrc, /async function installBmad\(/);
  assert.ok(/preInstallHooks\(projectRoot\)/.test(slice),
    'installBmad must invoke preInstallHooks(projectRoot)');
});

test('updateBmad invokes preInstallHooks (F3 #6)', () => {
  const slice = extractFunctionBody(bmadSrc, /async function updateBmad\(/);
  assert.ok(/preInstallHooks\(projectRoot\)/.test(slice),
    'updateBmad must invoke preInstallHooks(projectRoot) — F3 Section 6');
});

test('runMigration invokes preInstallHooks (F3 #6)', () => {
  const slice = extractFunctionBody(bmadSrc, /async function runMigration\(/);
  assert.ok(/preInstallHooks\(projectRoot\)/.test(slice),
    'runMigration must invoke preInstallHooks(projectRoot) — F3 Section 6');
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
