#!/usr/bin/env node
/**
 * Tests for Story 8.2: Add Agent-Aware Injection Strategy to Registry
 *
 * Validates injectionStrategy is present on all agents and that installer.js
 * reads it without hardcoding agent-specific logic.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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

// ─── Task 3: Verify installer.js reads injectionStrategy ────────────────────

console.log('\nTask 3 — installer.js reads injectionStrategy');

test('3.1: updateAgentInstructions reads agent.injectionStrategy', () => {
  const installerSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'installer.js'), 'utf-8');
  assert.ok(installerSrc.includes('agent.injectionStrategy'),
    'installer.js should reference agent.injectionStrategy');
});

test('3.2: default fallback exists for undefined injectionStrategy', () => {
  const installerSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'installer.js'), 'utf-8');
  assert.ok(
    installerSrc.includes("agent.injectionStrategy || { position: 'top', skipPatterns: [] }"),
    'installer.js should have default fallback for missing injectionStrategy'
  );
});

test('3.3: installer.js contains NO agent-name-specific logic', () => {
  const installerSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'installer.js'), 'utf-8');
  const agentIds = allAgents.map(a => a.id);
  for (const id of agentIds) {
    // Use regex to check for conditional logic on agent IDs, not just string presence
    const idCheckPattern = new RegExp(`agent\\.id\\s*===\\s*['"\`]${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`);
    assert.ok(
      !idCheckPattern.test(installerSrc),
      `installer.js should not contain conditional check for agent id '${id}'`
    );
  }
});

// ─── Task 4: Validate registry completeness ─────────────────────────────────

console.log('\nTask 4 — Registry completeness');

const EXPECTED_IDE = ['claude-code', 'gemini', 'copilot', 'kilocode', 'cline', 'cursor', 'antigravity', 'opencode'];
const EXPECTED_BMAD = ['bmm-sre', 'bmm-devops', 'bmm-cyber', 'bmm-qa', 'bmm-demerzel'];
const EXPECTED_ALL = [...EXPECTED_IDE, ...EXPECTED_BMAD];

test('4.1: registry has at least 13 agents (8+ IDE + 5 BMAD)', () => {
  assert.ok(allAgents.length >= 13, `Expected at least 13 agents, got ${allAgents.length}`);
  const ideCount = allAgents.filter(a => a.category === 'ide').length;
  const bmadCount = allAgents.filter(a => a.category === 'bmad').length;
  assert.ok(ideCount >= 8, `Expected at least 8 IDE agents, got ${ideCount}`);
  assert.strictEqual(bmadCount, 5, `Expected 5 BMAD agents, got ${bmadCount}`);
});

test('4.2: every agent has well-shaped injectionStrategy property', () => {
  for (const agent of allAgents) {
    assert.ok(agent.injectionStrategy,
      `Agent '${agent.id}' is missing injectionStrategy`);
    assert.strictEqual(typeof agent.injectionStrategy.position, 'string',
      `Agent '${agent.id}' injectionStrategy.position should be a string`);
    // skipPatterns is only required for non-json-merge strategies
    if (agent.injectionStrategy.position !== 'json-merge') {
      assert.ok(Array.isArray(agent.injectionStrategy.skipPatterns),
        `Agent '${agent.id}' injectionStrategy.skipPatterns should be an array, got ${typeof agent.injectionStrategy.skipPatterns}`);
    }
  }
});

test('4.3: all agents with .md instruction files have skipPatterns: [---]', () => {
  for (const agent of allAgents) {
    // json-merge agents use a different injection mechanism; skip this check for them
    if (agent.injectionStrategy.position === 'json-merge') continue;
    const hasMdFiles = agent.instructionFiles.some(f => f.endsWith('.md'));
    if (hasMdFiles) {
      assert.ok(agent.injectionStrategy.skipPatterns,
        `Agent '${agent.id}' should have skipPatterns`);
      assert.ok(agent.injectionStrategy.skipPatterns.includes('---'),
        `Agent '${agent.id}' should have '---' in skipPatterns`);
    }
  }
});

test('4.3b: non-json-merge agents have position: top', () => {
  for (const agent of allAgents) {
    if (agent.injectionStrategy.position === 'json-merge') continue;
    assert.strictEqual(agent.injectionStrategy.position, 'top',
      `Agent '${agent.id}' should have position: 'top'`);
  }
});

test('4.4: all expected agent IDs are present', () => {
  const ids = allAgents.map(a => a.id);
  for (const expectedId of EXPECTED_ALL) {
    assert.ok(ids.includes(expectedId), `Missing expected agent: ${expectedId}`);
  }
});

// Print summary
console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailed tests:');
  errors.forEach(e => console.log(`  - ${e.name}: ${e.error}`));
}
if (failed > 0) process.exit(1);
