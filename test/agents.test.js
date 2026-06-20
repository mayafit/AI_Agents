#!/usr/bin/env node
/**
 * Tests for Story 7.1: Agent registry module (lib/agents.js)
 *
 * Exercises the four exports: getAgent, getAllAgents, getAgentsByCategory,
 * getBmadPlatformCode.
 *
 * Assertions are derived from getAllAgents() at runtime rather than
 * hardcoding magic counts: the registry has grown since the original
 * story (now 14 agents: 9 ide + 5 bmad) so the tests assert internal
 * consistency (categories partition the full set, no duplicate ids, etc.)
 * instead of brittle exact numbers.
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
    errors.push({ name, err });
  }
}

console.log('\nStory 7.1: Agent registry (lib/agents.js) Tests\n');

const agentsModule = require('../lib/agents');

// ---- Exports ----

console.log('Module exports');

test('getAgent is exported as a function', () => {
  assert.strictEqual(typeof agentsModule.getAgent, 'function');
});

test('getAllAgents is exported as a function', () => {
  assert.strictEqual(typeof agentsModule.getAllAgents, 'function');
});

test('getAgentsByCategory is exported as a function', () => {
  assert.strictEqual(typeof agentsModule.getAgentsByCategory, 'function');
});

test('getBmadPlatformCode is exported as a function', () => {
  assert.strictEqual(typeof agentsModule.getBmadPlatformCode, 'function');
});

// ---- getAllAgents() ----

console.log('\ngetAllAgents()');

const allAgents = agentsModule.getAllAgents();

test('getAllAgents returns an array', () => {
  assert.ok(Array.isArray(allAgents), 'expected an array');
});

test('getAllAgents returns a non-empty array', () => {
  assert.ok(allAgents.length > 0, `expected length > 0, got ${allAgents.length}`);
});

// Fields verified to exist on EVERY agent object in the registry.
const REQUIRED_STRING_FIELDS = [
  'id',
  'name',
  'category',
  'description',
  'skillsDir',
  'fileExtension',
  'template',
];

test('every agent has the required string fields', () => {
  allAgents.forEach((agent) => {
    REQUIRED_STRING_FIELDS.forEach((field) => {
      assert.ok(
        Object.prototype.hasOwnProperty.call(agent, field),
        `agent ${agent.id || '<unknown>'} is missing field '${field}'`
      );
      assert.strictEqual(
        typeof agent[field],
        'string',
        `agent ${agent.id || '<unknown>'} field '${field}' should be a string`
      );
      assert.ok(
        agent[field].length > 0,
        `agent ${agent.id || '<unknown>'} field '${field}' should be non-empty`
      );
    });
  });
});

test('every agent has getProjectPath and getGlobalPath functions', () => {
  allAgents.forEach((agent) => {
    assert.strictEqual(
      typeof agent.getProjectPath,
      'function',
      `agent ${agent.id} getProjectPath should be a function`
    );
    assert.strictEqual(
      typeof agent.getGlobalPath,
      'function',
      `agent ${agent.id} getGlobalPath should be a function`
    );
  });
});

test('every agent category is either "ide" or "bmad"', () => {
  allAgents.forEach((agent) => {
    assert.ok(
      agent.category === 'ide' || agent.category === 'bmad',
      `agent ${agent.id} has unexpected category '${agent.category}'`
    );
  });
});

// ---- No duplicate ids ----

console.log('\nUnique ids');

test('no duplicate agent id values', () => {
  const ids = allAgents.map((a) => a.id);
  const unique = new Set(ids);
  assert.strictEqual(
    unique.size,
    ids.length,
    `found duplicate ids among: ${ids.join(', ')}`
  );
});

// ---- getAgent() ----

console.log('\ngetAgent()');

// Use a real id discovered at runtime rather than hardcoding one.
const sampleAgent = allAgents[0];

test('getAgent returns the matching object for a real id', () => {
  const found = agentsModule.getAgent(sampleAgent.id);
  assert.ok(found, `expected an object for id '${sampleAgent.id}'`);
  assert.strictEqual(found.id, sampleAgent.id);
  // Identity check — registry returns the same object reference.
  assert.strictEqual(found, sampleAgent);
});

test('getAgent resolves every id in the registry', () => {
  allAgents.forEach((agent) => {
    const found = agentsModule.getAgent(agent.id);
    assert.strictEqual(
      found && found.id,
      agent.id,
      `getAgent('${agent.id}') did not return the matching agent`
    );
  });
});

test('getAgent returns undefined for a nonexistent id', () => {
  assert.strictEqual(agentsModule.getAgent('nonexistent'), undefined);
});

// ---- getAgentsByCategory() ----

console.log('\ngetAgentsByCategory()');

const ideAgents = agentsModule.getAgentsByCategory('ide');
const bmadAgents = agentsModule.getAgentsByCategory('bmad');

test('getAgentsByCategory("ide") returns a non-empty array', () => {
  assert.ok(Array.isArray(ideAgents), 'expected an array');
  assert.ok(ideAgents.length > 0, 'expected at least one ide agent');
});

test('getAgentsByCategory("bmad") returns a non-empty array', () => {
  assert.ok(Array.isArray(bmadAgents), 'expected an array');
  assert.ok(bmadAgents.length > 0, 'expected at least one bmad agent');
});

test('every ide agent actually has category "ide"', () => {
  ideAgents.forEach((agent) => {
    assert.strictEqual(agent.category, 'ide', `agent ${agent.id} not in ide`);
  });
});

test('every bmad agent actually has category "bmad"', () => {
  bmadAgents.forEach((agent) => {
    assert.strictEqual(agent.category, 'bmad', `agent ${agent.id} not in bmad`);
  });
});

test('ide + bmad categories partition the full registry (counts sum to total)', () => {
  // No other categories are allowed (asserted above), so the two known
  // categories must account for every agent. Derived, not hardcoded.
  assert.strictEqual(
    ideAgents.length + bmadAgents.length,
    allAgents.length,
    `ide(${ideAgents.length}) + bmad(${bmadAgents.length}) != total(${allAgents.length})`
  );
});

test('getAgentsByCategory returns an empty array for an unknown category', () => {
  const none = agentsModule.getAgentsByCategory('does-not-exist');
  assert.ok(Array.isArray(none), 'expected an array');
  assert.strictEqual(none.length, 0, 'expected no matches for unknown category');
});

// ---- getBmadPlatformCode() ----

console.log('\ngetBmadPlatformCode()');

test('getBmadPlatformCode returns the override when an agent defines bmadPlatformCode', () => {
  // Find any agent that declares an override and verify it is returned.
  const overridden = allAgents.find((a) => typeof a.bmadPlatformCode === 'string');
  assert.ok(overridden, 'expected at least one agent with a bmadPlatformCode override');
  assert.strictEqual(
    agentsModule.getBmadPlatformCode(overridden.id),
    overridden.bmadPlatformCode,
    `expected override '${overridden.bmadPlatformCode}' for ${overridden.id}`
  );
});

test('getBmadPlatformCode falls back to the agent id when no override is defined', () => {
  const plain = allAgents.find((a) => typeof a.bmadPlatformCode !== 'string');
  assert.ok(plain, 'expected at least one agent without a bmadPlatformCode override');
  assert.strictEqual(
    agentsModule.getBmadPlatformCode(plain.id),
    plain.id,
    `expected fallback to id for ${plain.id}`
  );
});

test('getBmadPlatformCode falls back to the input for a nonexistent id', () => {
  assert.strictEqual(agentsModule.getBmadPlatformCode('nonexistent'), 'nonexistent');
});

// ---- Summary ----

console.log(`\n${passed} passed, ${failed} failed`);
if (errors.length > 0) {
  console.log('\nFailures:');
  errors.forEach(({ name, err }) => {
    console.log(`  ${name}:`);
    console.log(`    ${err.message}`);
  });
}
process.exit(failed > 0 ? 1 : 0);
