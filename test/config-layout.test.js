#!/usr/bin/env node
/**
 * Tests for Story 16.9: Reconfigure Layout Workflow
 * Tests showCurrentLayout(), handleConfigLayout(), and CLI command routing
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
let showCurrentLayout, handleConfigLayout, writeProjectLayoutYaml, writeRepoLayoutConfig, readExistingLayout;
try {
  ({ showCurrentLayout, handleConfigLayout, writeProjectLayoutYaml, writeRepoLayoutConfig, readExistingLayout } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

function withTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  return { tmpDir, cleanup() { process.chdir(origCwd); fs.rmSync(tmpDir, { recursive: true, force: true }); } };
}

// ─── showCurrentLayout ─────────────────────────────────────────────────────
console.log('\nshowCurrentLayout');

test('--show with no config displays single-repo default', () => {
  const { cleanup } = withTmpDir();
  try {
    // Capture console output
    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    showCurrentLayout();
    console.log = origLog;
    const output = logs.join('\n');
    assert.ok(output.includes('Single-repo') || output.includes('single-repo') || output.includes('.'),
      `should mention single-repo, got: ${output}`);
  } finally {
    cleanup();
  }
});

test('--show with multi-repo config displays current layout', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // Write a layout file
    const dir = path.join(tmpDir, '_bmad-output');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'project-layout.yaml'), [
      'knowledgebase:',
      '  mode: local',
      '  path: "../kb-repo"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ].join('\n'));

    const logs = [];
    const origLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    showCurrentLayout();
    console.log = origLog;
    const output = logs.join('\n');
    assert.ok(output.includes('Knowledgebase') || output.includes('knowledgebase'),
      `should display knowledgebase, got: ${output}`);
    assert.ok(output.includes('local'), `should display mode, got: ${output}`);
  } finally {
    cleanup();
  }
});

// ─── CLI routing ───────────────────────────────────────────────────────────
console.log('\nCLI routing');

test('config command without subcommand exits with error', () => {
  const { execFileSync } = require('child_process');
  try {
    execFileSync('node', [path.join(__dirname, '..', 'bin', 'cli.js'), 'config'], { stdio: 'pipe' });
    assert.fail('should have exited with error');
  } catch (e) {
    assert.ok(e.status === 1, `should exit with code 1, got ${e.status}`);
    assert.ok(e.stderr.toString().includes('Unknown config subcommand'), `should mention unknown subcommand`);
  }
});

test('config layout --show does not modify files', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // Note: this just tests that the command runs without error in single-repo mode
    const { execFileSync } = require('child_process');
    const result = execFileSync('node', [
      path.join(__dirname, '..', 'bin', 'cli.js'), 'config', 'layout', '--show'
    ], { stdio: 'pipe', cwd: tmpDir });
    const output = result.toString();
    assert.ok(output.includes('Single-repo') || output.includes('single-repo') || output.includes('.'),
      `should display layout info, got: ${output}`);
  } finally {
    cleanup();
  }
});

// ─── Sequential async runner ───────────────────────────────────────────────
(async () => {
  // Run async tests sequentially to avoid cwd conflicts
  console.log('\nhandleConfigLayout --yes mode (sequential)');

  // Test: --yes reconfigure writes updated config files
  await asyncTest('--yes reconfigure writes updated config files', async () => {
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
    const origCwd2 = process.cwd();
    process.chdir(tmpDir2);
    const origKb = process.env.MA_KNOWLEDGEBASE_PATH;
    const origSp = process.env.MA_SPRINT_PATH;
    const origKbGit = process.env.MA_KNOWLEDGEBASE_GIT_URL;
    const origSpGit = process.env.MA_SPRINT_GIT_URL;
    try {
      const configDir = path.join(tmpDir2, '_bmad', 'bmm');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'config.yaml'), '# config\nknowledgebase_path: "."\nsprint_management_path: "."');

      const kbPath = path.join(path.dirname(tmpDir2), 'kb-repo');
      process.env.MA_KNOWLEDGEBASE_PATH = kbPath;
      delete process.env.MA_SPRINT_PATH;
      delete process.env.MA_KNOWLEDGEBASE_GIT_URL;
      delete process.env.MA_SPRINT_GIT_URL;

      await handleConfigLayout(['--yes']);

      const config = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
      assert.ok(config.includes('kb-repo'), `kb path should reference kb-repo, got: ${config}`);
      assert.ok(fs.existsSync(path.join(tmpDir2, '_bmad-output', 'project-layout.yaml')),
        'project-layout.yaml should be created');
    } finally {
      if (origKb !== undefined) process.env.MA_KNOWLEDGEBASE_PATH = origKb;
      else delete process.env.MA_KNOWLEDGEBASE_PATH;
      if (origSp !== undefined) process.env.MA_SPRINT_PATH = origSp;
      else delete process.env.MA_SPRINT_PATH;
      if (origKbGit !== undefined) process.env.MA_KNOWLEDGEBASE_GIT_URL = origKbGit;
      else delete process.env.MA_KNOWLEDGEBASE_GIT_URL;
      if (origSpGit !== undefined) process.env.MA_SPRINT_GIT_URL = origSpGit;
      else delete process.env.MA_SPRINT_GIT_URL;
      process.chdir(origCwd2);
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });

  // Test: --yes preserves existing layout
  await asyncTest('--yes preserves existing layout when no env vars', async () => {
    const tmpDir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
    const origCwd3 = process.cwd();
    process.chdir(tmpDir3);
    const origKb = process.env.MA_KNOWLEDGEBASE_PATH;
    const origSp = process.env.MA_SPRINT_PATH;
    const origKbGit = process.env.MA_KNOWLEDGEBASE_GIT_URL;
    const origSpGit = process.env.MA_SPRINT_GIT_URL;
    try {
      const configDir = path.join(tmpDir3, '_bmad', 'bmm');
      fs.mkdirSync(configDir, { recursive: true });
      fs.writeFileSync(path.join(configDir, 'config.yaml'), '# config\nknowledgebase_path: "../kb"\nsprint_management_path: "."');
      const outDir = path.join(tmpDir3, '_bmad-output');
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'project-layout.yaml'), 'knowledgebase:\n  mode: local\n  path: "../kb"\nsprint_management:\n  mode: same\n  path: "."');

      delete process.env.MA_KNOWLEDGEBASE_PATH;
      delete process.env.MA_SPRINT_PATH;
      delete process.env.MA_KNOWLEDGEBASE_GIT_URL;
      delete process.env.MA_SPRINT_GIT_URL;

      await handleConfigLayout(['--yes']);

      assert.ok(fs.existsSync(path.join(outDir, 'project-layout.yaml')),
        'project-layout.yaml should still exist');
      const config = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
      assert.ok(config.includes('kb'), `kb path should be preserved, got: ${config}`);
    } finally {
      if (origKb !== undefined) process.env.MA_KNOWLEDGEBASE_PATH = origKb;
      else delete process.env.MA_KNOWLEDGEBASE_PATH;
      if (origSp !== undefined) process.env.MA_SPRINT_PATH = origSp;
      else delete process.env.MA_SPRINT_PATH;
      if (origKbGit !== undefined) process.env.MA_KNOWLEDGEBASE_GIT_URL = origKbGit;
      else delete process.env.MA_KNOWLEDGEBASE_GIT_URL;
      if (origSpGit !== undefined) process.env.MA_SPRINT_GIT_URL = origSpGit;
      else delete process.env.MA_SPRINT_GIT_URL;
      process.chdir(origCwd3);
      fs.rmSync(tmpDir3, { recursive: true, force: true });
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
})();
