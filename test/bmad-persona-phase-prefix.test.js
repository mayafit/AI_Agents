#!/usr/bin/env node
/**
 * Story 21.7 — Tests for BMAD persona phase-aware prompt prefix.
 *
 * AC coverage (12 required):
 *   7.1  bmm-pm source contains phase: planning and non-empty on_prem_phase_prefix
 *   7.2  bmm-architect source contains phase: planning and non-empty on_prem_phase_prefix
 *   7.3  bmm-dev source contains phase: implementation and non-empty on_prem_phase_prefix
 *   7.4  Every planning persona's on_prem_phase_prefix contains /no_think literal
 *   7.5  No implementation persona's on_prem_phase_prefix contains /no_think
 *   7.6  Standard-profile deploy: bmm-pm has NO phase:, NO on_prem_phase_prefix:, NO /no_think
 *   7.7  On-prem deploy: bmm-pm critical_actions[0] contains planning prefix with /no_think
 *   7.8  On-prem deploy: bmm-pm has NO phase: or on_prem_phase_prefix: top-level keys
 *   7.9  On-prem deploy: ALL pre-existing critical_actions entries preserved in order
 *   7.10 Idempotency: two consecutive on-prem deploys produce byte-identical deployed bmm-pm
 *   7.11 bmm-analyst.customize.yaml exists and has phase: planning
 *   7.12 bmm-quick-flow-solo-dev.customize.yaml exists and has phase: implementation
 */
'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const jsYaml = require('js-yaml');

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  \u2713 ${name}`);
    passed++;
  } catch (err) {
    console.error(`  \u2717 ${name}: ${err.stack || err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const CUSTOMIZE_SOURCE = path.join(__dirname, '..', 'lib', 'bmad-customize');
const { applyPersonaPhasePrefix } = require('../lib/bmad');
const { setProfile } = require('../lib/profile');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-21-7-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

/**
 * Copy all customize yaml files from CUSTOMIZE_SOURCE into tmpDir,
 * then call applyPersonaPhasePrefix with the given profile.
 * Returns the parsed YAML of the specified file from tmpDir.
 */
async function deployAndParse(tmpDir, profile, filename) {
  // Copy all source customize files into tmpDir
  const files = fs.readdirSync(CUSTOMIZE_SOURCE).filter(f => f.endsWith('.customize.yaml'));
  for (const file of files) {
    fs.copyFileSync(
      path.join(CUSTOMIZE_SOURCE, file),
      path.join(tmpDir, file)
    );
  }
  await applyPersonaPhasePrefix(CUSTOMIZE_SOURCE, tmpDir, profile);
  const raw = fs.readFileSync(path.join(tmpDir, filename), 'utf8');
  return jsYaml.load(raw);
}

console.log('\n story 21.7 — BMAD persona phase-aware prompt prefix\n');

async function runAll() {

  // 7.1 — bmm-pm source contains phase: planning and non-empty on_prem_phase_prefix
  await test('7.1 bmm-pm.customize.yaml source has phase: planning and non-empty on_prem_phase_prefix', () => {
    const doc = jsYaml.load(fs.readFileSync(path.join(CUSTOMIZE_SOURCE, 'bmm-pm.customize.yaml'), 'utf8'));
    assert.strictEqual(doc.phase, 'planning', 'phase should be "planning"');
    assert.ok(doc.on_prem_phase_prefix && doc.on_prem_phase_prefix.trim().length > 0,
      'on_prem_phase_prefix should be non-empty');
  });

  // 7.2 — bmm-architect source contains phase: planning and non-empty on_prem_phase_prefix
  await test('7.2 bmm-architect.customize.yaml source has phase: planning and non-empty on_prem_phase_prefix', () => {
    const doc = jsYaml.load(fs.readFileSync(path.join(CUSTOMIZE_SOURCE, 'bmm-architect.customize.yaml'), 'utf8'));
    assert.strictEqual(doc.phase, 'planning', 'phase should be "planning"');
    assert.ok(doc.on_prem_phase_prefix && doc.on_prem_phase_prefix.trim().length > 0,
      'on_prem_phase_prefix should be non-empty');
  });

  // 7.3 — bmm-dev source contains phase: implementation and non-empty on_prem_phase_prefix
  await test('7.3 bmm-dev.customize.yaml source has phase: implementation and non-empty on_prem_phase_prefix', () => {
    const doc = jsYaml.load(fs.readFileSync(path.join(CUSTOMIZE_SOURCE, 'bmm-dev.customize.yaml'), 'utf8'));
    assert.strictEqual(doc.phase, 'implementation', 'phase should be "implementation"');
    assert.ok(doc.on_prem_phase_prefix && doc.on_prem_phase_prefix.trim().length > 0,
      'on_prem_phase_prefix should be non-empty');
  });

  // 7.4 — Every planning persona's on_prem_phase_prefix contains /no_think literal
  await test('7.4 All planning personas have /no_think in on_prem_phase_prefix', () => {
    const files = fs.readdirSync(CUSTOMIZE_SOURCE).filter(f => f.endsWith('.customize.yaml'));
    for (const file of files) {
      const doc = jsYaml.load(fs.readFileSync(path.join(CUSTOMIZE_SOURCE, file), 'utf8'));
      if (doc && doc.phase === 'planning') {
        assert.ok(
          typeof doc.on_prem_phase_prefix === 'string' && doc.on_prem_phase_prefix.includes('/no_think'),
          `${file}: planning persona on_prem_phase_prefix must contain /no_think, got: ${doc.on_prem_phase_prefix}`
        );
      }
    }
  });

  // 7.5 — No implementation persona's on_prem_phase_prefix contains /no_think
  await test('7.5 No implementation persona has /no_think in on_prem_phase_prefix', () => {
    const files = fs.readdirSync(CUSTOMIZE_SOURCE).filter(f => f.endsWith('.customize.yaml'));
    for (const file of files) {
      const doc = jsYaml.load(fs.readFileSync(path.join(CUSTOMIZE_SOURCE, file), 'utf8'));
      if (doc && doc.phase === 'implementation') {
        const prefix = doc.on_prem_phase_prefix || '';
        assert.ok(
          !prefix.includes('/no_think'),
          `${file}: implementation persona on_prem_phase_prefix must NOT contain /no_think`
        );
      }
    }
  });

  // 7.6 — Standard-profile deploy: bmm-pm has NO phase:, NO on_prem_phase_prefix:, NO /no_think
  await test('7.6 Standard-profile deploy: bmm-pm has no phase, no on_prem_phase_prefix, no /no_think', async () => {
    const tmpDir = mktemp();
    try {
      const doc = await deployAndParse(tmpDir, 'standard', 'bmm-pm.customize.yaml');
      assert.ok(!Object.prototype.hasOwnProperty.call(doc, 'phase'),
        'deployed file must not have "phase" key');
      assert.ok(!Object.prototype.hasOwnProperty.call(doc, 'on_prem_phase_prefix'),
        'deployed file must not have "on_prem_phase_prefix" key');
      const raw = fs.readFileSync(path.join(tmpDir, 'bmm-pm.customize.yaml'), 'utf8');
      assert.ok(!raw.includes('/no_think'),
        'deployed file must not contain /no_think string');
    } finally {
      cleanup(tmpDir);
    }
  });

  // 7.7 — On-prem deploy: bmm-pm critical_actions[0] contains planning prefix with /no_think
  await test('7.7 On-prem deploy: bmm-pm critical_actions[0] contains /no_think prefix', async () => {
    const tmpDir = mktemp();
    try {
      const doc = await deployAndParse(tmpDir, 'on-prem', 'bmm-pm.customize.yaml');
      assert.ok(Array.isArray(doc.critical_actions) && doc.critical_actions.length > 0,
        'critical_actions must be a non-empty array');
      const first = doc.critical_actions[0];
      assert.ok(typeof first === 'string' && first.includes('/no_think'),
        `critical_actions[0] must contain /no_think, got: ${first}`
      );
    } finally {
      cleanup(tmpDir);
    }
  });

  // 7.8 — On-prem deploy: bmm-pm has NO phase: or on_prem_phase_prefix: top-level keys
  await test('7.8 On-prem deploy: bmm-pm has no phase or on_prem_phase_prefix keys after deploy', async () => {
    const tmpDir = mktemp();
    try {
      const doc = await deployAndParse(tmpDir, 'on-prem', 'bmm-pm.customize.yaml');
      assert.ok(!Object.prototype.hasOwnProperty.call(doc, 'phase'),
        'deployed on-prem file must not have "phase" key');
      assert.ok(!Object.prototype.hasOwnProperty.call(doc, 'on_prem_phase_prefix'),
        'deployed on-prem file must not have "on_prem_phase_prefix" key');
    } finally {
      cleanup(tmpDir);
    }
  });

  // 7.9 — On-prem deploy: ALL pre-existing critical_actions entries preserved in order
  await test('7.9 On-prem deploy: all original critical_actions entries preserved', async () => {
    const tmpDir = mktemp();
    try {
      // Get original critical_actions from source
      const sourceDoc = jsYaml.load(
        fs.readFileSync(path.join(CUSTOMIZE_SOURCE, 'bmm-pm.customize.yaml'), 'utf8')
      );
      const originalActions = Array.isArray(sourceDoc.critical_actions)
        ? sourceDoc.critical_actions : [];

      const deployedDoc = await deployAndParse(tmpDir, 'on-prem', 'bmm-pm.customize.yaml');
      assert.ok(Array.isArray(deployedDoc.critical_actions),
        'critical_actions must be an array');
      // The deployed array should be [prefix, ...originalActions]
      assert.strictEqual(
        deployedDoc.critical_actions.length,
        originalActions.length + 1,
        `deployed critical_actions length should be original + 1, got ${deployedDoc.critical_actions.length}`
      );
      for (let i = 0; i < originalActions.length; i++) {
        assert.strictEqual(
          deployedDoc.critical_actions[i + 1],
          originalActions[i],
          `critical_actions[${i + 1}] should match original[${i}]`
        );
      }
    } finally {
      cleanup(tmpDir);
    }
  });

  // 7.10 — Idempotency: two consecutive on-prem deploys produce byte-identical deployed bmm-pm
  await test('7.10 Idempotency: two on-prem deploys produce byte-identical bmm-pm.customize.yaml', async () => {
    const tmpDir = mktemp();
    try {
      // First deploy
      const files = fs.readdirSync(CUSTOMIZE_SOURCE).filter(f => f.endsWith('.customize.yaml'));
      for (const file of files) {
        fs.copyFileSync(
          path.join(CUSTOMIZE_SOURCE, file),
          path.join(tmpDir, file)
        );
      }
      await applyPersonaPhasePrefix(CUSTOMIZE_SOURCE, tmpDir, 'on-prem');
      const after1 = fs.readFileSync(path.join(tmpDir, 'bmm-pm.customize.yaml'), 'utf8');

      // Second deploy: re-copy source files and apply again
      for (const file of files) {
        fs.copyFileSync(
          path.join(CUSTOMIZE_SOURCE, file),
          path.join(tmpDir, file)
        );
      }
      await applyPersonaPhasePrefix(CUSTOMIZE_SOURCE, tmpDir, 'on-prem');
      const after2 = fs.readFileSync(path.join(tmpDir, 'bmm-pm.customize.yaml'), 'utf8');

      assert.strictEqual(after1, after2, 'Two consecutive on-prem deploys must produce byte-identical files');
    } finally {
      cleanup(tmpDir);
    }
  });

  // 7.11 — bmm-analyst.customize.yaml exists and has phase: planning
  await test('7.11 bmm-analyst.customize.yaml exists and has phase: planning', () => {
    const filePath = path.join(CUSTOMIZE_SOURCE, 'bmm-analyst.customize.yaml');
    assert.ok(fs.existsSync(filePath), 'bmm-analyst.customize.yaml must exist in lib/bmad-customize/');
    const doc = jsYaml.load(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(doc.phase, 'planning', 'bmm-analyst must have phase: planning');
  });

  // 7.12 — bmm-quick-flow-solo-dev.customize.yaml exists and has phase: implementation
  await test('7.12 bmm-quick-flow-solo-dev.customize.yaml exists and has phase: implementation', () => {
    const filePath = path.join(CUSTOMIZE_SOURCE, 'bmm-quick-flow-solo-dev.customize.yaml');
    assert.ok(fs.existsSync(filePath), 'bmm-quick-flow-solo-dev.customize.yaml must exist in lib/bmad-customize/');
    const doc = jsYaml.load(fs.readFileSync(filePath, 'utf8'));
    assert.strictEqual(doc.phase, 'implementation', 'bmm-quick-flow-solo-dev must have phase: implementation');
  });

  // Summary
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (errors.length > 0) {
    console.error('Failures:');
    for (const e of errors) {
      console.error(`  - ${e.name}: ${e.error}`);
    }
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
