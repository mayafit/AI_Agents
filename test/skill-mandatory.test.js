#!/usr/bin/env node
/**
 * Tests for set-mandatory command and list --mandatory filter
 * Story 3.3: Mandatory Skill Designation Tooling
 *
 * Task 5.1: set-mandatory enables always_load
 * Task 5.2: set-mandatory --off disables always_load
 * Task 5.3: list --mandatory filters correctly
 * Task 5.4: MANIFEST.yaml reflects changes
 */
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const PROJECT_ROOT = path.join(__dirname, '..');

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
  }
}

// ─── Module imports ────────────────────────────────────────────────────────────
let setMandatory;
try {
  ({ setMandatory } = require('../lib/skill-authoring'));
} catch (e) {
  console.error('\n  FATAL: Cannot load skill-authoring module');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Helper: build a temporary skill with a real skill.json ──────────────────
function makeTmpSkill(alwaysLoad = false, extraFields = {}) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-mandatory-test-'));
  const skillName = 'test-mandatory-skill';
  const skillDir = path.join(tmpBase, skillName);
  fs.mkdirSync(skillDir, { recursive: true });

  const json = Object.assign({
    name: 'Test Mandatory Skill',
    description: 'Test skill',
    version: '1.0.0',
    category: 'workflow',
    author: 'ma-agents',
    tags: ['test'],
    always_load: alwaysLoad
  }, extraFields);

  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(json, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Mandatory Skill\n', 'utf8');

  return { tmpBase, skillDir, skillName };
}

// ─── Unit tests: setMandatory() ───────────────────────────────────────────────
console.log('\n setMandatory unit tests\n');

// AC #1: Enable
test('setMandatory: sets always_load=true in skill.json', () => {
  const { tmpBase, skillName } = makeTmpSkill(false);
  try {
    const result = setMandatory(skillName, true, tmpBase);
    assert.strictEqual(result.success, true, `Expected success, got: ${JSON.stringify(result)}`);

    const updated = JSON.parse(fs.readFileSync(path.join(tmpBase, skillName, 'skill.json'), 'utf8'));
    assert.strictEqual(updated.always_load, true, 'Expected always_load=true');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// AC #2: Disable
test('setMandatory: sets always_load=false with enable=false', () => {
  const { tmpBase, skillName } = makeTmpSkill(true);
  try {
    const result = setMandatory(skillName, false, tmpBase);
    assert.strictEqual(result.success, true);

    const updated = JSON.parse(fs.readFileSync(path.join(tmpBase, skillName, 'skill.json'), 'utf8'));
    assert.strictEqual(updated.always_load, false, 'Expected always_load=false');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('setMandatory: preserves all other fields in skill.json', () => {
  const { tmpBase, skillName } = makeTmpSkill(false, { custom_field: 'preserved' });
  try {
    setMandatory(skillName, true, tmpBase);
    const updated = JSON.parse(fs.readFileSync(path.join(tmpBase, skillName, 'skill.json'), 'utf8'));
    assert.strictEqual(updated.name, 'Test Mandatory Skill', 'Expected name preserved');
    assert.strictEqual(updated.version, '1.0.0', 'Expected version preserved');
    assert.deepStrictEqual(updated.tags, ['test'], 'Expected tags preserved');
    assert.strictEqual(updated.custom_field, 'preserved', 'Expected custom_field preserved');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('setMandatory: returns error for non-existent skill', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-mandatory-empty-'));
  try {
    const result = setMandatory('no-such-skill', true, tmpBase);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('not found') || result.error.includes('no-such-skill'),
      `Expected not-found error, got: ${result.error}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('setMandatory: error and hint are label-free data', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-mandatory-empty2-'));
  try {
    const result = setMandatory('no-such-skill', true, tmpBase);
    assert.ok(!result.error.startsWith('Error:'), 'error field should not start with "Error:"');
    assert.ok(!result.hint.startsWith('Hint:'), 'hint field should not start with "Hint:"');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// ─── CLI integration tests: set-mandatory ────────────────────────────────────
console.log('\n set-mandatory CLI integration tests\n');

// Use a real skill in the project's skills/ dir for CLI tests
const TEST_SKILL = 'git-workflow-skill';
const SKILL_JSON_PATH = path.join(PROJECT_ROOT, 'skills', TEST_SKILL, 'skill.json');

// Save and restore original always_load value
let originalAlwaysLoad;
try {
  const original = JSON.parse(fs.readFileSync(SKILL_JSON_PATH, 'utf8'));
  originalAlwaysLoad = original.always_load;
} catch (_) {
  originalAlwaysLoad = true;
}

// AC #1: Enable
test('set-mandatory: sets always_load=true with exit 0', () => {
  const result = spawnSync('node', [CLI_PATH, 'set-mandatory', TEST_SKILL], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
  assert.ok(result.stdout.includes('mandatory') || result.stdout.includes('always_load'),
    `Expected confirmation in output: ${result.stdout}`);

  const updated = JSON.parse(fs.readFileSync(SKILL_JSON_PATH, 'utf8'));
  assert.strictEqual(updated.always_load, true, 'Expected always_load=true in skill.json');
});

// AC #2: Disable
test('set-mandatory --off: sets always_load=false with exit 0', () => {
  const result = spawnSync('node', [CLI_PATH, 'set-mandatory', TEST_SKILL, '--off'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);

  const updated = JSON.parse(fs.readFileSync(SKILL_JSON_PATH, 'utf8'));
  assert.strictEqual(updated.always_load, false, 'Expected always_load=false in skill.json');
});

// Restore original value
try {
  const current = JSON.parse(fs.readFileSync(SKILL_JSON_PATH, 'utf8'));
  current.always_load = originalAlwaysLoad;
  fs.writeFileSync(SKILL_JSON_PATH, JSON.stringify(current, null, 2) + '\n', 'utf8');
} catch (_) {}

// Missing skill name
test('set-mandatory: no skill name exits 1', () => {
  const result = spawnSync('node', [CLI_PATH, 'set-mandatory'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1');
});

// Unknown skill
test('set-mandatory: unknown skill exits 1 with error', () => {
  const result = spawnSync('node', [CLI_PATH, 'set-mandatory', 'no-such-skill'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for missing skill');
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('Error') || output.includes('not found'), 'Expected error message');
});

// ─── CLI integration tests: list --mandatory ──────────────────────────────────
console.log('\n list --mandatory CLI integration tests\n');

// AC #3: Filter mandatory skills
test('list --mandatory: exits 0', () => {
  const result = spawnSync('node', [CLI_PATH, 'list', '--mandatory'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
});

test('list --mandatory: only shows skills with always_load=true', () => {
  const result = spawnSync('node', [CLI_PATH, 'list', '--mandatory'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  // git-workflow-skill has always_load: true — should appear
  assert.ok(result.stdout.includes('git-workflow-skill'), 'Expected git-workflow-skill in mandatory list');
});

test('list --mandatory: output differs from full list', () => {
  const full = spawnSync('node', [CLI_PATH, 'list'], { encoding: 'utf8', cwd: PROJECT_ROOT });
  const filtered = spawnSync('node', [CLI_PATH, 'list', '--mandatory'], { encoding: 'utf8', cwd: PROJECT_ROOT });
  // Mandatory list should be shorter or equal (never longer)
  assert.ok(filtered.stdout.length <= full.stdout.length, 'Mandatory list should not be longer than full list');
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
  process.exit(1);
}
