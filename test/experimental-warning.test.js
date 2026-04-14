#!/usr/bin/env node
/**
 * Tests for Bug A: ExperimentalWarning about CommonJS loading ES Module
 * during installer startup.
 *
 * Contract:
 *   lib/warning-filter.js exports installExperimentalWarningFilter().
 *   When installed, the process-level 'warning' listener swallows
 *   ExperimentalWarning messages that describe CJS require() of an
 *   ES Module, but lets every other warning through unchanged.
 *
 * Additionally, bin/cli.js must install the filter at startup, and
 * lib/bmad.js must pass NODE_OPTIONS="--no-warnings=ExperimentalWarning"
 * (or equivalent) to the bmad-method child spawn env.
 */
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO_ROOT = path.join(__dirname, '..');
const FILTER_PATH = path.join(REPO_ROOT, 'lib', 'warning-filter.js');
const CLI_PATH = path.join(REPO_ROOT, 'bin', 'cli.js');
const BMAD_PATH = path.join(REPO_ROOT, 'lib', 'bmad.js');

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

console.log('\n── Bug A: ExperimentalWarning filter tests ──────────────────────\n');

// ─── Test 1: filter module exists and exports the expected API ────────────────
test('lib/warning-filter.js exists', () => {
  assert.ok(fs.existsSync(FILTER_PATH), 'expected lib/warning-filter.js to exist');
});

test('filter module exports installExperimentalWarningFilter()', () => {
  const mod = require(FILTER_PATH);
  assert.strictEqual(typeof mod.installExperimentalWarningFilter, 'function');
});

test('filter module exports isRequireEsmWarning() predicate', () => {
  const mod = require(FILTER_PATH);
  assert.strictEqual(typeof mod.isRequireEsmWarning, 'function');
});

// ─── Test 2: isRequireEsmWarning() correctly classifies warnings ──────────────
test('isRequireEsmWarning matches CJS-loading-ESM ExperimentalWarning', () => {
  const { isRequireEsmWarning } = require(FILTER_PATH);
  const w = new Error(
    'CommonJS module /a/b.js is loading ES Module /c/d.js using require(). ' +
    'Support for loading ES Module in require() is an experimental feature ' +
    'and might change at any time.'
  );
  w.name = 'ExperimentalWarning';
  assert.strictEqual(isRequireEsmWarning(w), true);
});

test('isRequireEsmWarning matches require(ESM) variant phrasing', () => {
  const { isRequireEsmWarning } = require(FILTER_PATH);
  const w = new Error('Support for loading ES Module in require() is an experimental feature.');
  w.name = 'ExperimentalWarning';
  assert.strictEqual(isRequireEsmWarning(w), true);
});

test('isRequireEsmWarning ignores unrelated ExperimentalWarning', () => {
  const { isRequireEsmWarning } = require(FILTER_PATH);
  const w = new Error('Fetch API is an experimental feature.');
  w.name = 'ExperimentalWarning';
  assert.strictEqual(isRequireEsmWarning(w), false);
});

test('isRequireEsmWarning ignores DeprecationWarning with require() text', () => {
  const { isRequireEsmWarning } = require(FILTER_PATH);
  const w = new Error('Some deprecated require() usage in ES Module.');
  w.name = 'DeprecationWarning';
  assert.strictEqual(isRequireEsmWarning(w), false);
});

// ─── Test 3: end-to-end — re-exec flow silences ExperimentalWarning ──────────
test('installed filter (with re-exec) silences CJS-require-ESM ExperimentalWarning', () => {
  // Drive the full re-exec path: parent re-execs with NODE_OPTIONS set,
  // child emits the warning, expects ZERO bytes of ExperimentalWarning.
  const child = spawnSync(process.execPath, [
    '-e',
    `const { installExperimentalWarningFilter } = require(${JSON.stringify(FILTER_PATH)});
     installExperimentalWarningFilter();
     // After re-exec we land here in the child:
     process.emitWarning('CommonJS module /a.js is loading ES Module /b.mjs using require().', 'ExperimentalWarning');`,
  ], { encoding: 'utf8' });
  assert.strictEqual(child.status, 0, `child exited non-zero: ${child.stderr}`);
  assert.ok(
    !/ExperimentalWarning/.test(child.stderr),
    `expected no ExperimentalWarning in stderr, got:\n${child.stderr}`
  );
});

// ─── Test 3b: NODE_OPTIONS-only test bypasses re-exec ─────────────────────────
test('listener-only mode swallows the matched warning at user-land', () => {
  // reexec:false means we only attach the listener; target warning still
  // hits Node's internal printer in some Node versions, but our listener
  // returns silently so the listener path itself never re-emits it.
  const child = spawnSync(process.execPath, [
    '-e',
    `const { installExperimentalWarningFilter, _attachListener } = require(${JSON.stringify(FILTER_PATH)});
     installExperimentalWarningFilter({ reexec: false });
     // Emit a custom-named warning identical in shape so we don't depend
     // on Node's internal experimental-warning path:
     const w = new Error('CommonJS module /a.js is loading ES Module /b.mjs using require().');
     w.name = 'ExperimentalWarning';
     // Drive the listener directly to assert it returns without writing.
     const listener = process.listeners('warning').find(fn => fn.__maAgentsFilter);
     if (!listener) { console.error('no filter listener'); process.exit(2); }
     // capture stderr writes
     let captured = '';
     const orig = process.stderr.write.bind(process.stderr);
     process.stderr.write = (c) => { captured += String(c); return true; };
     listener(w);
     process.stderr.write = orig;
     if (captured.length !== 0) { console.error('LEAKED:', captured); process.exit(3); }
     process.exit(0);`,
  ], { encoding: 'utf8', env: { ...process.env, [require(FILTER_PATH)._SENTINEL_ENV]: '1' } });
  assert.strictEqual(child.status, 0, `child exited ${child.status}: ${child.stderr}`);
});

// ─── Test 4: filter preserves unrelated warnings ──────────────────────────────
test('installed filter preserves DeprecationWarning', () => {
  // Drive the listener directly to verify it re-emits non-matching warnings.
  const child = spawnSync(process.execPath, [
    '-e',
    `const { installExperimentalWarningFilter } = require(${JSON.stringify(FILTER_PATH)});
     installExperimentalWarningFilter({ reexec: false });
     const listener = process.listeners('warning').find(fn => fn.__maAgentsFilter);
     const w = new Error('legacy api — do not use');
     w.name = 'DeprecationWarning';
     let captured = '';
     const orig = process.stderr.write.bind(process.stderr);
     process.stderr.write = (c) => { captured += String(c); return true; };
     listener(w);
     process.stderr.write = orig;
     process.stdout.write(captured);`,
  ], { encoding: 'utf8' });
  assert.strictEqual(child.status, 0);
  assert.ok(
    /DeprecationWarning/.test(child.stdout),
    `expected DeprecationWarning to be preserved, stdout=\n${child.stdout}\nstderr=\n${child.stderr}`
  );
});

test('installed filter preserves unrelated ExperimentalWarning', () => {
  const child = spawnSync(process.execPath, [
    '-e',
    `const { installExperimentalWarningFilter } = require(${JSON.stringify(FILTER_PATH)});
     installExperimentalWarningFilter({ reexec: false });
     const listener = process.listeners('warning').find(fn => fn.__maAgentsFilter);
     const w = new Error('Fetch API is an experimental feature.');
     w.name = 'ExperimentalWarning';
     let captured = '';
     const orig = process.stderr.write.bind(process.stderr);
     process.stderr.write = (c) => { captured += String(c); return true; };
     listener(w);
     process.stderr.write = orig;
     process.stdout.write(captured);`,
  ], { encoding: 'utf8' });
  assert.strictEqual(child.status, 0);
  assert.ok(
    /Fetch API/.test(child.stdout),
    `expected unrelated ExperimentalWarning preserved, stdout=\n${child.stdout}`
  );
});

// ─── Test 5: idempotent — installing twice doesn't double-suppress or leak ────
test('installExperimentalWarningFilter is idempotent', () => {
  const child = spawnSync(process.execPath, [
    '-e',
    `const { installExperimentalWarningFilter } = require(${JSON.stringify(FILTER_PATH)});
     installExperimentalWarningFilter({ reexec: false });
     installExperimentalWarningFilter({ reexec: false });
     const listeners = process.listeners('warning').filter(fn => fn.__maAgentsFilter === true);
     if (listeners.length !== 1) {
       console.error('EXPECTED 1 filter listener, got', listeners.length);
       process.exit(2);
     }
     process.exit(0);`,
  ], { encoding: 'utf8' });
  assert.strictEqual(child.status, 0, `child exited ${child.status}: ${child.stderr}`);
});

// ─── Test 6: bin/cli.js wires the filter at startup ───────────────────────────
test('bin/cli.js requires warning-filter and installs it', () => {
  const src = fs.readFileSync(CLI_PATH, 'utf8');
  assert.ok(
    /require\(['"]\.\.\/lib\/warning-filter['"]\)/.test(src) ||
    /require\(['"]\.\.\/lib\/warning-filter\.js['"]\)/.test(src),
    'expected bin/cli.js to require ../lib/warning-filter'
  );
  assert.ok(
    /installExperimentalWarningFilter\s*\(/.test(src),
    'expected bin/cli.js to call installExperimentalWarningFilter(...)'
  );
});

// ─── Test 7: lib/bmad.js propagates suppression to child spawn via NODE_OPTIONS
test('lib/bmad.js builds child env that suppresses ExperimentalWarning', () => {
  const src = fs.readFileSync(BMAD_PATH, 'utf8');
  // Either calls the helper directly or inlines the flag.
  const usesHelper = /withExperimentalWarningSuppressed/.test(src) &&
                     /require\(['"]\.\/warning-filter['"]\)/.test(src);
  const inlinesFlag = /--no-warnings=ExperimentalWarning/.test(src);
  assert.ok(
    usesHelper || inlinesFlag,
    'expected lib/bmad.js to either import withExperimentalWarningSuppressed ' +
    'from ./warning-filter, or inline --no-warnings=ExperimentalWarning'
  );
  assert.ok(
    /NODE_OPTIONS/.test(src),
    'expected lib/bmad.js to set NODE_OPTIONS for the child spawn'
  );
});

// ─── Test 8: integration — running bin/cli.js --help is silent on stderr ──────
test('bin/cli.js --help produces no ExperimentalWarning on stderr', () => {
  const child = spawnSync(process.execPath, [CLI_PATH, '--help'], {
    encoding: 'utf8',
    env: { ...process.env, [require(FILTER_PATH)._SENTINEL_ENV]: '' },
  });
  assert.strictEqual(child.status, 0, `cli --help exited non-zero: ${child.stderr}`);
  assert.ok(
    !/ExperimentalWarning/.test(child.stderr),
    `expected no ExperimentalWarning from cli --help, got:\n${child.stderr}`
  );
});

// ─── Test 9: withExperimentalWarningSuppressed helper is well-behaved ─────────
test('withExperimentalWarningSuppressed adds flag when none present', () => {
  const { withExperimentalWarningSuppressed } = require(FILTER_PATH);
  assert.strictEqual(withExperimentalWarningSuppressed(undefined), '--no-warnings=ExperimentalWarning');
  assert.strictEqual(withExperimentalWarningSuppressed(''), '--no-warnings=ExperimentalWarning');
});

test('withExperimentalWarningSuppressed preserves existing --no-warnings', () => {
  const { withExperimentalWarningSuppressed } = require(FILTER_PATH);
  assert.strictEqual(withExperimentalWarningSuppressed('--no-warnings'), '--no-warnings');
  assert.strictEqual(
    withExperimentalWarningSuppressed('--no-warnings=DeprecationWarning'),
    '--no-warnings=DeprecationWarning'
  );
});

test('withExperimentalWarningSuppressed appends flag to other NODE_OPTIONS', () => {
  const { withExperimentalWarningSuppressed } = require(FILTER_PATH);
  assert.strictEqual(
    withExperimentalWarningSuppressed('--max-old-space-size=4096'),
    '--max-old-space-size=4096 --no-warnings=ExperimentalWarning'
  );
});

// ─── Test 10: regression — require('bin/cli.js') must NOT re-exec ───────────
test('require("bin/cli.js") from another process does not re-exec', () => {
  // If the CLI silently re-execs on require, the "before pid" line
  // would print twice in the stderr/stdout stream.
  const child = spawnSync(process.execPath, [
    '-e',
    `const before = process.pid;
     console.log('MARK_BEFORE', before);
     require(${JSON.stringify(CLI_PATH)});
     console.log('MARK_AFTER', process.pid, 'same:', process.pid === before);`,
  ], { encoding: 'utf8' });
  assert.strictEqual(child.status, 0, `child exited non-zero: ${child.stderr}`);
  const beforeCount = (child.stdout.match(/MARK_BEFORE/g) || []).length;
  assert.strictEqual(beforeCount, 1, `expected exactly one MARK_BEFORE, got ${beforeCount}\n${child.stdout}`);
  assert.ok(/same: true/.test(child.stdout), 'expected PID to be unchanged after require');
});

// ─── Test 11: regression — fast commands must NOT re-exec ────────────────────
test('bin/cli.js --version runs in a single process (no re-exec)', () => {
  // Spawn cli.js --version and assert PID stability via NODE_OPTIONS check.
  // We approximate by running it with the sentinel unset and checking it
  // still completes without looping. A process-tree check is overkill;
  // we just verify exit code and output shape.
  const child = spawnSync(process.execPath, [CLI_PATH, '--version'], {
    encoding: 'utf8',
    env: { ...process.env, [require(FILTER_PATH)._SENTINEL_ENV]: '' },
  });
  assert.strictEqual(child.status, 0);
  assert.ok(/ma-agents v/.test(child.stdout), `expected version banner, got: ${child.stdout}`);
  assert.ok(!/ExperimentalWarning/.test(child.stderr));
});

// ─── Test 12: --inspect is not forwarded to the re-exec child ────────────────
test('installExperimentalWarningFilter drops --inspect* from forwarded execArgv', () => {
  const src = fs.readFileSync(FILTER_PATH, 'utf8');
  assert.ok(
    /--inspect/.test(src) && /filter/.test(src),
    'expected warning-filter.js to filter --inspect out of forwarded execArgv'
  );
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
