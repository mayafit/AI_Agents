#!/usr/bin/env node
/**
 * Tests for Story 9.1: Register OpenCode Agent in Registry
 *
 * Validates that the opencode agent entry conforms to the required schema
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
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const { getAllAgents, getAgent } = require('../lib/agents');
const allAgents = getAllAgents();
const opencode = getAgent('opencode');

// ─── Schema validation ────────────────────────────────────────────────────────

console.log('\nOpenCode agent schema validation');

test('opencode agent exists in registry', () => {
  assert.ok(opencode, 'opencode agent should exist in the registry');
});

test('id is "opencode"', () => {
  assert.strictEqual(opencode.id, 'opencode');
});

test('name is "OpenCode"', () => {
  assert.strictEqual(opencode.name, 'OpenCode');
});

test('category is "ide"', () => {
  assert.strictEqual(opencode.category, 'ide');
});

test('getProjectPath is a function', () => {
  assert.strictEqual(typeof opencode.getProjectPath, 'function',
    'getProjectPath should be a function');
});

test('getGlobalPath is a function', () => {
  assert.strictEqual(typeof opencode.getGlobalPath, 'function',
    'getGlobalPath should be a function');
});

test('getProjectPath returns path ending in .opencode/skills', () => {
  const projectPath = opencode.getProjectPath();
  assert.ok(
    projectPath.endsWith('.opencode/skills') || projectPath.endsWith('.opencode\\skills'),
    `Expected path ending in .opencode/skills, got: ${projectPath}`
  );
});

test('getGlobalPath returns a non-empty string', () => {
  const globalPath = opencode.getGlobalPath();
  assert.strictEqual(typeof globalPath, 'string');
  assert.ok(globalPath.length > 0, 'getGlobalPath should return a non-empty string');
});

test('getGlobalPath contains .opencode', () => {
  const globalPath = opencode.getGlobalPath();
  assert.ok(globalPath.includes('.opencode'),
    `Expected global path to contain '.opencode', got: ${globalPath}`);
});

test('fileExtension is ".md"', () => {
  assert.strictEqual(opencode.fileExtension, '.md');
});

test('template is "generic"', () => {
  assert.strictEqual(opencode.template, 'generic');
});

test('instructionFiles is a non-empty array', () => {
  assert.ok(Array.isArray(opencode.instructionFiles),
    'instructionFiles should be an array');
  assert.ok(opencode.instructionFiles.length > 0,
    'instructionFiles should not be empty');
});

test('instructionFiles contains "opencode.json"', () => {
  assert.ok(opencode.instructionFiles.includes('opencode.json'),
    'instructionFiles should include "opencode.json"');
});

test('injectionStrategy is an object', () => {
  assert.ok(opencode.injectionStrategy && typeof opencode.injectionStrategy === 'object',
    'injectionStrategy should be an object');
});

test('injectionStrategy.position is "json-merge"', () => {
  assert.strictEqual(opencode.injectionStrategy.position, 'json-merge');
});

test('injectionStrategy.targetKey is "instructions"', () => {
  assert.strictEqual(opencode.injectionStrategy.targetKey, 'instructions');
});

// ─── Registry resolution ──────────────────────────────────────────────────────

console.log('\nOpenCode agent resolution');

test('getAgent("opencode") returns the agent', () => {
  const resolved = getAgent('opencode');
  assert.ok(resolved, 'getAgent("opencode") should return an agent object');
  assert.strictEqual(resolved.id, 'opencode');
});

test('opencode appears in getAllAgents()', () => {
  const ids = allAgents.map(a => a.id);
  assert.ok(ids.includes('opencode'), 'opencode should appear in getAllAgents()');
});

test('opencode is the agent with id "opencode" in the full list', () => {
  const found = allAgents.find(a => a.id === 'opencode');
  assert.ok(found, 'opencode entry should be findable in allAgents array');
  assert.strictEqual(found.id, 'opencode');
});

// Print summary
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
