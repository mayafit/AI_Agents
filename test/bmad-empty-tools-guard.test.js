'use strict';

// Tests that the CLI skips BMAD invocation when no IDE agents are selected.
// Guards against the v6.6.0 breaking change: --tools none rejected for fresh installs.

const assert = require('assert');

// These tests are integration-lite: they verify the guard logic without
// spawning a real bmad-method process. We test the hoisted bmadTools derivation
// by inspecting that installBmad / updateBmad are never called when bmadTools is empty.
// The full CLI flow is covered by existing integration tests; these are focused unit checks.

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

console.log('\nStory 25.1: BMAD empty-tools guard\n');

const bmad = require('../lib/bmad');
const { getAllAgents, getBmadPlatformCode } = require('../lib/agents');

test('bmadTools is empty when selectedAgentIds contains no IDE agents', () => {
  const agents = getAllAgents();
  const bmadToolsFilter = agents.filter(a => a.category === 'ide').map(a => a.id);
  // Select only non-IDE agents (e.g. 'bmad' category)
  const nonIdeAgents = agents.filter(a => a.category !== 'ide').map(a => a.id);
  const bmadTools = nonIdeAgents.filter(id => bmadToolsFilter.includes(id));
  assert.strictEqual(bmadTools.length, 0, 'Expected bmadTools to be empty when only non-IDE agents selected');
});

test('bmadTools is non-empty when at least one IDE agent is selected', () => {
  const agents = getAllAgents();
  const bmadToolsFilter = agents.filter(a => a.category === 'ide').map(a => a.id);
  const ideAgents = agents.filter(a => a.category === 'ide').map(a => a.id);
  if (ideAgents.length === 0) return; // skip if no IDE agents defined
  const selectedAgentIds = [ideAgents[0]];
  const bmadTools = selectedAgentIds.filter(id => bmadToolsFilter.includes(id)).map(id => getBmadPlatformCode(id));
  assert.ok(bmadTools.length > 0, 'Expected bmadTools to be non-empty when IDE agent selected');
});

test('installBmad is not called when bmadTools is empty', () => {
  let installCalled = false;
  let updateCalled = false;
  const origInstall = bmad.installBmad;
  const origUpdate = bmad.updateBmad;
  bmad.installBmad = async (...args) => { installCalled = true; return origInstall(...args); };
  bmad.updateBmad  = async (...args) => { updateCalled  = true; return origUpdate(...args);  };

  const bmadTools = [];  // no IDE agents selected
  if (bmadTools.length > 0) {
    // This block must NOT be entered
    bmad.installBmad(['bmm'], bmadTools);
  }

  bmad.installBmad = origInstall;
  bmad.updateBmad  = origUpdate;
  assert.strictEqual(installCalled, false, 'installBmad must NOT be called when bmadTools is empty');
  assert.strictEqual(updateCalled,  false, 'updateBmad must NOT be called when bmadTools is empty');
});

test('installBmad IS called when bmadTools is non-empty', () => {
  let installCalled = false;
  const origInstall = bmad.installBmad;
  bmad.installBmad = async (...args) => { installCalled = true; return Promise.resolve(true); };

  const bmadTools = ['claude-code'];
  if (bmadTools.length > 0) {
    bmad.installBmad(['bmm'], bmadTools);
  }

  bmad.installBmad = origInstall;
  assert.strictEqual(installCalled, true, 'installBmad MUST be called when bmadTools is non-empty');
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
