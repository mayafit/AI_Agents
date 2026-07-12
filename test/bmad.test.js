#!/usr/bin/env node
/**
 * Story 7.3 (reframed) — unit tests for current pure/testable logic of
 * lib/bmad.js.
 *
 * Background: the original Story 7.3 targeted applyCustomizations() and its
 * "6-stage pipeline". That function was REMOVED in Epic 22 (replaced by the
 * stage-and-invoke flow), so it is not testable and is intentionally NOT
 * exercised here.
 *
 * Scope (NET-NEW only — no overlap with existing suites):
 *   - isBmadInstalled() — filesystem detection in temp dirs. This function is
 *     not covered by any other test file.
 *   - public-surface smoke check — asserts the key exported entry points are
 *     functions / typed as expected. No dedicated export-shape test existed.
 *
 * Deliberately NOT re-tested here (already covered elsewhere — see comments):
 *   - buildBmadArgs           → test/build-bmad-args.test.js
 *   - resolveBmadModules,
 *     getInstallableBmadModules,
 *     getInstalledBmadModules  → test/bmad-module-selection.test.js
 *   - isOfflineModeDeclared,
 *     looksLikeOfflineFailure,
 *     looksLikeEbusyFailure,
 *     inspectBmadCache,
 *     classifyRecompileFailure → test/offline-recompile.test.js
 *
 * Constraints: pure logic + filesystem checks in os.tmpdir() only. No real
 * BMAD install, no network, no npx, no child_process. All temp dirs are
 * cleaned up in finally blocks.
 *
 * Harness: plain node + assert, matching test/build-bmad-args.test.js style.
 * Run via: node test/bmad.test.js
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, err });
  }
}

const bmad = require('../lib/bmad');

console.log('\nStory 7.3 (reframed): lib/bmad.js current-logic tests\n');

// ── isBmadInstalled() ────────────────────────────────────────────────────────
console.log('isBmadInstalled()');

test('isBmadInstalled is exported as a function', () => {
  assert.strictEqual(typeof bmad.isBmadInstalled, 'function');
});

test('returns false for a temp dir with no _bmad/ directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-isinstalled-'));
  try {
    assert.strictEqual(bmad.isBmadInstalled(tmp), false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('returns true once a _bmad/ directory exists in the project root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-isinstalled-'));
  try {
    assert.strictEqual(bmad.isBmadInstalled(tmp), false, 'precondition: not installed yet');
    fs.mkdirSync(path.join(tmp, '_bmad'));
    assert.strictEqual(bmad.isBmadInstalled(tmp), true, 'should detect the _bmad/ dir');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('detection is unaffected by sibling directories that are not _bmad/', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-isinstalled-'));
  try {
    fs.mkdirSync(path.join(tmp, '_bmad-output'));
    fs.mkdirSync(path.join(tmp, 'src'));
    // _bmad-output/ and src/ must NOT be mistaken for the _bmad/ install marker.
    assert.strictEqual(bmad.isBmadInstalled(tmp), false);
    fs.mkdirSync(path.join(tmp, '_bmad'));
    assert.strictEqual(bmad.isBmadInstalled(tmp), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('defaults projectRoot to process.cwd() when called with no argument', () => {
  // Run inside a temp dir with a _bmad/ marker, with cwd swapped to it, so the
  // default-argument branch (process.cwd()) is exercised without touching the
  // real repo. cwd is always restored in finally.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-isinstalled-cwd-'));
  const originalCwd = process.cwd();
  try {
    // fs.realpathSync normalizes the macOS/Windows symlinked tmpdir so the
    // assertion does not depend on path canonicalization differences.
    const realTmp = fs.realpathSync(tmp);
    process.chdir(realTmp);
    assert.strictEqual(bmad.isBmadInstalled(), false, 'no _bmad/ in fresh cwd');
    fs.mkdirSync(path.join(realTmp, '_bmad'));
    assert.strictEqual(bmad.isBmadInstalled(), true, 'default cwd now has _bmad/');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// ── public-surface smoke check ───────────────────────────────────────────────
//
// Asserts the key public entry points and the replacement (post-Epic-22)
// stage-and-invoke helpers are present and typed correctly, and that the
// retired applyCustomizations() function is NOT re-exported.
console.log('\npublic export surface');

test('core entry points are exported as functions', () => {
  const expectedFns = [
    'isBmadInstalled',
    'installBmad',
    'updateBmad',
    'buildBmadArgs',
    'resolveBmadModules',
    'getInstallableBmadModules',
    'getInstalledBmadModules',
    'classifyRecompileFailure',
    // Epic 22 replacement for applyCustomizations:
    'stagePlugin',
    'cleanupStage',
    // Story 30.6b — custom-marketplace subset install
    'installCustomMarketplaceSubset',
  ];
  for (const name of expectedFns) {
    assert.strictEqual(
      typeof bmad[name],
      'function',
      `expected export "${name}" to be a function, got ${typeof bmad[name]}`
    );
  }
});

test('applyCustomizations is NOT exported (removed in Epic 22)', () => {
  assert.strictEqual(
    typeof bmad.applyCustomizations,
    'undefined',
    'applyCustomizations was removed in the stage-and-invoke refactor and must not be re-exported'
  );
});

test('PLUGIN_STAGE_DIR_NAME constant is exported as a non-empty string', () => {
  assert.strictEqual(typeof bmad.PLUGIN_STAGE_DIR_NAME, 'string');
  assert.ok(bmad.PLUGIN_STAGE_DIR_NAME.length > 0, 'stage dir name must be non-empty');
});

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
