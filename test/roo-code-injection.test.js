#!/usr/bin/env node
/**
 * Tests for Story 18.3: Roo Code Rules Injection
 *
 * Validates that updateAgentInstructions() correctly creates/updates
 * planning instructions in .roo/rules/00-ma-agents.md for Roo Code.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
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

const { _testUpdateAgentInstructions: updateAgentInstructions } = require('../lib/installer');
const { getAgent } = require('../lib/agents');

// --- Roo Code rules injection tests ---

console.log('\nRoo Code rules injection');

let tmpDir;

async function setup() {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roo-code-test-'));
}

async function cleanup() {
  if (tmpDir) {
    await fs.remove(tmpDir);
  }
}

(async () => {
  await setup();

  const rooCode = getAgent('roo-code');

  await asyncTest('creates .roo/rules/ directory and 00-ma-agents.md when absent', async () => {
    const projectRoot = path.join(tmpDir, 'project-create');
    await fs.ensureDir(projectRoot);

    // Create a mock roo-code agent with paths relative to tmpDir
    const agent = {
      ...rooCode,
      getProjectPath: () => path.join(projectRoot, '.roo', 'skills'),
      instructionFiles: ['.roo/rules/00-ma-agents.md'],
      injectionStrategy: { position: 'top', skipPatterns: ['---'] }
    };

    await updateAgentInstructions(agent, projectRoot);

    const filePath = path.join(projectRoot, '.roo', 'rules', '00-ma-agents.md');
    assert.ok(await fs.pathExists(filePath), '.roo/rules/00-ma-agents.md should be created');

    const content = await fs.readFile(filePath, 'utf-8');
    assert.ok(content.includes('<!-- MA-AGENTS-START -->'), 'should contain start marker');
    assert.ok(content.includes('<!-- MA-AGENTS-END -->'), 'should contain end marker');
    assert.ok(content.includes('MANIFEST.yaml'), 'should reference MANIFEST.yaml');
    assert.ok(content.includes('.roo/skills/MANIFEST.yaml'), 'should use .roo/skills/ path');
  });

  await asyncTest('updates existing content with markers in place (idempotent)', async () => {
    const projectRoot = path.join(tmpDir, 'project-update');
    await fs.ensureDir(projectRoot);

    // Pre-create file with old markers
    const rulesDir = path.join(projectRoot, '.roo', 'rules');
    await fs.ensureDir(rulesDir);
    const filePath = path.join(rulesDir, '00-ma-agents.md');
    await fs.writeFile(filePath, '<!-- MA-AGENTS-START -->\nOLD CONTENT\n<!-- MA-AGENTS-END -->\n');

    const agent = {
      ...rooCode,
      getProjectPath: () => path.join(projectRoot, '.roo', 'skills'),
      instructionFiles: ['.roo/rules/00-ma-agents.md'],
      injectionStrategy: { position: 'top', skipPatterns: ['---'] }
    };

    await updateAgentInstructions(agent, projectRoot);

    const content = await fs.readFile(filePath, 'utf-8');
    assert.ok(!content.includes('OLD CONTENT'), 'old content should be replaced');
    assert.ok(content.includes('MANIFEST.yaml'), 'should contain updated instruction');
    // Verify only one set of markers
    const startCount = (content.match(/<!-- MA-AGENTS-START -->/g) || []).length;
    assert.strictEqual(startCount, 1, 'should have exactly one start marker');
  });

  await asyncTest('preserves user content when injecting into existing file', async () => {
    const projectRoot = path.join(tmpDir, 'project-preserve');
    await fs.ensureDir(projectRoot);

    // Pre-create file with user content but no markers
    const rulesDir = path.join(projectRoot, '.roo', 'rules');
    await fs.ensureDir(rulesDir);
    const filePath = path.join(rulesDir, '00-ma-agents.md');
    await fs.writeFile(filePath, '# User Custom Rules\n\nAlways use TypeScript.\n');

    const agent = {
      ...rooCode,
      getProjectPath: () => path.join(projectRoot, '.roo', 'skills'),
      instructionFiles: ['.roo/rules/00-ma-agents.md'],
      injectionStrategy: { position: 'top', skipPatterns: ['---'] }
    };

    await updateAgentInstructions(agent, projectRoot);

    const content = await fs.readFile(filePath, 'utf-8');
    assert.ok(content.includes('<!-- MA-AGENTS-START -->'), 'should contain markers');
    assert.ok(content.includes('Always use TypeScript'), 'should preserve user content');
  });

  await cleanup();

  // Print summary
  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailed tests:');
    errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
  }
  if (failed > 0) process.exit(1);
})();
