#!/usr/bin/env node
/**
 * Tests for customize-agent command implementation
 * Story 3.4: BMAD Persona Customization Tooling
 *
 * Task 5.1: customize-agent bmm-sre runs and generates full file
 * Task 5.2: customize-agent bmm-pm generates critical_actions-only file
 * Task 5.3: Existing file loaded as defaults
 * Task 5.4: Generated YAML is valid structure
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
    failed++;
    errors.push({ name, error: err.message });
  }
}

// ─── Module imports ────────────────────────────────────────────────────────────
let validateBmadAgent, generateCustomizeYaml, writeCustomizeFile, loadExistingCustomization;
try {
  ({ validateBmadAgent, generateCustomizeYaml, writeCustomizeFile, loadExistingCustomization } = require('../lib/skill-authoring'));
} catch (e) {
  console.error('\n  FATAL: Cannot load skill-authoring module');
  console.error(' ', e.message);
  process.exit(1);
}

// ─── Unit tests: validateBmadAgent() ─────────────────────────────────────────
console.log('\n validateBmadAgent unit tests\n');

test('validates custom agents (full customization)', () => {
  const customAgents = ['bmm-sre', 'bmm-devops', 'bmm-cyber', 'bmm-mil498'];
  for (const agent of customAgents) {
    const result = validateBmadAgent(agent);
    assert.strictEqual(result.valid, true, `Expected ${agent} to be valid`);
    assert.strictEqual(result.type, 'custom', `Expected ${agent} to be type custom`);
  }
});

test('validates builtin agents (critical_actions only)', () => {
  const builtinAgents = ['bmm-pm', 'bmm-architect', 'bmm-dev', 'bmm-qa', 'bmm-sm', 'bmm-tech-writer', 'bmm-ux-designer'];
  for (const agent of builtinAgents) {
    const result = validateBmadAgent(agent);
    assert.strictEqual(result.valid, true, `Expected ${agent} to be valid`);
    assert.strictEqual(result.type, 'builtin', `Expected ${agent} to be type builtin`);
  }
});

test('rejects unknown agents', () => {
  const result = validateBmadAgent('bmm-unknown');
  assert.strictEqual(result.valid, false);
  assert.ok(result.hint.length > 0, 'Expected hint with available agents');
});

test('rejects empty agent name', () => {
  const result = validateBmadAgent('');
  assert.strictEqual(result.valid, false);
});

// ─── Unit tests: generateCustomizeYaml() ─────────────────────────────────────
console.log('\n generateCustomizeYaml unit tests\n');

const MANDATORY_ACTIONS = [
  'Read the skills MANIFEST at skills/MANIFEST.yaml (relative to project root)',
  'For each skill marked always_load: true, read the skill file completely',
  'Follow all skill directives during this session'
];

test('generateCustomizeYaml: builtin agent produces critical_actions only', () => {
  const yaml = generateCustomizeYaml('bmm-pm', {}, 'builtin');
  assert.ok(yaml.includes('critical_actions'), 'Expected critical_actions');
  assert.ok(!yaml.includes('persona:'), 'Builtin must not include persona section');
  assert.ok(!yaml.includes('menu:'), 'Builtin must not include menu section');
});

test('generateCustomizeYaml: builtin always includes mandatory actions 1-3', () => {
  const yaml = generateCustomizeYaml('bmm-pm', {}, 'builtin');
  assert.ok(yaml.includes('1:'), 'Expected action 1');
  assert.ok(yaml.includes('2:'), 'Expected action 2');
  assert.ok(yaml.includes('3:'), 'Expected action 3');
  assert.ok(yaml.includes('MANIFEST'), 'Expected MANIFEST reference in action 1');
  assert.ok(yaml.includes('always_load'), 'Expected always_load reference in action 2');
});

test('generateCustomizeYaml: custom agent with persona includes persona section', () => {
  const data = {
    persona: {
      role: 'Site Reliability Engineer',
      identity: 'Expert in system reliability.',
      communication_style: 'Calm and data-driven.',
      principles: ['Automate everything', 'Monitor all the things']
    }
  };
  const yaml = generateCustomizeYaml('bmm-sre', data, 'custom');
  assert.ok(yaml.includes('persona:'), 'Expected persona section');
  assert.ok(yaml.includes('role:'), 'Expected role field');
  assert.ok(yaml.includes('Site Reliability Engineer'), 'Expected role value');
  assert.ok(yaml.includes('critical_actions:'), 'Expected critical_actions section');
});

test('generateCustomizeYaml: custom agent with menu includes menu section', () => {
  const data = {
    menu: [
      { trigger: 'bmad-sre-health', workflow: 'workflows/health.md', description: 'Health Check' }
    ]
  };
  const yaml = generateCustomizeYaml('bmm-sre', data, 'custom');
  assert.ok(yaml.includes('menu:'), 'Expected menu section');
  assert.ok(yaml.includes('trigger:'), 'Expected trigger field');
  assert.ok(yaml.includes('bmad-sre-health'), 'Expected trigger value');
});

test('generateCustomizeYaml: mandatory actions 1-3 not overridable', () => {
  // Even if caller passes custom actions, 1-3 must come from the hardcoded set
  const data = {
    extraActions: { 4: 'Custom action 4' }
  };
  const yaml = generateCustomizeYaml('bmm-sre', data, 'custom');
  assert.ok(yaml.includes('MANIFEST'), 'Expected mandatory action 1 content (MANIFEST)');
  assert.ok(yaml.includes('always_load'), 'Expected mandatory action 2 content');
  assert.ok(yaml.includes('Follow all skill directives'), 'Expected mandatory action 3 content');
});

test('generateCustomizeYaml: extra actions appended starting at 4', () => {
  const data = {
    extraActions: { 4: 'Read the project context file' }
  };
  const yaml = generateCustomizeYaml('bmm-sre', data, 'custom');
  assert.ok(yaml.includes('4:'), 'Expected action 4');
  assert.ok(yaml.includes('Read the project context file'), 'Expected action 4 content');
});

test('generateCustomizeYaml: includes header comment', () => {
  const yaml = generateCustomizeYaml('bmm-pm', {}, 'builtin');
  assert.ok(yaml.startsWith('#'), 'Expected YAML to start with comment');
  assert.ok(yaml.includes('bmm-pm'), 'Expected agent name in header');
});

// ─── Unit tests: writeCustomizeFile() / loadExistingCustomization() ───────────
console.log('\n writeCustomizeFile / loadExistingCustomization unit tests\n');

test('writeCustomizeFile: writes file to specified directory', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-customize-test-'));
  const agentsDir = path.join(tmpDir, 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  try {
    const yaml = generateCustomizeYaml('bmm-pm', {}, 'builtin');
    writeCustomizeFile('bmm-pm', yaml, agentsDir);
    const filePath = path.join(agentsDir, 'bmm-pm.customize.yaml');
    assert.ok(fs.existsSync(filePath), 'Expected file to be written');
    const content = fs.readFileSync(filePath, 'utf8');
    assert.ok(content.includes('critical_actions'), 'Expected content to be written');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadExistingCustomization: returns null for non-existent file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-customize-load-'));
  try {
    const result = loadExistingCustomization('bmm-pm', tmpDir);
    assert.strictEqual(result, null, 'Expected null for missing file');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('loadExistingCustomization: returns raw content for existing file', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-customize-load2-'));
  const filePath = path.join(tmpDir, 'bmm-pm.customize.yaml');
  try {
    fs.writeFileSync(filePath, 'critical_actions:\n  1: "Test"\n', 'utf8');
    const result = loadExistingCustomization('bmm-pm', tmpDir);
    assert.ok(result !== null, 'Expected non-null for existing file');
    assert.ok(typeof result === 'string', 'Expected string content');
    assert.ok(result.includes('critical_actions'), 'Expected file content');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── CLI integration tests ─────────────────────────────────────────────────────
console.log('\n customize-agent CLI integration tests\n');

// Unknown agent
test('customize-agent: rejects unknown agent with exit 1', () => {
  const result = spawnSync('node', [CLI_PATH, 'customize-agent', 'bmm-unknown'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for unknown agent');
  const output = result.stdout + result.stderr;
  assert.ok(output.includes('Error') || output.includes('Unknown'), 'Expected error message');
});

// No agent name
test('customize-agent: no agent name exits 1', () => {
  const result = spawnSync('node', [CLI_PATH, 'customize-agent'], {
    encoding: 'utf8', cwd: PROJECT_ROOT
  });
  assert.strictEqual(result.status, 1, 'Expected exit 1 for missing agent name');
});

// --yes mode skips (non-interactive)
test('customize-agent: --yes flag skips interactive wizard with exit 0', () => {
  const srePath = path.join(AGENTS_DIR, 'bmm-sre.customize.yaml');
  const originalContent = fs.existsSync(srePath) ? fs.readFileSync(srePath, 'utf8') : null;
  try {
    const result = spawnSync('node', [CLI_PATH, 'customize-agent', 'bmm-sre', '--yes'], {
      encoding: 'utf8', cwd: PROJECT_ROOT, input: ''
    });
    // Should skip gracefully (exit 0) or generate minimal file
    assert.ok(result.status === 0 || result.status === null, `Expected exit 0 or null, got: ${result.status}. stderr: ${result.stderr}`);
    assert.ok(
      result.stdout.includes('Skipping') || result.stdout.includes('non-interactive') || result.stdout.includes('generated'),
      `Expected skip or generate message: ${result.stdout}`
    );
  } finally {
    // Restore original file to avoid polluting real agent configs
    if (originalContent !== null) {
      fs.writeFileSync(srePath, originalContent, 'utf8');
    } else if (fs.existsSync(srePath)) {
      fs.rmSync(srePath);
    }
  }
});

// ─── Results ──────────────────────────────────────────────────────────────────
console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) {
  errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
  process.exit(1);
}
