#!/usr/bin/env node
/**
 * Tests for create-agent command implementation
 * Story 3.5: Specialized Agent Development Tooling
 *
 * Task 6.1: create-agent bmm-test-role runs and creates scaffold file
 * Task 6.2: Duplicate agent rejected with error
 * Task 6.3: Auto-prefix bmm- if missing
 * Task 6.4: Generated YAML is valid structure
 */
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const PROJECT_ROOT = path.join(__dirname, '..');
const AGENTS_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension', 'agents');

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
    failed++; errors.push({ name, error: err.message });
  }
}

// ─── Module imports ──────────────────────────────────────────────────────────
let validateAgentName, createBmadAgent;
try {
  ({ validateAgentName, createBmadAgent } = require('../lib/skill-authoring'));
} catch (e) {
  console.error('\n  FATAL: Cannot load skill-authoring module');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Unit tests: validateAgentName() ─────────────────────────────────────────
console.log('\n validateAgentName unit tests\n');

test('validates bmm-prefixed kebab-case name', () => {
  const result = validateAgentName('bmm-test-role');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.name, 'bmm-test-role');
  assert.strictEqual(result.normalized, false);
});

test('auto-prefixes bmm- if missing', () => {
  const result = validateAgentName('test-role');
  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.name, 'bmm-test-role');
  assert.strictEqual(result.normalized, true);
});

test('rejects empty name', () => {
  const result = validateAgentName('');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.length > 0);
});

test('rejects uppercase in name', () => {
  const result = validateAgentName('bmm-TEST-role');
  assert.strictEqual(result.valid, false);
});

test('rejects name ending with hyphen', () => {
  const result = validateAgentName('bmm-test-');
  assert.strictEqual(result.valid, false);
});

test('rejects existing builtin agent name', () => {
  const result = validateAgentName('bmm-pm');
  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('already exists') || result.hint);
});

test('rejects existing custom agent name', () => {
  const result = validateAgentName('bmm-sre');
  assert.strictEqual(result.valid, false);
});

// ─── Unit tests: createBmadAgent() ───────────────────────────────────────────
console.log('\n createBmadAgent unit tests\n');

test('createBmadAgent: creates .customize.yaml in agentsDir', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-create-agent-'));
  try {
    const result = createBmadAgent('bmm-test-role', tmpDir);
    assert.strictEqual(result.success, true, `Expected success: ${result.error}`);
    const filePath = path.join(tmpDir, 'bmm-test-role.customize.yaml');
    assert.ok(fs.existsSync(filePath), 'Expected file to be created');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createBmadAgent: generated file includes persona section', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-create-agent-'));
  try {
    createBmadAgent('bmm-test-role', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'bmm-test-role.customize.yaml'), 'utf8');
    assert.ok(content.includes('persona:'), 'Expected persona section');
    assert.ok(content.includes('role:'), 'Expected role field');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createBmadAgent: generated file includes menu section', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-create-agent-'));
  try {
    createBmadAgent('bmm-test-role', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'bmm-test-role.customize.yaml'), 'utf8');
    assert.ok(content.includes('menu:'), 'Expected menu section');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createBmadAgent: generated file includes mandatory critical_actions 1-3', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-create-agent-'));
  try {
    createBmadAgent('bmm-test-role', tmpDir);
    const content = fs.readFileSync(path.join(tmpDir, 'bmm-test-role.customize.yaml'), 'utf8');
    assert.ok(content.includes('critical_actions:'), 'Expected critical_actions section');
    assert.ok(content.includes('MANIFEST'), 'Expected MANIFEST reference');
    assert.ok(content.includes('always_load'), 'Expected always_load reference');
    assert.ok(content.includes('Follow all skill directives'), 'Expected action 3');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createBmadAgent: returns error for duplicate file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-create-agent-'));
  try {
    createBmadAgent('bmm-test-role', tmpDir);
    const result = createBmadAgent('bmm-test-role', tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.length > 0, 'Expected error message');
    assert.ok(result.hint.length > 0, 'Expected hint message');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('createBmadAgent: error and hint are label-free data', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-create-agent-'));
  try {
    createBmadAgent('bmm-test-role', tmpDir);
    const result = createBmadAgent('bmm-test-role', tmpDir);
    assert.ok(!result.error.startsWith('Error:'), 'error field must not include "Error:" prefix');
    assert.ok(!result.hint.startsWith('Hint:'), 'hint field must not include "Hint:" prefix');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── CLI integration tests ────────────────────────────────────────────────────
console.log('\n create-agent CLI integration tests\n');

test('create-agent: no agent name exits 1', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-agent'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for missing agent name');
});

test('create-agent: existing builtin agent exits 1 with error', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-agent', 'bmm-pm'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for existing agent');
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('Error') || output.includes('already exists'), 'Expected error message');
});

test('create-agent: invalid name (uppercase) exits 1', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-agent', 'bmm-TEST-role'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for invalid name');
});

test('create-agent: --yes flag generates file with exit 0', () => {
  // Use a unique test name to avoid conflicts
  const testAgentName = `bmm-test-role-${Date.now()}`;
  const result = spawnSync('node', [CLI_PATH, 'create-agent', testAgentName, '--yes'], {
    encoding: 'utf8', cwd: PROJECT_ROOT, input: ''
  });
  assert.ok(result.status === 0 || result.status === null, `Expected exit 0, got: ${result.status}. stderr: ${result.stderr}`);
  assert.ok(
    result.stdout.includes('created') || result.stdout.includes('generated'),
    `Expected success message: ${result.stdout}`
  );
  // Cleanup
  const filePath = path.join(AGENTS_DIR, `${testAgentName}.customize.yaml`);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
});

test('create-agent: auto-prefix bmm- and succeed', () => {
  const testAgentName = `test-prefix-${Date.now()}`;
  const normalizedName = `bmm-${testAgentName}`;
  const result = spawnSync('node', [CLI_PATH, 'create-agent', testAgentName, '--yes'], {
    encoding: 'utf8', cwd: PROJECT_ROOT, input: ''
  });
  assert.ok(result.status === 0 || result.status === null, `Expected exit 0, got: ${result.status}. stderr: ${result.stderr}`);
  assert.ok(
    result.stdout.includes('normalized') || result.stdout.includes(normalizedName) || result.stdout.includes('created'),
    `Expected normalization or creation message: ${result.stdout}`
  );
  // Cleanup
  const filePath = path.join(AGENTS_DIR, `${normalizedName}.customize.yaml`);
  if (fs.existsSync(filePath)) fs.rmSync(filePath);
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
  process.exit(1);
}
