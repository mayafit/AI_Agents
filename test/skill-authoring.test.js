#!/usr/bin/env node
/**
 * Tests for create-skill command implementation
 * Story 3.1: Skill Scaffolding Command
 *
 * Task 5.1: Verify all files/dirs created on success
 * Task 5.2: Verify duplicate error when skill already exists
 * Task 5.3: Verify kebab-case error for invalid names
 * Task 5.4: Verify new skill appears in list
 */
'use strict';

const assert = require('assert');
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const SKILLS_DIR = path.join(__dirname, '..', 'skills');
const TEST_SKILL = 'test-scaffold-skill';
const TEST_SKILL_DIR = path.join(SKILLS_DIR, TEST_SKILL);

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

function cleanup() {
  if (fs.existsSync(TEST_SKILL_DIR)) {
    fs.rmSync(TEST_SKILL_DIR, { recursive: true, force: true });
  }
}

// Ensure clean state before tests
cleanup();

// ─── Module imports ────────────────────────────────────────────────────────────
let validateSkillName, createSkill, kebabToTitleCase;
try {
  ({ validateSkillName, createSkill, kebabToTitleCase } = require('../lib/skill-authoring'));
} catch (e) {
  console.error('\n  FATAL: Cannot load skill-authoring module');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── kebabToTitleCase unit tests (L2) ────────────────────────────────────────
console.log('\n kebabToTitleCase unit tests\n');

test('kebabToTitleCase: single word', () => {
  assert.strictEqual(kebabToTitleCase('skill'), 'Skill');
});

test('kebabToTitleCase: multi-word', () => {
  assert.strictEqual(kebabToTitleCase('my-new-skill'), 'My New Skill');
  assert.strictEqual(kebabToTitleCase('python-best-practices'), 'Python Best Practices');
  assert.strictEqual(kebabToTitleCase('api-security'), 'Api Security');
});

test('kebabToTitleCase: numeric segments', () => {
  assert.strictEqual(kebabToTitleCase('a1b2-c3'), 'A1b2 C3');
});

test('kebabToTitleCase: does not crash on empty segment', () => {
  // Defensive: empty segments (e.g. from '--') produce empty string, not crash
  assert.doesNotThrow(() => kebabToTitleCase('a--b'));
  const result = kebabToTitleCase('a--b');
  assert.strictEqual(typeof result, 'string');
});

// ─── validateSkillName unit tests ─────────────────────────────────────────────
console.log('\n validateSkillName unit tests\n');

test('validateSkillName: accepts valid kebab-case names', () => {
  assert.strictEqual(validateSkillName('my-new-skill'), true);
  assert.strictEqual(validateSkillName('python-linting'), true);
  assert.strictEqual(validateSkillName('api-security'), true);
  assert.strictEqual(validateSkillName('abc'), true);
  assert.strictEqual(validateSkillName('a1b2-c3'), true);
});

test('validateSkillName: rejects uppercase', () => {
  assert.strictEqual(validateSkillName('MySkill'), false);
  assert.strictEqual(validateSkillName('My-skill'), false);
});

test('validateSkillName: rejects spaces', () => {
  assert.strictEqual(validateSkillName('my skill'), false);
  assert.strictEqual(validateSkillName(' my-skill'), false);
});

test('validateSkillName: rejects special characters', () => {
  assert.strictEqual(validateSkillName('my_skill'), false);
  assert.strictEqual(validateSkillName('my.skill'), false);
  assert.strictEqual(validateSkillName('my@skill'), false);
});

test('validateSkillName: rejects names starting with number or hyphen', () => {
  assert.strictEqual(validateSkillName('1skill'), false);
  assert.strictEqual(validateSkillName('-skill'), false);
});

test('validateSkillName: rejects names ending with hyphen', () => {
  assert.strictEqual(validateSkillName('skill-'), false);
});

test('validateSkillName: rejects consecutive hyphens', () => {
  assert.strictEqual(validateSkillName('a--b'), false);
});

// ─── createSkill unit tests (uses injected skillsDir for isolation) ───────────
console.log('\n createSkill unit tests\n');

const os = require('os');
const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-test-'));

test('createSkill: creates directory structure in injected skillsDir', () => {
  const result = createSkill('my-unit-skill', tmpBase);
  assert.strictEqual(result.success, true, `Expected success, got: ${JSON.stringify(result)}`);

  const skillDir = path.join(tmpBase, 'my-unit-skill');
  assert.ok(fs.existsSync(skillDir), 'Expected skill dir');
  assert.ok(fs.existsSync(path.join(skillDir, 'skill.json')), 'Expected skill.json');
  assert.ok(fs.existsSync(path.join(skillDir, 'SKILL.md')), 'Expected SKILL.md');
  assert.ok(fs.existsSync(path.join(skillDir, 'templates')), 'Expected templates/');
  assert.ok(fs.existsSync(path.join(skillDir, 'references')), 'Expected references/');
  assert.ok(fs.existsSync(path.join(skillDir, 'assets')), 'Expected assets/');
});

test('createSkill: skill.json name field uses Title Case', () => {
  const skillDir = path.join(tmpBase, 'my-unit-skill');
  const skillJson = JSON.parse(fs.readFileSync(path.join(skillDir, 'skill.json'), 'utf8'));
  assert.strictEqual(skillJson.name, 'My Unit Skill');
});

test('createSkill: returns error for duplicate (does not overwrite)', () => {
  const result = createSkill('my-unit-skill', tmpBase);
  assert.strictEqual(result.success, false);
  assert.ok(result.error.includes('already exists'), `Expected already exists, got: ${result.error}`);
  assert.ok(result.hint.length > 0, 'Expected non-empty hint');
});

test('createSkill: error message and hint are label-free data (no embedded Error:/Hint: prefix)', () => {
  const result = createSkill('my-unit-skill', tmpBase);
  assert.ok(!result.error.startsWith('Error:'), 'error field should not start with "Error:"');
  assert.ok(!result.hint.startsWith('Hint:'), 'hint field should not start with "Hint:"');
});

// Cleanup tmp dir
fs.rmSync(tmpBase, { recursive: true, force: true });

// ─── CLI integration tests ─────────────────────────────────────────────────────
// These run from the repo root so CWD = project root — correct behavior
console.log('\n create-skill CLI integration tests\n');

// Task 5.3: Invalid name → kebab-case error
test('create-skill: rejects uppercase name with error', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-skill', 'InvalidName'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 1, 'Expected exit code 1');
  assert.ok(
    result.stderr.includes('kebab-case') || result.stdout.includes('kebab-case'),
    'Expected kebab-case error message'
  );
});

test('create-skill: rejects name with spaces', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-skill', 'my skill'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 1, 'Expected exit code 1');
});

test('create-skill: rejects name starting with number', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-skill', '1invalid'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 1, 'Expected exit code 1');
});

test('create-skill: rejects consecutive hyphens', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-skill', 'a--b'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 1, 'Expected exit code 1');
});

// Task 5.1: Successful creation
test('create-skill: creates skill directory and files', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-skill', TEST_SKILL], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 0, `Expected exit code 0, got ${result.status}. stderr: ${result.stderr}`);

  const output = result.stdout + result.stderr;
  assert.ok(output.includes(TEST_SKILL), 'Expected skill name in output');

  // Verify directory structure
  assert.ok(fs.existsSync(TEST_SKILL_DIR), `Expected skills/${TEST_SKILL}/ to exist`);
  assert.ok(fs.existsSync(path.join(TEST_SKILL_DIR, 'skill.json')), 'Expected skill.json');
  assert.ok(fs.existsSync(path.join(TEST_SKILL_DIR, 'SKILL.md')), 'Expected SKILL.md');
  assert.ok(fs.existsSync(path.join(TEST_SKILL_DIR, 'templates')), 'Expected templates/ dir');
  assert.ok(fs.existsSync(path.join(TEST_SKILL_DIR, 'references')), 'Expected references/ dir');
  assert.ok(fs.existsSync(path.join(TEST_SKILL_DIR, 'assets')), 'Expected assets/ dir');
});

test('create-skill: success output mentions MANIFEST.yaml', () => {
  // Re-run on a fresh name to capture success output
  const tmpSkill = 'test-manifest-hint';
  const tmpSkillDir = path.join(SKILLS_DIR, tmpSkill);
  try {
    const result = spawnSync('node', [CLI_PATH, 'create-skill', tmpSkill], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
    assert.strictEqual(result.status, 0, `Expected exit code 0. stderr: ${result.stderr}`);
    assert.ok(result.stdout.includes('MANIFEST'), 'Expected MANIFEST.yaml mention in output');
  } finally {
    if (fs.existsSync(tmpSkillDir)) fs.rmSync(tmpSkillDir, { recursive: true, force: true });
  }
});

test('create-skill: skill.json has correct structure', () => {
  const skillJsonPath = path.join(TEST_SKILL_DIR, 'skill.json');
  const skillJson = JSON.parse(fs.readFileSync(skillJsonPath, 'utf8'));

  assert.strictEqual(skillJson.name, 'Test Scaffold Skill', `Expected 'Test Scaffold Skill', got '${skillJson.name}'`);
  assert.strictEqual(skillJson.version, '1.0.0', 'Expected version 1.0.0');
  assert.strictEqual(skillJson.description, '', 'Expected empty description');
  assert.strictEqual(skillJson.category, 'workflow', 'Expected default category workflow');
  assert.strictEqual(skillJson.always_load, false, 'Expected always_load false');
  assert.ok(Array.isArray(skillJson.tags), 'Expected tags to be array');
  assert.strictEqual(skillJson.tags.length, 0, 'Expected empty tags');
});

test('create-skill: SKILL.md has template structure', () => {
  const skillMdPath = path.join(TEST_SKILL_DIR, 'SKILL.md');
  const content = fs.readFileSync(skillMdPath, 'utf8');

  assert.ok(content.includes('# Test Scaffold Skill'), 'Expected heading with skill name');
  assert.ok(content.includes('## Policies'), 'Expected Policies section');
  assert.ok(content.includes('## References'), 'Expected References section');
});

// Task 5.2: Duplicate detection
test('create-skill: rejects duplicate skill name', () => {
  const result = spawnSync('node', [CLI_PATH, 'create-skill', TEST_SKILL], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 1, 'Expected exit code 1 for duplicate');
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('already exists'), 'Expected already exists message');
  assert.ok(output.includes('Hint:'), 'Expected Hint message');
});

// Task 5.4: Skill name appears in list output (M4 fix — real assertion)
test('create-skill: new skill name appears in list output', () => {
  const result = spawnSync('node', [CLI_PATH, 'list'], { encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.strictEqual(result.status, 0, 'Expected exit code 0');
  // listSkills() reads from skills/ directory — scaffolded skill's name or id should appear
  assert.ok(
    result.stdout.includes(TEST_SKILL),
    `Expected '${TEST_SKILL}' to appear in list output`
  );
});

// Cleanup
cleanup();

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
  process.exit(1);
}
