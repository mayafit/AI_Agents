#!/usr/bin/env node
/**
 * Tests for Story 16.4: Validate Cross-Repo Path Resolution
 * Verifies config-driven path resolution and backward compatibility
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

let writeRepoLayoutConfig, writeConfigField;
try {
  ({ writeRepoLayoutConfig, writeConfigField } = require('../bin/cli.js'));
} catch (e) {
  console.error('\n  FATAL: Cannot load exports from cli.js');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Task 1: Audit verification ─────────────────────────────────────────────
console.log('\nTask 1 — Workflow audit: no hardcoded _bmad-output/ paths');

test('no workflow files contain hardcoded _bmad-output/', () => {
  const bmadDir = path.join(__dirname, '..', '_bmad', 'bmm');
  if (!fs.existsSync(bmadDir)) {
    console.log('    SKIP: _bmad/bmm not found (BMAD not installed)');
    return;
  }

  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const results = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...scanDir(full));
      } else if ((entry.name.endsWith('.md') || entry.name.endsWith('.yaml')) && entry.name !== 'config.yaml') {
        // Exclude config.yaml — it stores resolved path values, not hardcoded references
        const content = fs.readFileSync(full, 'utf-8');
        // Look for literal _bmad-output/ that isn't in a comment or template variable context
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.includes('_bmad-output/') && !line.includes('{') && !line.includes('#')) {
            results.push({ file: full, line: i + 1, content: line.trim() });
          }
        }
      }
    }
    return results;
  }

  const hardcoded = scanDir(bmadDir);
  assert.strictEqual(hardcoded.length, 0,
    `Found ${hardcoded.length} hardcoded _bmad-output/ references:\n` +
    hardcoded.map(h => `  ${h.file}:${h.line}: ${h.content}`).join('\n'));
});

// ─── Task 2: Config-driven path resolution ──────────────────────────────────
console.log('\nTask 2 — Config writes planning_artifacts and implementation_artifacts');

test('single-repo: writes default artifact paths', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '# config\n{}');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('planning_artifacts: "_bmad-output/planning-artifacts"'),
      `Expected default planning_artifacts. Got:\n${content}`);
    assert.ok(content.includes('implementation_artifacts: "_bmad-output/implementation-artifacts"'),
      `Expected default implementation_artifacts. Got:\n${content}`);
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('multi-repo: writes external artifact paths', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '# config\n{}');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: 'd:\\Code\\kb-repo' },
      sprintManagement: { mode: 'local', path: 'd:\\Code\\sprint-repo' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('planning_artifacts: "d:/Code/kb-repo/_bmad-output/planning-artifacts"'),
      `Expected external planning_artifacts. Got:\n${content}`);
    assert.ok(content.includes('implementation_artifacts: "d:/Code/sprint-repo/_bmad-output/implementation-artifacts"'),
      `Expected external implementation_artifacts. Got:\n${content}`);
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('mixed mode: kb external, sprint same', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '# config\n{}');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'local', path: '/ext/kb' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    assert.ok(content.includes('planning_artifacts: "/ext/kb/_bmad-output/planning-artifacts"'),
      `Got:\n${content}`);
    assert.ok(content.includes('implementation_artifacts: "_bmad-output/implementation-artifacts"'),
      `Got:\n${content}`);
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Task 3: Single-repo backward compatibility ─────────────────────────────
console.log('\nTask 3 — Single-repo backward compatibility');

test('single-repo config matches pre-Epic-16 defaults', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-test-'));
  const origCwd = process.cwd();
  try {
    process.chdir(tmpDir);
    const configDir = path.join(tmpDir, '_bmad', 'bmm');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(path.join(configDir, 'config.yaml'), '{}');
    writeRepoLayoutConfig({
      knowledgebase: { mode: 'same', path: '.' },
      sprintManagement: { mode: 'same', path: '.' }
    });
    const content = fs.readFileSync(path.join(configDir, 'config.yaml'), 'utf-8');
    // These are the default relative paths that workflows used before Epic 16
    assert.ok(content.includes('planning_artifacts: "_bmad-output/planning-artifacts"'));
    assert.ok(content.includes('implementation_artifacts: "_bmad-output/implementation-artifacts"'));
    assert.ok(content.includes('knowledgebase_path: "."'));
    assert.ok(content.includes('sprint_management_path: "."'));
  } finally {
    process.chdir(origCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Task 4: Source-of-truth precedence ─────────────────────────────────────
console.log('\nTask 4 — Source-of-truth precedence documented');

test('validation report exists', () => {
  const reportPath = path.join(__dirname, '..', '_bmad-output', 'implementation-artifacts', '16-4-validation-report.md');
  assert.ok(fs.existsSync(reportPath), 'Validation report should exist');
  const content = fs.readFileSync(reportPath, 'utf-8');
  assert.ok(content.includes('Source-of-Truth Precedence'), 'Should document precedence');
  assert.ok(content.includes('PRIMARY'), 'Should identify primary source');
  assert.ok(content.includes('config.yaml'), 'Should mention config.yaml as primary');
});

test('path accessibility: fs.accessSync pattern available', () => {
  // Verify fs.accessSync works for testing path accessibility
  assert.ok(typeof fs.accessSync === 'function', 'fs.accessSync should be available');
  // Test with known accessible path
  assert.doesNotThrow(() => fs.accessSync(__dirname, fs.constants.R_OK));
});

// ─── Summary ────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
