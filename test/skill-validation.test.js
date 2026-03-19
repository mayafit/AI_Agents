#!/usr/bin/env node
/**
 * Tests for validate-skill command implementation
 * Story 3.2: Skill Validation Command
 *
 * Task 6.1: Valid skill reports VALID
 * Task 6.2: Broken skill reports all errors
 * Task 6.3: Unknown agent template triggers warning
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
let validateSkill;
try {
  ({ validateSkill } = require('../lib/skill-authoring'));
} catch (e) {
  console.error('\n  FATAL: Cannot load skill-authoring module');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Helper: build a temporary skill dir ─────────────────────────────────────
function makeTmpSkill(fields = {}) {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-validate-test-'));
  const skillName = fields.skillName || 'test-skill';
  const skillDir = path.join(tmpBase, skillName);
  fs.mkdirSync(skillDir, { recursive: true });

  if (fields.skillJson !== undefined) {
    fs.writeFileSync(path.join(skillDir, 'skill.json'), fields.skillJson, 'utf8');
  } else if (fields.skillJson !== null) {
    // Default valid skill.json
    const json = Object.assign({
      name: 'Test Skill',
      description: 'A test skill',
      version: '1.0.0',
      category: 'workflow',
      author: 'ma-agents',
      tags: ['test'],
      always_load: false
    }, fields.skillJsonOverride || {});
    fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(json, null, 2), 'utf8');
  }

  if (fields.skillMd !== false) {
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# Test Skill\n', 'utf8');
  }

  if (fields.templates) {
    const templatesDir = path.join(skillDir, 'templates');
    fs.mkdirSync(templatesDir, { recursive: true });
    for (const [filename, content] of Object.entries(fields.templates)) {
      fs.writeFileSync(path.join(templatesDir, filename), content, 'utf8');
    }
  }

  return { tmpBase, skillDir, skillName };
}

// ─── Unit tests: validateSkill() ─────────────────────────────────────────────
console.log('\n validateSkill unit tests\n');

// AC #1: Valid skill
test('valid skill returns valid=true with metadata', () => {
  const { tmpBase, skillName } = makeTmpSkill({});
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, true, `Expected valid=true, got: ${JSON.stringify(result)}`);
    assert.ok(Array.isArray(result.errors), 'Expected errors array');
    assert.strictEqual(result.errors.length, 0, `Expected no errors, got: ${JSON.stringify(result.errors)}`);
    assert.ok(result.metadata, 'Expected metadata object');
    assert.strictEqual(result.metadata.name, 'Test Skill');
    assert.strictEqual(result.metadata.version, '1.0.0');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// AC #2: Missing skill.json
test('missing skill.json produces error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJson: undefined });
  // Remove the default skill.json by passing null-ish — need to NOT write it
  fs.rmSync(path.join(tmpBase, skillName, 'skill.json'), { force: true });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('skill.json')), `Expected skill.json error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// AC #3: Missing SKILL.md
test('missing SKILL.md produces error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillMd: false });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('SKILL.md')), `Expected SKILL.md error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// Skill not found
test('non-existent skill returns error (not found)', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-validate-empty-'));
  try {
    const result = validateSkill('no-such-skill', tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.notFound, 'Expected notFound flag');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// AC #4: Invalid JSON
test('corrupt skill.json produces error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJson: 'not valid json {{{' });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.toLowerCase().includes('json')), `Expected JSON error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// AC #4: Missing required fields
test('missing name field produces field error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJsonOverride: { name: '' } });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('name')), `Expected name error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('missing version field produces field error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJsonOverride: { version: undefined } });
  // Remove version from written JSON
  const skillDir = path.join(tmpBase, skillName);
  const json = JSON.parse(fs.readFileSync(path.join(skillDir, 'skill.json'), 'utf8'));
  delete json.version;
  fs.writeFileSync(path.join(skillDir, 'skill.json'), JSON.stringify(json), 'utf8');
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('version')), `Expected version error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('invalid version format produces field error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJsonOverride: { version: 'v1.0' } });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('version')), `Expected version error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('invalid category produces field error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJsonOverride: { category: 'invalid-cat' } });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('category')), `Expected category error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('non-boolean always_load produces field error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJsonOverride: { always_load: 'yes' } });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('always_load')), `Expected always_load error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('non-array tags produces field error', () => {
  const { tmpBase, skillName } = makeTmpSkill({ skillJsonOverride: { tags: 'not-an-array' } });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some(e => e.includes('tags')), `Expected tags error, got: ${JSON.stringify(result.errors)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// AC #5: Template validation
test('valid agent template produces no warning', () => {
  const { tmpBase, skillName } = makeTmpSkill({
    templates: { 'claude-code.md': '# Template' }
  });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, true, `Expected valid, got errors: ${JSON.stringify(result.errors)}`);
    assert.ok(!result.warnings.some(w => w.includes('claude-code')), 'Expected no warning for known agent');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('unknown agent template produces warning', () => {
  const { tmpBase, skillName } = makeTmpSkill({
    templates: { 'unknown-agent.md': '# Template' }
  });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.ok(Array.isArray(result.warnings), 'Expected warnings array');
    assert.ok(result.warnings.some(w => w.includes('unknown-agent')), `Expected unknown-agent warning, got: ${JSON.stringify(result.warnings)}`);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('unknown agent template does not make skill invalid', () => {
  const { tmpBase, skillName } = makeTmpSkill({
    templates: { 'unknown-agent.md': '# Template' }
  });
  try {
    const result = validateSkill(skillName, tmpBase);
    assert.strictEqual(result.valid, true, 'Warnings should not make skill invalid');
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

// ─── CLI integration tests ─────────────────────────────────────────────────────
console.log('\n validate-skill CLI integration tests\n');

// Task 6.1: Valid skill
test('validate-skill: git-workflow-skill reports VALID with exit 0', () => {
  const result = spawnSync('node', [CLI_PATH, 'validate-skill', 'git-workflow-skill'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 0, `Expected exit 0. stderr: ${result.stderr}`);
  assert.ok(result.stdout.includes('VALID'), `Expected VALID in output: ${result.stdout}`);
});

test('validate-skill: valid skill prints metadata summary', () => {
  const result = spawnSync('node', [CLI_PATH, 'validate-skill', 'git-workflow-skill'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.ok(result.stdout.includes('Version'), 'Expected Version in output');
  assert.ok(result.stdout.includes('Category') || result.stdout.includes('Name'), 'Expected metadata fields');
});

// Non-existent skill
test('validate-skill: unknown skill exits 1 with error', () => {
  const result = spawnSync('node', [CLI_PATH, 'validate-skill', 'no-such-skill'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for missing skill');
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('not found') || output.includes('Error'), 'Expected not-found error');
});

// Task 6.2: Broken skill — create deliberately invalid skill, validate, cleanup
test('validate-skill: INVALID skill exits 1', () => {
  const brokenSkill = 'broken-test-skill';
  const brokenDir = path.join(PROJECT_ROOT, 'skills', brokenSkill);
  try {
    fs.mkdirSync(brokenDir, { recursive: true });
    // Deliberately invalid: missing SKILL.md, bad skill.json
    fs.writeFileSync(path.join(brokenDir, 'skill.json'), JSON.stringify({
      name: '',
      version: 'bad-version',
      category: 'invalid-cat'
    }), 'utf8');

    const result = spawnSync('node', [CLI_PATH, 'validate-skill', brokenSkill], {
      encoding: 'utf8', cwd: PROJECT_ROOT
    });
    assert.strictEqual(result.status, 1, `Expected exit 1. stdout: ${result.stdout}`);
    assert.ok(result.stdout.includes('INVALID'), `Expected INVALID in output: ${result.stdout}`);
  } finally {
    fs.rmSync(brokenDir, { recursive: true, force: true });
  }
});

test('validate-skill: INVALID output lists individual field errors', () => {
  const brokenSkill = 'broken-test-skill2';
  const brokenDir = path.join(PROJECT_ROOT, 'skills', brokenSkill);
  try {
    fs.mkdirSync(brokenDir, { recursive: true });
    fs.writeFileSync(path.join(brokenDir, 'skill.json'), JSON.stringify({
      name: '',
      version: 'bad',
      category: 'invalid-cat'
    }), 'utf8');

    const result = spawnSync('node', [CLI_PATH, 'validate-skill', brokenSkill], {
      encoding: 'utf8', cwd: PROJECT_ROOT
    });
    assert.ok(result.stdout.includes('name'), `Expected name error in output: ${result.stdout}`);
    assert.ok(result.stdout.includes('version'), `Expected version error in output: ${result.stdout}`);
    assert.ok(result.stdout.includes('category'), `Expected category error in output: ${result.stdout}`);
  } finally {
    fs.rmSync(brokenDir, { recursive: true, force: true });
  }
});

// Task 6.3: Unknown agent template warning
test('validate-skill: warns about unknown agent template', () => {
  const warnSkill = 'warn-template-skill';
  const warnDir = path.join(PROJECT_ROOT, 'skills', warnSkill);
  try {
    fs.mkdirSync(path.join(warnDir, 'templates'), { recursive: true });
    fs.writeFileSync(path.join(warnDir, 'skill.json'), JSON.stringify({
      name: 'Warn Skill', description: 'test', version: '1.0.0'
    }), 'utf8');
    fs.writeFileSync(path.join(warnDir, 'SKILL.md'), '# Warn Skill\n', 'utf8');
    fs.writeFileSync(path.join(warnDir, 'templates', 'unknown-agent.md'), '# Template\n', 'utf8');

    const result = spawnSync('node', [CLI_PATH, 'validate-skill', warnSkill], {
      encoding: 'utf8', cwd: PROJECT_ROOT
    });
    assert.strictEqual(result.status, 0, `Expected exit 0 (warnings don't fail). stderr: ${result.stderr}`);
    assert.ok(
      result.stdout.includes('unknown-agent') || result.stdout.includes('Warning'),
      `Expected warning about unknown-agent: ${result.stdout}`
    );
  } finally {
    fs.rmSync(warnDir, { recursive: true, force: true });
  }
});

// No skill name provided
test('validate-skill: no skill name exits 1 with usage hint', () => {
  const result = spawnSync('node', [CLI_PATH, 'validate-skill'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for missing skill name');
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
  process.exit(1);
}
