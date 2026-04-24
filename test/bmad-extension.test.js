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

test('1.3: skills/module.yaml exists with extends-module: bmm (Story 22.5 moved it under skills/)', () => {
  const filePath = path.join(extDir, 'skills', 'module.yaml');
  assert.ok(fs.existsSync(filePath), 'skills/module.yaml must exist');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('extends-module: bmm'), 'module.yaml must declare extends-module: bmm');
  assert.ok(content.includes('name: "MA-Agents Skills & Agents"'), 'module.yaml must have name: "MA-Agents Skills & Agents"');
});

test('1.4: skills/module-help.csv exists (Story 22.5 moved it under skills/)', () => {
  const filePath = path.join(extDir, 'skills', 'module-help.csv');
  assert.ok(fs.existsSync(filePath), 'skills/module-help.csv must exist');
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

test('2.2: lib/bmad-customize/ contains exactly 9 .customize.yaml files', () => {
  // Story 22.3: bmm-quick-flow-solo-dev.customize.yaml was retired (Barry
  // consolidated into Amelia in BMAD v6.3.0 — upstream PR #2177). Count
  // dropped from 10 → 9.
  const files = fs.readdirSync(customizeDir).filter(f => f.endsWith('.customize.yaml'));
  assert.strictEqual(files.length, 9, `Expected 9 .customize.yaml files, found ${files.length}`);
  assert.ok(!files.includes('bmm-quick-flow-solo-dev.customize.yaml'),
    'bmm-quick-flow-solo-dev.customize.yaml must NOT be present (retired in Story 22.3)');
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

// ─── AC #3: bmad.js has extension source tree (post Story 22.6 stage-and-invoke) ──

console.log('\nAC #3 — bmad.js stage-and-invoke references');

test('3.1: bmad.js references the plugin stage dir constant', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  // Story 22.6 replaced ad-hoc extension staging with stage-and-invoke against
  // the committed plugin bundle. The source must reference the stage constant.
  assert.ok(bmadSrc.includes("PLUGIN_STAGE_DIR_NAME = '.ma-agents-plugin-stage'"),
    'bmad.js must declare PLUGIN_STAGE_DIR_NAME constant');
});

test('3.2: bmad.js references the plugin bundle via scripts/build-plugin OUT_DIR', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  assert.ok(bmadSrc.includes("require('../scripts/build-plugin')"),
    'bmad.js must require the build-plugin module to resolve OUT_DIR');
  assert.ok(bmadSrc.includes('OUT_DIR: pluginBundlePath'),
    'bmad.js must rename OUT_DIR to pluginBundlePath on import');
});

test('3.3: bmad.js exports stagePlugin and cleanupStage', () => {
  const bmad = require('../lib/bmad');
  assert.strictEqual(typeof bmad.stagePlugin, 'function',
    'stagePlugin must be exported');
  assert.strictEqual(typeof bmad.cleanupStage, 'function',
    'cleanupStage must be exported');
});

test('3.4: bmad.js no longer exports applyCustomizations', () => {
  const bmad = require('../lib/bmad');
  assert.strictEqual(typeof bmad.applyCustomizations, 'undefined',
    'applyCustomizations must NOT be exported — replaced by stage-and-invoke (Story 22.6)');
});

test('3.5: bmad.js no longer hand-parses manifest.yaml or files-manifest.csv', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  // These patterns were the core of the legacy manifest-surgery code path.
  assert.ok(!bmadSrc.includes('manifest.yaml'),
    'bmad.js must NOT reference manifest.yaml (legacy manifest surgery, Story 22.6)');
  assert.ok(!bmadSrc.includes('files-manifest.csv'),
    'bmad.js must NOT reference files-manifest.csv (legacy manifest surgery, Story 22.6)');
  assert.ok(!bmadSrc.includes("['custom', 'bmb']") && !bmadSrc.includes('["custom", "bmb"]'),
    'bmad.js must NOT contain the hardcoded staleModules whitelist (Story 22.6)');
  assert.ok(!bmadSrc.includes('fields[2]'),
    'bmad.js must NOT CSV-index by fields[2] (Story 22.6)');
});

test('3.6: bmad.js does NOT stage custom agent YAMLs into _bmad/_config/custom/agents/', () => {
  const bmadSrc = fs.readFileSync(path.join(__dirname, '..', 'lib', 'bmad.js'), 'utf-8');
  // Plugin flow routes skill content via bmad-method's PluginResolver; the
  // legacy _bmad/_config/custom/agents/ staging path must be gone.
  assert.ok(!bmadSrc.includes("'_config', 'custom', 'agents'"),
    'bmad.js must NOT contain _config/custom/agents/ staging (Story 22.6)');
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

// ─── Integration tests — stagePlugin() / cleanupStage() (Story 22.6) ─────

console.log('\nIntegration — stagePlugin() / cleanupStage() lifecycle');

const fsExtra = require('fs-extra');
const os = require('os');
const crypto = require('crypto');
const { stagePlugin, cleanupStage, PLUGIN_STAGE_DIR_NAME } = require('../lib/bmad');
const { OUT_DIR: PLUGIN_BUNDLE_DIR, computeTreeDigest } = require('../scripts/build-plugin');

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
  const tmpDir = path.join(os.tmpdir(), `bmad-stage-test-${Date.now()}-${process.pid}`);

  await asyncTest('INT-1: stagePlugin copies bmad-extension-plugin to <project>/.ma-agents-plugin-stage/', async () => {
    await fsExtra.ensureDir(tmpDir);
    const result = stagePlugin(tmpDir);
    // Contract: stagePlugin returns { stagePath, customSourceArg } — the
    // absolute path for filesystem work, and a BMAD-safe relative path for
    // --custom-source (see _parseLocalPath bug with Windows absolute paths).
    assert.strictEqual(typeof result, 'object',
      'stagePlugin must return an object');
    assert.strictEqual(result.stagePath, path.join(tmpDir, PLUGIN_STAGE_DIR_NAME),
      `stagePlugin.stagePath must equal <projectRoot>/${PLUGIN_STAGE_DIR_NAME}`);
    assert.strictEqual(result.customSourceArg, `./${PLUGIN_STAGE_DIR_NAME}`,
      'stagePlugin.customSourceArg must be a BMAD-parseable relative path (./dir)');
    assert.ok(fs.existsSync(result.stagePath), 'stage directory must exist after stagePlugin()');
    // Sanity: the staged tree contains the marketplace manifest and skills dir
    assert.ok(fs.existsSync(path.join(result.stagePath, '.claude-plugin', 'marketplace.json')),
      'stage must contain .claude-plugin/marketplace.json');
    assert.ok(fs.existsSync(path.join(result.stagePath, 'skills')),
      'stage must contain skills/');
  });

  await asyncTest('INT-2: staged copy is byte-identical to the source plugin bundle (AC 3)', async () => {
    const stagePath = path.join(tmpDir, PLUGIN_STAGE_DIR_NAME);
    const sourceDigest = computeTreeDigest(PLUGIN_BUNDLE_DIR);
    const stageDigest = computeTreeDigest(stagePath);
    assert.strictEqual(stageDigest, sourceDigest,
      'SHA-256 tree digest of stage must equal source bundle (fresh copy, no drift)');
  });

  await asyncTest('INT-3: stagePlugin copies a real file, not a symlink', async () => {
    const stagePath = path.join(tmpDir, PLUGIN_STAGE_DIR_NAME);
    const marketplace = path.join(stagePath, '.claude-plugin', 'marketplace.json');
    const stat = fs.lstatSync(marketplace);
    assert.ok(!stat.isSymbolicLink(),
      'staged files must be regular files, not symlinks (AC 3)');
  });

  await asyncTest('INT-4: stagePlugin wipes a pre-existing stage before copying (edge case)', async () => {
    const stagePath = path.join(tmpDir, PLUGIN_STAGE_DIR_NAME);
    // Pretend a prior failed install left an orphan file behind.
    const orphan = path.join(stagePath, '_orphan-from-prior-run.txt');
    fs.writeFileSync(orphan, 'stale content that must be wiped');
    // Re-stage — the orphan must be gone.
    stagePlugin(tmpDir);
    assert.ok(!fs.existsSync(orphan),
      'orphan file from previous run must be removed by stagePlugin wipe-before-copy');
  });

  await asyncTest('INT-5: cleanupStage removes the directory', async () => {
    const stagePath = path.join(tmpDir, PLUGIN_STAGE_DIR_NAME);
    cleanupStage(stagePath);
    assert.ok(!fs.existsSync(stagePath),
      'stage directory must not exist after cleanupStage()');
  });

  await asyncTest('INT-6: cleanupStage is idempotent — second call on a missing path is a no-op', async () => {
    const stagePath = path.join(tmpDir, PLUGIN_STAGE_DIR_NAME);
    // Already removed by INT-5 — calling again must not throw.
    cleanupStage(stagePath);
    cleanupStage(''); // empty-string guard
    cleanupStage(null); // null guard
    assert.ok(true, 'cleanupStage must tolerate missing/empty paths without throwing');
  });

  // Cleanup
  await fsExtra.remove(tmpDir);

  printSummary();
}

// Silence the stagePlugin "Staged plugin:" logs during test runs — they add
// noise to the per-test output without adding signal. Node doesn't provide a
// per-console.log mute so we redirect the chalk.gray log into a sink.
const originalLog = console.log;
console.log = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && (first.includes('Staged plugin:') || first.includes('Removed plugin stage directory:'))) {
    return; // swallow — stagePlugin/cleanupStage diagnostic only
  }
  originalLog.apply(console, args);
};

function printSummary() {
  // ─── Summary ────────────────────────────────────────────────────────────
  console.log = originalLog;
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
