#!/usr/bin/env node
/**
 * Tests for Story 16.8: CI/CD Remote Repository Mode
 * Tests collectRepoLayout() with git URL env vars, ciCloneIfNeeded()
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

async function asyncTest(name, fn) {
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
let collectRepoLayout, ciCloneIfNeeded;
try {
  ({ collectRepoLayout, ciCloneIfNeeded } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// Helper: save and restore env vars
function withEnv(vars, fn) {
  const saved = {};
  const envKeys = [
    'MA_KNOWLEDGEBASE_PATH', 'MA_SPRINT_PATH',
    'MA_KNOWLEDGEBASE_GIT_URL', 'MA_SPRINT_GIT_URL'
  ];
  for (const k of envKeys) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  for (const [k, v] of Object.entries(vars)) {
    process.env[k] = v;
  }
  try {
    return fn();
  } finally {
    for (const k of envKeys) {
      if (saved[k] !== undefined) process.env[k] = saved[k];
      else delete process.env[k];
    }
  }
}

// ─── collectRepoLayout: remote mode via env vars ───────────────────────────
console.log('\ncollectRepoLayout: CI/CD remote mode');

asyncTest('--yes + git URL + path returns remote mode', async () => {
  await withEnv({
    MA_KNOWLEDGEBASE_PATH: os.tmpdir(),
    MA_KNOWLEDGEBASE_GIT_URL: 'https://git.example.com/kb.git',
  }, async () => {
    // Create a fake .git dir at tmpdir so clone is skipped
    const gitDir = path.join(os.tmpdir(), '.git');
    const hadGitDir = fs.existsSync(gitDir);
    if (!hadGitDir) fs.mkdirSync(gitDir, { recursive: true });
    try {
      const result = await collectRepoLayout({ yes: true }, null);
      assert.strictEqual(result.knowledgebase.mode, 'remote');
      assert.strictEqual(result.knowledgebase.gitUrl, 'https://git.example.com/kb.git');
      assert.strictEqual(result.knowledgebase.path, path.resolve(os.tmpdir()));
    } finally {
      if (!hadGitDir && fs.existsSync(gitDir)) fs.rmdirSync(gitDir);
    }
  });
});

asyncTest('--yes + path only (no git URL) returns local mode (backward compat)', async () => {
  await withEnv({
    MA_KNOWLEDGEBASE_PATH: '/some/local/path',
  }, async () => {
    const result = await collectRepoLayout({ yes: true }, null);
    assert.strictEqual(result.knowledgebase.mode, 'local');
    assert.strictEqual(result.knowledgebase.path, path.resolve('/some/local/path'));
    assert.strictEqual(result.knowledgebase.gitUrl, undefined, 'should not have gitUrl');
  });
});

asyncTest('--yes + no env vars defaults to single-repo', async () => {
  await withEnv({}, async () => {
    const result = await collectRepoLayout({ yes: true }, null);
    assert.strictEqual(result.knowledgebase.mode, 'same');
    assert.strictEqual(result.sprintManagement.mode, 'same');
  });
});

asyncTest('--yes + sprint git URL + path returns remote for sprint', async () => {
  await withEnv({
    MA_SPRINT_PATH: os.tmpdir(),
    MA_SPRINT_GIT_URL: 'https://git.example.com/sprint.git',
  }, async () => {
    const gitDir = path.join(os.tmpdir(), '.git');
    const hadGitDir = fs.existsSync(gitDir);
    if (!hadGitDir) fs.mkdirSync(gitDir, { recursive: true });
    try {
      const result = await collectRepoLayout({ yes: true }, null);
      assert.strictEqual(result.sprintManagement.mode, 'remote');
      assert.strictEqual(result.sprintManagement.gitUrl, 'https://git.example.com/sprint.git');
      assert.strictEqual(result.knowledgebase.mode, 'same', 'kb should default when not set');
    } finally {
      if (!hadGitDir && fs.existsSync(gitDir)) fs.rmdirSync(gitDir);
    }
  });
});

// ─── ciCloneIfNeeded ───────────────────────────────────────────────────────
console.log('\nciCloneIfNeeded');

test('skips clone when .git directory exists at destination', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const clonedRepos = new Map();
    // Should not throw — just logs and returns
    ciCloneIfNeeded(tmpDir, 'https://git.example.com/repo.git', clonedRepos);
    assert.ok(clonedRepos.has(`https://git.example.com/repo.git::${tmpDir}`), 'should mark as cloned');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('deduplicates: same URL+path only processed once', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  try {
    fs.mkdirSync(path.join(tmpDir, '.git'));
    const clonedRepos = new Map();
    ciCloneIfNeeded(tmpDir, 'https://git.example.com/repo.git', clonedRepos);
    // Second call should be a no-op
    ciCloneIfNeeded(tmpDir, 'https://git.example.com/repo.git', clonedRepos);
    assert.strictEqual(clonedRepos.size, 1, 'should only have one entry');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('throws error when destination exists but is not a git repo', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  try {
    // tmpDir exists but has no .git/ — should throw
    try {
      ciCloneIfNeeded(tmpDir, 'https://git.example.com/repo.git', new Map());
      assert.fail('should have thrown');
    } catch (e) {
      assert.ok(e.message.includes('not a git repo'), `error should mention "not a git repo", got: ${e.message}`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── git URL without path env var ──────────────────────────────────────────
console.log('\ncollectRepoLayout: validation errors');

asyncTest('git URL without path env var throws error (knowledgebase)', async () => {
  try {
    await withEnv({
      MA_KNOWLEDGEBASE_GIT_URL: 'https://git.example.com/kb.git',
      // MA_KNOWLEDGEBASE_PATH deliberately NOT set
    }, async () => {
      await collectRepoLayout({ yes: true }, null);
    });
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('MA_KNOWLEDGEBASE_GIT_URL requires MA_KNOWLEDGEBASE_PATH'),
      `should mention required PATH, got: ${e.message}`);
  }
});

asyncTest('git URL without path env var throws error (sprint)', async () => {
  try {
    await withEnv({
      MA_SPRINT_GIT_URL: 'https://git.example.com/sprint.git',
    }, async () => {
      await collectRepoLayout({ yes: true }, null);
    });
    assert.fail('should have thrown');
  } catch (e) {
    assert.ok(e.message.includes('MA_SPRINT_GIT_URL requires MA_SPRINT_PATH'),
      `should mention required PATH, got: ${e.message}`);
  }
});

// ─── Summary ───────────────────────────────────────────────────────────────
async function runAll() {
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
}

runAll();
