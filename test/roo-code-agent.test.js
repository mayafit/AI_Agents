#!/usr/bin/env node
/**
 * Tests for Story 18.1: Register Roo Code Agent in Registry
 *
 * Validates that the roo-code agent entry conforms to the required schema
 * and resolves correctly through the existing config-driven registry pattern.
 */
'use strict';

const assert = require('assert');

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

const { getAllAgents, getAgent, getAgentsByCategory } = require('../lib/agents');
const allAgents = getAllAgents();
const rooCode = getAgent('roo-code');

// --- Schema validation ---

console.log('\nRoo Code agent schema validation');

test('roo-code agent exists in registry', () => {
  assert.ok(rooCode, 'roo-code agent should exist in the registry');
});

test('id is "roo-code"', () => {
  assert.strictEqual(rooCode.id, 'roo-code');
});

test('name is "Roo Code"', () => {
  assert.strictEqual(rooCode.name, 'Roo Code');
});

test('category is "ide"', () => {
  assert.strictEqual(rooCode.category, 'ide');
});

test('getProjectPath is a function', () => {
  assert.strictEqual(typeof rooCode.getProjectPath, 'function',
    'getProjectPath should be a function');
});

test('getGlobalPath is a function', () => {
  assert.strictEqual(typeof rooCode.getGlobalPath, 'function',
    'getGlobalPath should be a function');
});

test('getProjectPath returns path ending in .roo/skills', () => {
  const projectPath = rooCode.getProjectPath();
  assert.ok(
    projectPath.endsWith('.roo/skills') || projectPath.endsWith('.roo\\skills'),
    `Expected path ending in .roo/skills, got: ${projectPath}`
  );
});

test('getGlobalPath returns a non-empty string', () => {
  const globalPath = rooCode.getGlobalPath();
  assert.strictEqual(typeof globalPath, 'string');
  assert.ok(globalPath.length > 0, 'getGlobalPath should return a non-empty string');
});

test('getGlobalPath contains roo-cline (VS Code extension storage convention)', () => {
  const globalPath = rooCode.getGlobalPath();
  assert.ok(
    globalPath.includes('roo-cline'),
    `Expected global path to contain 'roo-cline', got: ${globalPath}`
  );
});

test('fileExtension is ".md"', () => {
  assert.strictEqual(rooCode.fileExtension, '.md');
});

test('description is a non-empty string', () => {
  assert.strictEqual(typeof rooCode.description, 'string',
    'description should be a string');
  assert.ok(rooCode.description.length > 0, 'description should not be empty');
});

test('description mentions Cline fork lineage', () => {
  assert.ok(rooCode.description.includes('Cline'),
    `description should mention Cline fork lineage, got: ${rooCode.description}`);
});

test('template is "generic"', () => {
  assert.strictEqual(rooCode.template, 'generic');
});

test('skillsDir is ".roo/skills"', () => {
  assert.strictEqual(rooCode.skillsDir, '.roo/skills');
});

test('instructionFiles is a non-empty array', () => {
  assert.ok(Array.isArray(rooCode.instructionFiles),
    'instructionFiles should be an array');
  assert.ok(rooCode.instructionFiles.length > 0,
    'instructionFiles should not be empty');
});

test('instructionFiles targets .roo/rules/ directory', () => {
  const hasRooRules = rooCode.instructionFiles.some(f =>
    f.includes('.roo/rules/') || f.includes('.roo\\rules\\')
  );
  assert.ok(hasRooRules,
    `instructionFiles should target .roo/rules/ directory, got: ${rooCode.instructionFiles}`);
});

test('injectionStrategy is an object', () => {
  assert.ok(rooCode.injectionStrategy && typeof rooCode.injectionStrategy === 'object',
    'injectionStrategy should be an object');
});

test('injectionStrategy.position is "top"', () => {
  assert.strictEqual(rooCode.injectionStrategy.position, 'top');
});

// --- Registry resolution ---

console.log('\nRoo Code agent resolution');

test('getAgent("roo-code") returns the agent', () => {
  const resolved = getAgent('roo-code');
  assert.ok(resolved, 'getAgent("roo-code") should return an agent object');
  assert.strictEqual(resolved.id, 'roo-code');
});

test('roo-code appears in getAllAgents()', () => {
  const ids = allAgents.map(a => a.id);
  assert.ok(ids.includes('roo-code'), 'roo-code should appear in getAllAgents()');
});

test('roo-code is in the ide category', () => {
  const ideAgents = getAgentsByCategory('ide');
  const ids = ideAgents.map(a => a.id);
  assert.ok(ids.includes('roo-code'), 'roo-code should be in ide category');
});

test('roo-code is distinct from cline', () => {
  const cline = getAgent('cline');
  assert.ok(cline, 'cline agent should still exist');
  assert.notStrictEqual(cline.id, rooCode.id, 'roo-code and cline should be different agents');
  assert.notStrictEqual(cline.skillsDir, rooCode.skillsDir,
    'roo-code and cline should use different skills directories');
});

// Print summary
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
