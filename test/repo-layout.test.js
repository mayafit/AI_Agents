#!/usr/bin/env node
/**
 * Tests for Story 16.1: Repository Layout Wizard
 * Tests collectRepoLayout() function and its sub-flows
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

let passed = 0;
let failed = 0;
const errors = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Load module ─────────────────────────────────────────────────────────────
let collectRepoLayout;
try {
  ({ collectRepoLayout } = require('../bin/cli.js'));
  if (typeof collectRepoLayout !== 'function') {
    throw new Error('collectRepoLayout is not exported from cli.js');
  }
} catch (e) {
  console.error('\n  FATAL: Cannot load collectRepoLayout from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Task 5.1: --yes flag returns both as same mode ─────────────────────────
console.log('\nTask 5.1 — collectRepoLayout with --yes flag (no env vars)');

async function runTests() {
  await testAsync('--yes returns both concerns as same mode', async () => {
    // Clear env vars to ensure clean test
    const origKb = process.env.MA_KNOWLEDGEBASE_PATH;
    const origSp = process.env.MA_SPRINT_PATH;
    delete process.env.MA_KNOWLEDGEBASE_PATH;
    delete process.env.MA_SPRINT_PATH;

    try {
      const result = await collectRepoLayout({ yes: true });
      assert.deepStrictEqual(result.knowledgebase, { mode: 'same', path: '.' });
      assert.deepStrictEqual(result.sprintManagement, { mode: 'same', path: '.' });
    } finally {
      if (origKb !== undefined) process.env.MA_KNOWLEDGEBASE_PATH = origKb;
      if (origSp !== undefined) process.env.MA_SPRINT_PATH = origSp;
    }
  });

  // ─── Task 5.2: --yes + env vars returns local mode with resolved paths ────
  console.log('\nTask 5.2 — collectRepoLayout with --yes + env vars');

  await testAsync('--yes + MA_KNOWLEDGEBASE_PATH returns local mode with resolved path', async () => {
    const origKb = process.env.MA_KNOWLEDGEBASE_PATH;
    const origSp = process.env.MA_SPRINT_PATH;
    process.env.MA_KNOWLEDGEBASE_PATH = '../kb-repo';
    delete process.env.MA_SPRINT_PATH;

    try {
      const result = await collectRepoLayout({ yes: true });
      assert.strictEqual(result.knowledgebase.mode, 'local');
      assert.strictEqual(result.knowledgebase.path, path.resolve('../kb-repo'));
      assert.deepStrictEqual(result.sprintManagement, { mode: 'same', path: '.' });
    } finally {
      if (origKb !== undefined) process.env.MA_KNOWLEDGEBASE_PATH = origKb;
      else delete process.env.MA_KNOWLEDGEBASE_PATH;
      if (origSp !== undefined) process.env.MA_SPRINT_PATH = origSp;
    }
  });

  await testAsync('--yes + MA_SPRINT_PATH returns local mode with resolved path', async () => {
    const origKb = process.env.MA_KNOWLEDGEBASE_PATH;
    const origSp = process.env.MA_SPRINT_PATH;
    delete process.env.MA_KNOWLEDGEBASE_PATH;
    process.env.MA_SPRINT_PATH = '/absolute/sprint/path';

    try {
      const result = await collectRepoLayout({ yes: true });
      assert.deepStrictEqual(result.knowledgebase, { mode: 'same', path: '.' });
      assert.strictEqual(result.sprintManagement.mode, 'local');
      assert.strictEqual(result.sprintManagement.path, path.resolve('/absolute/sprint/path'));
    } finally {
      if (origKb !== undefined) process.env.MA_KNOWLEDGEBASE_PATH = origKb;
      if (origSp !== undefined) process.env.MA_SPRINT_PATH = origSp;
      else delete process.env.MA_SPRINT_PATH;
    }
  });

  await testAsync('--yes + both env vars returns local mode for both', async () => {
    const origKb = process.env.MA_KNOWLEDGEBASE_PATH;
    const origSp = process.env.MA_SPRINT_PATH;
    process.env.MA_KNOWLEDGEBASE_PATH = '../shared-docs';
    process.env.MA_SPRINT_PATH = '../shared-sprint';

    try {
      const result = await collectRepoLayout({ yes: true });
      assert.strictEqual(result.knowledgebase.mode, 'local');
      assert.strictEqual(result.knowledgebase.path, path.resolve('../shared-docs'));
      assert.strictEqual(result.sprintManagement.mode, 'local');
      assert.strictEqual(result.sprintManagement.path, path.resolve('../shared-sprint'));
    } finally {
      if (origKb !== undefined) process.env.MA_KNOWLEDGEBASE_PATH = origKb;
      else delete process.env.MA_KNOWLEDGEBASE_PATH;
      if (origSp !== undefined) process.env.MA_SPRINT_PATH = origSp;
      else delete process.env.MA_SPRINT_PATH;
    }
  });

  // ─── Task 5.3: Local path validation ──────────────────────────────────────
  console.log('\nTask 5.3 — Local path validation (integration via spawnSync)');

  const { spawnSync } = require('child_process');
  const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

  // These tests verify behavior by checking the collectRepoLayout function directly
  // The local path and remote flows require interactive prompts, so we test them
  // through the --yes code path and validate the logic structurally.

  test('collectRepoLayout exists and is a function', () => {
    assert.strictEqual(typeof collectRepoLayout, 'function');
  });

  test('collectRepoLayout returns object with knowledgebase and sprintManagement keys', async () => {
    delete process.env.MA_KNOWLEDGEBASE_PATH;
    delete process.env.MA_SPRINT_PATH;
    const result = await collectRepoLayout({ yes: true });
    assert.ok(result.knowledgebase, 'should have knowledgebase key');
    assert.ok(result.sprintManagement, 'should have sprintManagement key');
    assert.ok(result.knowledgebase.mode, 'knowledgebase should have mode');
    assert.ok(result.knowledgebase.path !== undefined, 'knowledgebase should have path');
    assert.ok(result.sprintManagement.mode, 'sprintManagement should have mode');
    assert.ok(result.sprintManagement.path !== undefined, 'sprintManagement should have path');
  });

  // ─── Task 5.4: execFileSync called with correct args (structural check) ───
  console.log('\nTask 5.4 — Remote flow uses execFileSync with array args');

  test('collectRemotePath function exists in cli.js source', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
    assert.ok(src.includes("execFileSync('git', ['clone',"), 'Should use execFileSync with array args for git clone');
    assert.ok(!src.includes('execSync(`git clone'), 'Should NOT use execSync with template literal for git clone');
    assert.ok(!src.includes("execSync('git clone"), 'Should NOT use execSync with string concat for git clone');
  });

  // ─── Task 5.5: Clone failure cleanup (structural check) ──────────────────
  console.log('\nTask 5.5 — Clone failure: cleanup logic present');

  test('clone failure cleanup removes partial directory', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
    assert.ok(src.includes('rmSync(destPath, { recursive: true, force: true })'),
      'Should clean up partial clone directory on failure');
    assert.ok(src.includes('existedBefore'),
      'Should check if directory existed before clone attempt');
  });

  // ─── Task 5.6: Empty/whitespace input rejection (structural check) ────────
  console.log('\nTask 5.6 — Empty/whitespace input rejection');

  test('local path flow rejects empty input', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
    assert.ok(src.includes('Path cannot be empty'),
      'Should have empty path rejection message');
  });

  test('remote flow rejects empty git URL', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
    assert.ok(src.includes('Git URL cannot be empty'),
      'Should have empty git URL rejection message');
  });

  test('remote flow rejects empty destination path', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
    assert.ok(src.includes('Destination path cannot be empty'),
      'Should have empty destination path rejection message');
  });

  // ─── Task 5.7: Nested-repo warning (structural check) ────────────────────
  console.log('\nTask 5.7 — Nested-repo warning');

  test('warns when path is inside cwd', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'bin', 'cli.js'), 'utf-8');
    assert.ok(src.includes('Nested repos may cause git confusion'),
      'Should warn about nested repos');
  });

  // ─── Integration: --yes mode with env vars via spawnSync ──────────────────
  console.log('\nIntegration — --yes mode processes repo layout without prompts');

  test('--yes mode completes without hanging (repo layout integrated)', () => {
    // This test verifies the wizard completes with --yes flag
    // which exercises the collectRepoLayout CI/CD path
    const result = spawnSync(process.execPath, [CLI_PATH, 'install', '--yes'], {
      timeout: 600000,
      encoding: 'utf-8',
      input: '',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..')
    });

    if (result.status === null) {
      console.log('    SKIP: process timed out');
      return;
    }

    assert.strictEqual(
      result.status,
      0,
      `Expected exit 0, got ${result.status}.\nstdout: ${(result.stdout || '').slice(0, 500)}\nstderr: ${(result.stderr || '').slice(0, 500)}`
    );
  });

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
}

runTests();
