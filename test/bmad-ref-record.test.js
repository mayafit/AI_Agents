#!/usr/bin/env node
/**
 * Story 36.3 — the `package.json` `bmadRef` record (AC1; FR280, FR302) and the
 * Node engines floor (AC6; FR298).
 *
 *   AC1  `bmadRef` holds exactly core / skillsCli / tea / cis / extensions:
 *        `core` a full 40-hex commit (a branch or tag name fails), `skillsCli` an
 *        exact SemVer version (a range fails), `tea` / `cis` / `extensions` a
 *        release tag `v<semver>` or empty (`extensions` stays empty until Story
 *        39.1 bundles `ma-bmad-extensions`). The builder refuses the same records.
 *   AC6  `engines.node` is not looser than the floor the bundled Skills CLI
 *        declares, read from `bundle/skills-cli/package.json` (or the manifest's
 *        recorded value) — never from a literal here. Skipped with the reason when
 *        no bundle is on disk; the comparison itself is exercised on every run.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { validateBmadRef } = require('../lib/bundle');

const projectRoot = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

let passed = 0;
let failed = 0;
let skipped = 0;
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

function skip(name, reason) {
  console.log(`  - SKIP ${name}: ${reason}`);
  skipped++;
}

// The record's rules, stated here independently of lib/bundle.js.
const isCommit = (v) => typeof v === 'string' && /^[0-9a-f]{40}$/.test(v);
const isExactVersion = (v) => typeof v === 'string'
  && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/.test(v);
const isTag = (v) => typeof v === 'string' && /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/.test(v);
const isTagOrEmpty = (v) => v === '' || isTag(v);

function recordProblems(ref) {
  const p = [];
  if (!ref || typeof ref !== 'object') return ['bmadRef missing'];
  const keys = Object.keys(ref).sort();
  if (JSON.stringify(keys) !== JSON.stringify(['cis', 'core', 'extensions', 'skillsCli', 'tea'])) p.push(`keys ${keys}`);
  if (!isCommit(ref.core)) p.push(`core ${ref.core}`);
  if (!isExactVersion(ref.skillsCli)) p.push(`skillsCli ${ref.skillsCli}`);
  for (const k of ['tea', 'cis', 'extensions']) if (!isTagOrEmpty(ref[k])) p.push(`${k} ${ref[k]}`);
  return p;
}

// `>=X.Y.Z` → [X, Y, Z]; anything else is not a floor this check can compare.
function floorOf(range) {
  const m = /^\s*>=\s*(\d+)\.(\d+)\.(\d+)\s*$/.exec(String(range || ''));
  if (!m) throw new Error(`engines range ${JSON.stringify(range)} is not of the form >=X.Y.Z`);
  return m.slice(1).map(Number);
}

/** True when `ours` admits no Node version that `floor` rejects. */
function notLooser(ours, floor) {
  const a = floorOf(ours);
  const b = floorOf(floor);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return true;
}

console.log('\nStory 36.3: bmadRef record (AC1) and Node engines (AC6)\n');

// ─── AC1 ─────────────────────────────────────────────────────────────────────
console.log('AC1: bmadRef is the single source');

test('package.json bmadRef is a valid record', () => {
  assert.deepStrictEqual(recordProblems(pkg.bmadRef), []);
});

test('the builder accepts the package.json record', () => {
  assert.deepStrictEqual(validateBmadRef(pkg.bmadRef), []);
});

const NEGATIVES = [
  ['core as a branch name', { core: 'main' }],
  ['core as a tag name', { core: 'v6.13.0' }],
  ['core as a short sha', { core: 'e734d3a' }],
  ['core in upper case', { core: 'E734D3AC3C0F4EA31CC2C2BBBE79E86E54F2CAE6' }],
  ['skillsCli as a caret range', { skillsCli: '^1.7.6' }],
  ['skillsCli as a tilde range', { skillsCli: '~1.7.6' }],
  ['skillsCli as latest', { skillsCli: 'latest' }],
  ['tea as a branch', { tea: 'main' }],
  ['tea without the v', { tea: '4.0.1' }],
  ['cis as a branch', { cis: 'main' }],
  ['extensions as a branch', { extensions: 'main' }],
  ['an extra key', { channel: 'next' }],
];

for (const [label, patch] of NEGATIVES) {
  test(`rejected by the test and by the builder: ${label}`, () => {
    const ref = { ...pkg.bmadRef, ...patch };
    assert.notDeepStrictEqual(recordProblems(ref), [], 'the test accepted it');
    assert.notDeepStrictEqual(validateBmadRef(ref), [], 'the builder accepted it');
  });
}

test('a missing key is rejected by the builder', () => {
  const { cis, ...ref } = pkg.bmadRef; // eslint-disable-line no-unused-vars
  assert.ok(validateBmadRef(ref).some((p) => p.includes('bmadRef.cis is missing')));
});

// ─── AC6 ─────────────────────────────────────────────────────────────────────
console.log('\nAC6: engines.node is not looser than the bundled Skills CLI floor');

test('comparison: equal floors pass, a lower floor fails, a higher floor passes, a non->= range is refused', () => {
  assert.strictEqual(notLooser('>=22.20.0', '>=22.20.0'), true);
  assert.strictEqual(notLooser('>=22.0.0', '>=22.20.0'), false);
  assert.strictEqual(notLooser('>=16.0.0', '>=22.20.0'), false);
  assert.strictEqual(notLooser('>=22.20.1', '>=22.20.0'), true);
  assert.strictEqual(notLooser('>=24.0.0', '>=22.20.0'), true);
  assert.throws(() => notLooser('^22.20.0', '>=22.20.0'), /not of the form/);
});

const bundleDir = process.env.MA_BUNDLE_DIR || path.join(projectRoot, 'bundle');
const cliPkgPath = path.join(bundleDir, 'skills-cli', 'package.json');
const manifestPath = path.join(bundleDir, 'manifest.json');
let floor = null;
let floorSource = null;
if (fs.existsSync(cliPkgPath)) {
  const cli = JSON.parse(fs.readFileSync(cliPkgPath, 'utf8'));
  floor = cli.engines && cli.engines.node;
  floorSource = `${path.relative(projectRoot, cliPkgPath)} (skills@${cli.version})`;
} else if (fs.existsSync(manifestPath)) {
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  floor = m.skillsCli && m.skillsCli.enginesNode;
  floorSource = `${path.relative(projectRoot, manifestPath)} skillsCli.enginesNode`;
}

if (!floor) {
  skip('engines.node against the bundled Skills CLI floor', `no bundle at ${bundleDir} (run \`ma-agents bundle build\`; the 36.6 CI job builds it)`);
} else {
  console.log(`    floor ${floor} from ${floorSource}`);
  test(`package.json engines.node ${pkg.engines && pkg.engines.node} is not looser than the Skills CLI floor`, () => {
    assert.ok(notLooser(pkg.engines.node, floor), `engines.node ${pkg.engines.node} admits Node versions below ${floor}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
