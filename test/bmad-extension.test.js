#!/usr/bin/env node
/**
 * Tests for BMAD Extension Module and Built-in Agent Customizations
 *
 * Story 8.3: Extension module structure (module.yaml, module-help.csv, workflows)
 * Story 15.6: Built-in agent customizations separated to lib/bmad-customize/
 *
 * Validates extension module files, directory structure, built-in customize.yaml
 * contents, and deployment logic in bmad.js.
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
const customizeDir = path.join(__dirname, '..', 'lib', 'bmad-customize');

// ─── AC #1: Extension module structure (module.yaml, module-help.csv, workflows) ──

console.log('\nAC #1 — Extension module structure');

test('1.1: lib/bmad-extension/ directory exists', () => {
  assert.ok(fs.existsSync(extDir), 'lib/bmad-extension/ must exist');
});

test('1.2: lib/bmad-extension/agents/ has no .customize.yaml files (Story 15.6)', () => {
  const agentsDir = path.join(extDir, 'agents');
  // bmad-method may recreate an empty agents/ dir when processing --custom-content,
  // so we check for absence of customize files, not absence of the directory itself.
  if (fs.existsSync(agentsDir)) {
    const files = fs.readdirSync(agentsDir).filter(f => f.endsWith('.customize.yaml'));
    assert.strictEqual(files.length, 0, `agents/ must have 0 .customize.yaml files, found ${files.length}`);
  }
  // If directory doesn't exist, that's also correct
});

test('1.3: module.yaml exists with extends-module: bmm', () => {
  const filePath = path.join(extDir, 'module.yaml');
  assert.ok(fs.existsSync(filePath), 'module.yaml must exist');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('extends-module: bmm'), 'module.yaml must declare extends-module: bmm');
  assert.ok(content.includes('name: "MA-Agents Skills & Agents"'), 'module.yaml must have name: "MA-Agents Skills & Agents"');
});

test('1.4: module-help.csv exists', () => {
  const filePath = path.join(extDir, 'module-help.csv');
  assert.ok(fs.existsSync(filePath), 'module-help.csv must exist');
});

test('1.5: workflows/ directory exists in extension module', () => {
  const workflowsDir = path.join(extDir, 'workflows');
  assert.ok(fs.existsSync(workflowsDir), 'lib/bmad-extension/workflows/ must exist');
});

// ─── AC #2: 8 built-in agents in lib/bmad-customize/ with critical_actions only ──

console.log('\nAC #2 — Built-in agent customizations in lib/bmad-customize/');

test('2.1: lib/bmad-customize/ directory exists', () => {
  assert.ok(fs.existsSync(customizeDir), 'lib/bmad-customize/ must exist');
});

const builtinAgents = [
  'bmm-pm', 'bmm-architect', 'bmm-dev',
  'bmm-sm', 'bmm-tech-writer', 'bmm-ux-designer', 'bmm-bmad-master'
];

test('2.2: lib/bmad-customize/ contains exactly 8 .customize.yaml files', () => {
  const files = fs.readdirSync(customizeDir).filter(f => f.endsWith('.customize.yaml'));
  assert.strictEqual(files.length, 8, `Expected 8 .customize.yaml files, found ${files.length}`);
});

for (const agentId of builtinAgents) {
  test(`2.3-${agentId}: ${agentId}.customize.yaml exists with correct content`, () => {
    const filePath = path.join(customizeDir, `${agentId}.customize.yaml`);
    assert.ok(fs.existsSync(filePath), `${agentId}.customize.yaml must exist`);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Must have critical_actions
    assert.ok(content.includes('critical_actions:'), `${agentId} must have critical_actions`);

    // Must use 6.2.0 array syntax (- "...") not numbered keys (1: "...")
    assert.ok(content.includes('  - "'), `${agentId} must use array syntax (- "...")`);
    assert.ok(!content.match(/^\s+\d+:/m), `${agentId} must NOT use numbered key syntax`);

    // Must NOT have persona or menu
    assert.ok(!content.includes('persona:'), `${agentId} must NOT have persona section`);
    assert.ok(!content.includes('menu:'), `${agentId} must NOT have menu section`);

    // Must reference project-level skills/MANIFEST.yaml
    assert.ok(content.includes('skills/MANIFEST.yaml'), `${agentId} must reference project-level skills/MANIFEST.yaml`);

    // Must have all 4 critical actions
    assert.ok(content.includes('Read the skills MANIFEST'), `${agentId} must have MANIFEST read action`);
    assert.ok(content.includes('always_load: true'), `${agentId} must reference always_load`);
    assert.ok(content.includes('project-context.md'), `${agentId} must reference project-context.md`);
    assert.ok(content.includes('Follow all skill directives'), `${agentId} must have follow directives action`);

    // Must have agent-specific comment header
    assert.ok(content.includes(`MA-AGENTS: skill enforcement for ${agentId}`),
      `${agentId} must have agent-specific comment header`);
  });
}

// ─── AC #3: bmad.js has extension and customize deployment stages ─────────

console.log('\nAC #3 — bmad.js deployment logic');

test('3.1: bmad.js contains extension deployment code', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("'bmad-extension'"), 'bmad.js must reference bmad-extension source dir');
  assert.ok(bmadSrc.includes("'extensions'"), 'bmad.js must reference extensions target dir');
  assert.ok(bmadSrc.includes("'ma-agents-skills'"), 'bmad.js must reference ma-agents-skills');
});

test('3.2: bmad.js contains customize deployment code', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("'bmad-customize'"), 'bmad.js must reference bmad-customize source dir');
  assert.ok(bmadSrc.includes('Applied built-in customization'), 'bmad.js must log built-in customization deployment');
});

test('3.3: extension deployment uses path.join for all paths', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("path.join(__dirname, 'bmad-extension')"),
    'extensionSource must use path.join');
  assert.ok(bmadSrc.includes("path.join(projectRoot, BMAD_DIR, 'extensions', 'ma-agents-skills')"),
    'extensionTarget must use path.join');
});

test('3.4: customize deployment uses path.join for source', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("path.join(__dirname, 'bmad-customize')"),
    'customizeSource must use path.join');
});

test('3.5: deployment order is RECOMPILE > EXTENSION > CUSTOMIZE > WORKFLOWS', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  const recompileIdx = bmadSrc.indexOf('STAGE:RECOMPILE');
  const extensionIdx = bmadSrc.indexOf('STAGE:EXTENSION');
  const customizeIdx = bmadSrc.indexOf('STAGE:CUSTOMIZE');
  const workflowIdx = bmadSrc.indexOf('STAGE:WORKFLOWS');

  assert.ok(recompileIdx > 0, 'STAGE:RECOMPILE marker must exist');
  assert.ok(extensionIdx > 0, 'STAGE:EXTENSION marker must exist');
  assert.ok(customizeIdx > 0, 'STAGE:CUSTOMIZE marker must exist');
  assert.ok(workflowIdx > 0, 'STAGE:WORKFLOWS marker must exist');
  assert.ok(extensionIdx > recompileIdx, 'extension deployment must come after recompile');
  assert.ok(customizeIdx > extensionIdx, 'customize deployment must come after extension');
  assert.ok(customizeIdx < workflowIdx, 'customize deployment must come before workflows');
});

test('3.6: extension deployment logs with chalk.cyan', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("chalk.cyan('    + Deployed BMAD extension module: ma-agents-skills')"),
    'must log deployment with chalk.cyan');
});

test('3.7: bmad-customizations retains platform and generic files (agent files removed in Epic 15)', () => {
  const customDir = path.join(__dirname, '..', 'lib', 'bmad-customizations');
  // Platform-specific and generic files must still exist
  const expectedFiles = ['claude-code', 'cursor', 'cline', 'gemini', 'generic', 'antigravity'];
  for (const name of expectedFiles) {
    const filePath = path.join(customDir, `${name}.customize.yaml`);
    assert.ok(fs.existsSync(filePath), `${name}.customize.yaml must still exist in bmad-customizations/`);
  }
  // Custom agent files (bmm-sre, bmm-devops, etc.) were removed — now in skill folders
  const removedAgents = ['bmm-sre', 'bmm-devops', 'bmm-cyber', 'bmm-qa'];
  for (const id of removedAgents) {
    const filePath = path.join(customDir, `${id}.customize.yaml`);
    assert.ok(!fs.existsSync(filePath), `${id}.customize.yaml should NOT exist in bmad-customizations/ (moved to skill folders)`);
  }
});

// ─── Integration tests — actual fs.copy deployment ───────────────────────

console.log('\nIntegration — applyCustomizations() deployment');

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
  });

  await asyncTest('INT-2: applyCustomizations deploys built-in customizations to _bmad/_config/agents/', async () => {
    // Verify built-in customizations were deployed to config dir
    const configAgentsDir = path.join(tmpDir, '_bmad', '_config', 'agents');

    for (const agentId of builtinAgents) {
      const deployedFile = path.join(configAgentsDir, `${agentId}.customize.yaml`);
      assert.ok(fsExtra.existsSync(deployedFile),
        `${agentId}.customize.yaml must be deployed to _bmad/_config/agents/`);

      const content = fsExtra.readFileSync(deployedFile, 'utf-8');
      assert.ok(content.includes('critical_actions:'),
        `deployed ${agentId}.customize.yaml must contain critical_actions`);
      assert.ok(content.includes('skills/MANIFEST.yaml'),
        `deployed ${agentId}.customize.yaml must reference skills/MANIFEST.yaml`);
    }
  });

  await asyncTest('INT-3: deployed customizations use array syntax not numbered keys', async () => {
    const configAgentsDir = path.join(tmpDir, '_bmad', '_config', 'agents');

    for (const agentId of builtinAgents) {
      const deployedFile = path.join(configAgentsDir, `${agentId}.customize.yaml`);
      const content = fsExtra.readFileSync(deployedFile, 'utf-8');
      assert.ok(content.includes('  - "'), `deployed ${agentId} must use array syntax`);
      assert.ok(!content.match(/^\s+\d+:/m), `deployed ${agentId} must NOT use numbered keys`);
    }
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
