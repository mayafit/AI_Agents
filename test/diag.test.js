#!/usr/bin/env node
/**
 * Tests for lib/diag.js — log-file-only diagnostics.
 *
 * Guarantees: no-op without a sink (never touches the console); with a sink,
 * diag() emits label[+detail] and diagError() emits the error's message, stack,
 * AND any wrapped `cause` (message + stack) — the bit that surfaces the root
 * cause of a custom-marketplace failure that the wizard hides from the user.
 */
'use strict';

const assert = require('assert');
const { setLogSink, isActive, diag, diagError } = require('../lib/diag');

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
    errors.push({ name, error: err.message });
  } finally {
    setLogSink(null); // always reset between tests
  }
}

console.log('\nlib/diag.js');

test('no-op without a sink (isActive false, nothing emitted)', () => {
  setLogSink(null);
  assert.strictEqual(isActive(), false);
  // Must not throw and must produce nothing observable.
  diag('should-not-appear', { x: 1 });
  diagError('should-not-appear', new Error('nope'));
});

test('diag writes label with no detail', () => {
  let out = '';
  setLogSink((s) => { out += s; });
  assert.strictEqual(isActive(), true);
  diag('phase-one');
  assert.ok(/\[diag .*\] phase-one\n$/.test(out), `unexpected: ${JSON.stringify(out)}`);
});

test('diag serializes an object detail as JSON', () => {
  let out = '';
  setLogSink((s) => { out += s; });
  diag('enumerated', { mode: 'registry', codes: ['a', 'b'] });
  assert.ok(out.includes('enumerated: {"mode":"registry","codes":["a","b"]}'), out);
});

test('diagError emits message + stack + wrapped cause (message + stack)', () => {
  let out = '';
  setLogSink((s) => { out += s; });
  const root = new Error('git clone failed: repository not found');
  const wrapped = new Error('Could not clone registry entry');
  wrapped.cause = root;
  diagError('custom-source: install failed', wrapped);
  assert.ok(out.includes('custom-source: install failed: Could not clone registry entry'), 'top message');
  assert.ok(out.includes('stack:'), 'includes stack');
  assert.ok(out.includes('cause: git clone failed: repository not found'), 'includes cause message');
  assert.ok(out.includes('cause.stack:'), 'includes cause stack');
});

test('diagError without a cause still emits message + stack', () => {
  let out = '';
  setLogSink((s) => { out += s; });
  diagError('plain', new Error('boom'));
  assert.ok(out.includes('plain: boom'));
  assert.ok(out.includes('stack:'));
  assert.ok(!out.includes('cause:'));
});

test('a throwing sink never propagates (diagnostics must not break the install)', () => {
  setLogSink(() => { throw new Error('disk full'); });
  assert.doesNotThrow(() => diag('x', { y: 1 }));
  assert.doesNotThrow(() => diagError('x', new Error('z')));
});

console.log(`\n--- Results: ${passed} passed, ${failed} failed ---`);
if (errors.length > 0) {
  console.error('\nFailures:');
  for (const { name, error } of errors) console.error(`  ${name}: ${error}`);
}
process.exit(failed > 0 ? 1 : 0);
