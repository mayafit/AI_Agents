#!/usr/bin/env node
/**
 * Tests for Story 16.7: Portable Path Storage
 * Tests toPortablePath(), resolveStoredPath(), and round-trip write/read with relative paths
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
let toPortablePath, resolveStoredPath, normalizePath, writeProjectLayoutYaml, writeRepoLayoutConfig, readExistingLayout;
try {
  ({ toPortablePath, resolveStoredPath, normalizePath, writeProjectLayoutYaml, writeRepoLayoutConfig, readExistingLayout } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// Helper
function withTmpDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  process.chdir(tmpDir);
  return { tmpDir, cleanup() { process.chdir(origCwd); fs.rmSync(tmpDir, { recursive: true, force: true }); } };
}

// ─── toPortablePath ────────────────────────────────────────────────────────
console.log('\ntoPortablePath');

test('sibling path stored as relative: d:/Code/kb from d:/Code/agents becomes ../kb', () => {
  const result = toPortablePath('d:/Code/kb', 'd:/Code/agents');
  assert.strictEqual(result.portable, '../kb');
  assert.strictEqual(result.isAbsolute, false);
});

test('nested relative works: ../../other/kb', () => {
  const result = toPortablePath('/home/user/other/kb', '/home/user/projects/myapp');
  assert.strictEqual(result.portable, '../../other/kb');
  assert.strictEqual(result.isAbsolute, false);
});

test('dot path stays as dot', () => {
  const result = toPortablePath('.', '/any/root');
  assert.strictEqual(result.portable, '.');
  assert.strictEqual(result.isAbsolute, false);
});

test('null/empty returns dot', () => {
  const result = toPortablePath('', '/any/root');
  assert.strictEqual(result.portable, '.');
  assert.strictEqual(result.isAbsolute, false);
});

test('deeply nested (>3 levels up) falls back to absolute', () => {
  const result = toPortablePath('/a/b', '/a/b/c/d/e/f');
  assert.strictEqual(result.isAbsolute, true, 'should be marked absolute');
  // Path should be the normalized absolute path
  assert.ok(!result.portable.startsWith('.'), 'should not be relative');
});

test('same directory returns dot', () => {
  const result = toPortablePath('/home/user/project', '/home/user/project');
  assert.strictEqual(result.portable, '.');
  assert.strictEqual(result.isAbsolute, false);
});

test('subdirectory becomes simple relative', () => {
  const result = toPortablePath('/home/user/project/sub', '/home/user/project');
  assert.strictEqual(result.portable, 'sub');
  assert.strictEqual(result.isAbsolute, false);
});

test('backslashes in result are normalized to forward slashes', () => {
  // On Windows, path.relative may return backslashes
  const result = toPortablePath('d:\\Code\\kb', 'd:\\Code\\agents');
  assert.ok(!result.portable.includes('\\'), 'should not contain backslashes');
});

// ─── resolveStoredPath ─────────────────────────────────────────────────────
console.log('\nresolveStoredPath');

test('dot path stays as dot', () => {
  assert.strictEqual(resolveStoredPath('.', '/any/root'), '.');
});

test('null returns dot (safe default)', () => {
  assert.strictEqual(resolveStoredPath(null, '/any/root'), '.');
});

test('absolute path passes through unchanged', () => {
  assert.strictEqual(resolveStoredPath('/absolute/path', '/any/root'), '/absolute/path');
});

test('relative path resolved from project root', () => {
  const result = resolveStoredPath('../kb', '/home/user/project');
  assert.strictEqual(result, normalizePath(path.resolve('/home/user/project', '../kb')));
});

test('Windows drive letter path passes through', () => {
  assert.strictEqual(resolveStoredPath('d:/Code/kb', '/any/root'), 'd:/Code/kb');
});

// ─── writeProjectLayoutYaml with portable paths ───────────────────────────
console.log('\nwriteProjectLayoutYaml (portable paths)');

test('writes relative paths for sibling directories', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const siblingPath = path.join(path.dirname(tmpDir), 'kb-repo');
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: siblingPath },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(content.includes('../kb-repo'), `should contain relative path, got: ${content}`);
    assert.ok(!content.includes('PORTABILITY'), 'should not have portability warning');
  } finally {
    cleanup();
  }
});

test('writes dot path unchanged for same-repo', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: '.' },
      sprintManagement: { mode: 'local', path: path.join(path.dirname(tmpDir), 'sprint') }
    });
    const content = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(content.includes('path: "."'), `dot path should be preserved, got: ${content}`);
    assert.ok(content.includes('../sprint'), 'sibling should be relative');
  } finally {
    cleanup();
  }
});

// ─── writeRepoLayoutConfig with portable paths ────────────────────────────
console.log('\nwriteRepoLayoutConfig (portable paths)');

test('writes relative paths to config.yaml', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '# existing config\n{}');
    const siblingKb = path.join(path.dirname(tmpDir), 'kb-repo');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: siblingKb },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('knowledgebase_path: "../kb-repo"'), `should have relative path, got: ${content}`);
    assert.ok(content.includes('sprint_management_path: "."'), `dot path preserved, got: ${content}`);
  } finally {
    cleanup();
  }
});

test('derived artifact paths are relative when base is relative', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '# config\n{}');
    const siblingKb = path.join(path.dirname(tmpDir), 'kb-repo');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: siblingKb },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('planning_artifacts: "../kb-repo/_bmad-output/planning-artifacts"'),
      `planning_artifacts should be relative, got: ${content}`);
    assert.ok(content.includes('implementation_artifacts: "_bmad-output/implementation-artifacts"'),
      `impl_artifacts should use default for ".", got: ${content}`);
  } finally {
    cleanup();
  }
});

// ─── Round-trip: write relative → read → resolve to absolute ───────────────
console.log('\nRound-trip: write relative, read back, resolve to absolute');

test('round-trip: sibling path written as relative, read back as resolved absolute', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    const siblingPath = normalizePath(path.join(path.dirname(tmpDir), 'kb-repo'));
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: siblingPath },
      sprintManagement: { mode: 'same', path: '.' }
    });
    // Verify file has relative path
    const fileContent = fs.readFileSync(path.join(tmpDir, '_bmad-output', 'project-layout.yaml'), 'utf-8');
    assert.ok(fileContent.includes('../kb-repo'), 'file should store relative');

    // Read back — should resolve to absolute
    const result = readExistingLayout();
    assert.ok(result, 'should read layout');
    const resolvedKb = normalizePath(result.knowledgebase.path);
    assert.strictEqual(resolvedKb, siblingPath, `should resolve back to original: got ${resolvedKb}`);
  } finally {
    cleanup();
  }
});

test('round-trip: dot path stays as dot', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    writeProjectLayoutYaml({
      knowledgebase: { mode: 'local', path: path.join(path.dirname(tmpDir), 'kb') },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const result = readExistingLayout();
    assert.strictEqual(result.sprintManagement.path, '.', 'dot should stay as dot');
  } finally {
    cleanup();
  }
});

test('backward compat: absolute paths in existing files still work', () => {
  const { tmpDir, cleanup } = withTmpDir();
  try {
    // Manually write absolute path (old format)
    const dir = path.join(tmpDir, '_bmad-output');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'project-layout.yaml'), [
      'knowledgebase:',
      '  mode: local',
      '  path: "/absolute/old/kb"',
      'sprint_management:',
      '  mode: same',
      '  path: "."',
    ].join('\n'));

    const result = readExistingLayout();
    assert.ok(result, 'should read layout');
    assert.strictEqual(result.knowledgebase.path, '/absolute/old/kb', 'absolute path should pass through');
  } finally {
    cleanup();
  }
});

// ─── Summary ───────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
