#!/usr/bin/env node
/**
 * Tests for Story 8.3: Create BMAD Extension Module Structure
 *
 * Validates extension module files, directory structure, customize.yaml contents,
 * and deployment logic in bmad.js.
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
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const extDir = path.join(__dirname, '..', 'lib', 'bmad-extension');
const agentsDir = path.join(extDir, 'agents');

// ─── AC #1: module.yaml, module-help.csv, and 11 agent files exist ──────────

console.log('\nAC #1 — Extension module structure');

test('1.1: lib/bmad-extension/ directory exists', () => {
  assert.ok(fs.existsSync(extDir), 'lib/bmad-extension/ must exist');
});

test('1.2: lib/bmad-extension/agents/ directory exists', () => {
  assert.ok(fs.existsSync(agentsDir), 'lib/bmad-extension/agents/ must exist');
});

test('1.3: module.yaml exists with extends-module: bmm', () => {
  const filePath = path.join(extDir, 'module.yaml');
  assert.ok(fs.existsSync(filePath), 'module.yaml must exist');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('extends-module: bmm'), 'module.yaml must declare extends-module: bmm');
  assert.ok(content.includes('name: ma-agents-skills'), 'module.yaml must have name: ma-agents-skills');
});

test('1.4: module-help.csv exists', () => {
  const filePath = path.join(extDir, 'module-help.csv');
  assert.ok(fs.existsSync(filePath), 'module-help.csv must exist');
});

test('1.5: agents/ contains exactly 11 .customize.yaml files', () => {
  const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.customize.yaml'));
  assert.strictEqual(files.length, 11, `Expected 11 .customize.yaml files, found ${files.length}`);
});

// ─── AC #2: 4 custom agents have full customization + critical_actions ──────

console.log('\nAC #2 — Custom agents: persona + menu + critical_actions');

const customAgents = [
  { id: 'bmm-sre', slug: 'sre' },
  { id: 'bmm-devops', slug: 'devops' },
  { id: 'bmm-cyber', slug: 'cyber' },
  { id: 'bmm-mil498', slug: 'mil498' }
];

for (const agent of customAgents) {
  test(`2.${customAgents.indexOf(agent) + 1}: ${agent.id}.customize.yaml has persona, menu, AND critical_actions`, () => {
    const filePath = path.join(agentsDir, `${agent.id}.customize.yaml`);
    assert.ok(fs.existsSync(filePath), `${agent.id}.customize.yaml must exist`);
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('persona:'), `${agent.id} must have persona section`);
    assert.ok(content.includes('menu:'), `${agent.id} must have menu section`);
    assert.ok(content.includes('critical_actions:'), `${agent.id} must have critical_actions section`);
    assert.ok(content.includes(`skills/${agent.slug}/MANIFEST.yaml`),
      `${agent.id} critical_actions must reference skills/${agent.slug}/MANIFEST.yaml`);
  });
}

test('2.5: custom agent critical_actions have all 3 steps', () => {
  for (const agent of customAgents) {
    const content = fs.readFileSync(path.join(agentsDir, `${agent.id}.customize.yaml`), 'utf-8');
    assert.ok(content.includes('1:'), `${agent.id} must have step 1`);
    assert.ok(content.includes('2:'), `${agent.id} must have step 2`);
    assert.ok(content.includes('3:'), `${agent.id} must have step 3`);
    assert.ok(content.includes('always_load: true'), `${agent.id} step 2 must reference always_load`);
    assert.ok(content.includes('Follow all skill directives'), `${agent.id} step 3 must follow directives`);
  }
});

// ─── AC #3: 7 built-in agents have ONLY critical_actions ────────────────────

console.log('\nAC #3 — Built-in agents: critical_actions only');

const builtinAgents = [
  'bmm-pm', 'bmm-architect', 'bmm-dev', 'bmm-qa',
  'bmm-sm', 'bmm-tech-writer', 'bmm-ux-designer'
];

for (const agentId of builtinAgents) {
  test(`3.${builtinAgents.indexOf(agentId) + 1}: ${agentId}.customize.yaml has ONLY critical_actions (no persona/menu)`, () => {
    const filePath = path.join(agentsDir, `${agentId}.customize.yaml`);
    assert.ok(fs.existsSync(filePath), `${agentId}.customize.yaml must exist`);
    const content = fs.readFileSync(filePath, 'utf-8');

    assert.ok(content.includes('critical_actions:'), `${agentId} must have critical_actions`);
    assert.ok(!content.includes('persona:'), `${agentId} must NOT have persona section`);
    assert.ok(!content.includes('menu:'), `${agentId} must NOT have menu section`);
    assert.ok(content.includes('skills/MANIFEST.yaml'), `${agentId} must reference project-level skills/MANIFEST.yaml`);
  });
}

// ─── AC #4: bmad.js has extension deployment stage ──────────────────────────

console.log('\nAC #4 — bmad.js extension deployment');

test('4.1: bmad.js contains extension deployment code', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("'bmad-extension'"), 'bmad.js must reference bmad-extension source dir');
  assert.ok(bmadSrc.includes("'extensions'"), 'bmad.js must reference extensions target dir');
  assert.ok(bmadSrc.includes("'ma-agents-skills'"), 'bmad.js must reference ma-agents-skills');
});

test('4.2: extension deployment uses path.join for all paths', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("path.join(__dirname, 'bmad-extension')"),
    'extensionSource must use path.join');
  assert.ok(bmadSrc.includes("path.join(projectRoot, BMAD_DIR, 'extensions', 'ma-agents-skills')"),
    'extensionTarget must use path.join');
});

test('4.3: extension deployment is AFTER recompile and BEFORE workflows', () => {
  // Uses STAGE: markers in bmad.js comments — these are test-coupled anchors (see M2 review)
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  const recompileIdx = bmadSrc.indexOf('STAGE:RECOMPILE');
  const extensionIdx = bmadSrc.indexOf('STAGE:EXTENSION');
  const workflowIdx = bmadSrc.indexOf('STAGE:WORKFLOWS');

  assert.ok(recompileIdx > 0, 'STAGE:RECOMPILE marker must exist');
  assert.ok(extensionIdx > 0, 'STAGE:EXTENSION marker must exist');
  assert.ok(workflowIdx > 0, 'STAGE:WORKFLOWS marker must exist');
  assert.ok(extensionIdx > recompileIdx, 'extension deployment must come after recompile');
  assert.ok(extensionIdx < workflowIdx, 'extension deployment must come before workflows');
});

test('4.4: extension deployment logs with chalk.cyan', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("chalk.cyan('    + Deployed BMAD extension module: ma-agents-skills')"),
    'must log deployment with chalk.cyan');
});

test('4.5: existing bmad-customizations files are preserved (backward compatibility)', () => {
  const customDir = path.join(__dirname, '..', 'lib', 'bmad-customizations');
  for (const agent of customAgents) {
    const filePath = path.join(customDir, `${agent.id}.customize.yaml`);
    assert.ok(fs.existsSync(filePath), `${agent.id}.customize.yaml must still exist in bmad-customizations/`);
  }
});

// ─── M3: Integration test — actual fs.copy deployment ───────────────────────

console.log('\nIntegration — applyCustomizations() deploys extension');

const fsExtra = require('fs-extra');
const os = require('os');
const { applyCustomizations } = require('../lib/bmad');

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

async function runIntegrationTests() {
  const tmpDir = path.join(os.tmpdir(), `bmad-ext-test-${Date.now()}`);

  await asyncTest('INT-1: applyCustomizations deploys extension module to target directory', async () => {
    // Set up minimal BMAD structure so applyCustomizations doesn't fail on missing dirs
    await fsExtra.ensureDir(path.join(tmpDir, '_bmad', '_config', 'agents'));
    await fsExtra.ensureDir(path.join(tmpDir, '_bmad', 'custom', 'agents'));
    await fsExtra.ensureDir(path.join(tmpDir, '_bmad', 'bmm', 'agents'));

    // Run applyCustomizations — recompile will fail (no BMAD installed in temp) but
    // extension deployment happens after recompile regardless of recompile outcome
    await applyCustomizations(tmpDir, ['bmm'], [], []);

    // Verify extension was deployed
    const deployedModule = path.join(tmpDir, '_bmad', 'extensions', 'ma-agents-skills', 'module.yaml');
    assert.ok(fsExtra.existsSync(deployedModule),
      `module.yaml must exist at ${deployedModule}`);

    const content = fsExtra.readFileSync(deployedModule, 'utf-8');
    assert.ok(content.includes('extends-module: bmm'),
      'deployed module.yaml must contain extends-module: bmm');

    // Verify agent files deployed
    const deployedAgents = path.join(tmpDir, '_bmad', 'extensions', 'ma-agents-skills', 'agents');
    assert.ok(fsExtra.existsSync(deployedAgents), 'agents/ directory must be deployed');
    const files = fsExtra.readdirSync(deployedAgents).filter(f => f.endsWith('.customize.yaml'));
    assert.strictEqual(files.length, 11, `Expected 11 deployed agent files, found ${files.length}`);
  });

  // Cleanup
  await fsExtra.remove(tmpDir);

  printSummary();
}

function printSummary() {
// ─── Summary ────────────────────────────────────────────────────────────────

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    for (const { name, error } of errors) {
      console.log(`  ${name}: ${error}`);
    }
  }
  process.exit(failed > 0 ? 1 : 0);
}

runIntegrationTests();
