#!/usr/bin/env node
/**
 * Tests for Story 16.2: Config Storage and Cross-Reference File
 * Tests writeRepoLayoutConfig(), writeProjectLayoutYaml(), writeConfigField(), normalizePath()
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

// ─── Load module ─────────────────────────────────────────────────────────────
let writeConfigField, normalizePath, writeRepoLayoutConfig, writeProjectLayoutYaml;
try {
  ({ writeConfigField, normalizePath, writeRepoLayoutConfig, writeProjectLayoutYaml } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── normalizePath ──────────────────────────────────────────────────────────
console.log('\nnormalizePath');

test('converts backslashes to forward slashes', () => {
  assert.strictEqual(normalizePath('d:\\Code\\agents'), 'd:/Code/agents');
});

test('leaves forward slashes unchanged', () => {
  assert.strictEqual(normalizePath('/path/to/repo'), '/path/to/repo');
});

test('handles dot path', () => {
  assert.strictEqual(normalizePath('.'), '.');
});

// ─── writeConfigField ───────────────────────────────────────────────────────
console.log('\nwriteConfigField');

test('appends field when not present', () => {
  const result = writeConfigField('existing: value', 'new_field', '/some/path');
  assert.ok(result.includes('new_field: "/some/path"'), `Got: ${result}`);
  assert.ok(result.includes('existing: value'), 'preserves existing content');
});

test('replaces existing field in place', () => {
  const content = 'knowledgebase_path: "old/path"\nother: value';
  const result = writeConfigField(content, 'knowledgebase_path', 'new/path');
  assert.ok(result.includes('knowledgebase_path: "new/path"'), `Got: ${result}`);
  assert.ok(!result.includes('old/path'), 'old value should be replaced');
  assert.ok(result.includes('other: value'), 'other fields preserved');
});

test('does not duplicate field on second write', () => {
  let content = 'knowledgebase_path: "."\n';
  content = writeConfigField(content, 'knowledgebase_path', '/new/path');
  const count = (content.match(/knowledgebase_path/g) || []).length;
  assert.strictEqual(count, 1, `Field duplicated: count=${count}`);
});

test('double-quotes path values', () => {
  const result = writeConfigField('', 'path_field', 'C:/Code/repo');
  assert.ok(result.includes('"C:/Code/repo"'), 'Path should be double-quoted');
});

// ─── writeProjectLayoutYaml ─────────────────────────────────────────────────
console.log('\nwriteProjectLayoutYaml');

test('single-repo: does not create project-layout.yaml', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    fs.mkdirSync('_bmad-output', { recursive: true });
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml')),
      'project-layout.yaml should NOT be created for single-repo');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('single-repo: deletes stale project-layout.yaml', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    fs.mkdirSync('_bmad-output', { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'stale content');
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    assert.ok(!fs.existsSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml')),
      'stale project-layout.yaml should be deleted');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('multi-repo: creates project-layout.yaml with correct structure', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: 'd:\\Code\\kb-repo' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(content.includes('knowledgebase:'), 'should have knowledgebase section');
    assert.ok(content.includes('mode: local'), 'should have mode: local');
    assert.ok(content.includes('"d:/Code/kb-repo"'), 'should normalize backslashes and quote');
    assert.ok(content.includes('sprint_management:'), 'should have sprint_management section');
    assert.ok(content.includes('mode: same'), 'should have mode: same for sprint');
    assert.ok(content.includes('generated:'), 'should have generated date');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('multi-repo remote: includes gitUrl only for remote mode', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'remote', path: '/tmp/kb', gitUrl: 'https://git.example.com/kb.git' },
      sprintManagement: { mode: 'local', path: '/tmp/sprint' }
    });
    const content = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(content.includes('gitUrl: "https://git.example.com/kb.git"'), 'should include gitUrl for remote');
    // sprint_management section should NOT have gitUrl
    const sprintSection = content.split('sprint_management:')[1];
    assert.ok(!sprintSection.includes('gitUrl'), 'local mode should not have gitUrl');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('path normalization: backslashes converted in YAML output', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: 'C:\\Users\\dev\\kb' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(!content.includes('\\'), 'should not contain backslashes');
    assert.ok(content.includes('C:/Users/dev/kb'), 'should contain normalized path');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('idempotency: same config produces identical output (except date)', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const layout = {
      knowledgebase: { mode: 'local', path: '/stable/path' },
      sprintManagement: { mode: 'local', path: '/stable/sprint' }
    };
    writeProjectLayoutYaml(layout);
    const first = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    writeProjectLayoutYaml(layout);
    const second = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.strictEqual(first, second, 'identical config should produce identical output');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── writeRepoLayoutConfig ──────────────────────────────────────────────────
console.log('\nwriteRepoLayoutConfig');

test('writes path fields to config.yaml', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '# existing config\n{}');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: 'd:\\Code\\kb' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('knowledgebase_path: "d:/Code/kb"'), `Got: ${content}`);
    assert.ok(content.includes('sprint_management_path: "."'), `Got: ${content}`);
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updates existing fields in place', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'),
      '# config\nknowledgebase_path: "."\nsprint_management_path: "."\n');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: '/new/kb' },
      sprintManagement: { mode: 'local', path: '/new/sprint' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('knowledgebase_path: "/new/kb"'), `Got: ${content}`);
    assert.ok(content.includes('sprint_management_path: "/new/sprint"'), `Got: ${content}`);
    const kbCount = (content.match(/knowledgebase_path/g) || []).length;
    assert.strictEqual(kbCount, 1, 'should not duplicate field');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('handles missing config.yaml gracefully', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    // No _bmad/bmm/config.yaml — should not throw
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    // If we get here without throwing, the test passes
    assert.ok(true, 'should handle missing config gracefully');
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
