#!/usr/bin/env node
/**
 * Bug 27.16 — .agents/skills pipeline-consistency reconciliation.
 *
 * BMAD's PluginResolver routes copilot/roo/kilo skills into the shared
 * `.agents/skills/` dir. When the user selects only claude-code/cline/opencode,
 * BMAD still writes BMAD-family skills there, but ma-agents' standalone loop
 * (the ONLY writer of MANIFEST.yaml) never targets that dir — leaving it BMAD-
 * only with no MANIFEST.yaml the stamped instruction block points at.
 *
 * reconcileAgentsSharedSkills backfills the standalone catalog + MANIFEST.yaml
 * into a BMAD-populated .agents/skills dir when no .agents-targeting agent was
 * selected. The invariant: .agents/skills is either absent OR carries
 * MANIFEST.yaml (never BMAD-only without a manifest).
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

const {
  reconcileAgentsSharedSkills,
  getAgentsSharedSkillAgentIds,
} = require('../lib/installer');

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-27-16-'));
}
function cleanup(dir) {
  try { fs.removeSync(dir); } catch {}
}

// Simulate a BMAD-populated shared dir: some BMAD-family skills present, NO
// MANIFEST.yaml, NO .ma-agents.json.
function seedBmadOnlySharedDir(projectRoot) {
  const shared = path.join(projectRoot, '.agents', 'skills');
  for (const id of ['bmad-agent-pm', 'bmad-agent-dev']) {
    const d = path.join(shared, id);
    fs.ensureDirSync(d);
    fs.writeFileSync(path.join(d, 'SKILL.md'), `# ${id}\n`, 'utf-8');
  }
  return shared;
}

console.log('\n .agents/skills reconciliation tests (bug 27.16)\n');

(async () => {
  await test('getAgentsSharedSkillAgentIds returns copilot/kilocode/roo-code', () => {
    const ids = getAgentsSharedSkillAgentIds();
    for (const expected of ['copilot', 'kilocode', 'roo-code']) {
      assert.ok(ids.includes(expected), `expected ${expected} in shared-dir agents`);
    }
  });

  await test('backfills catalog + MANIFEST.yaml when BMAD-populated and no .agents agent selected', async () => {
    const dir = mktemp();
    try {
      const shared = seedBmadOnlySharedDir(dir);
      assert.ok(!fs.existsSync(path.join(shared, 'MANIFEST.yaml')), 'precondition: no manifest');

      const res = await reconcileAgentsSharedSkills(dir, ['claude-code', 'cline', 'opencode'], 'project');
      assert.strictEqual(res.reconciled, true, 'should reconcile');
      assert.ok(res.installed > 0, 'should install standalone skills');
      assert.ok(fs.existsSync(path.join(shared, 'MANIFEST.yaml')), 'MANIFEST.yaml must now exist');
      assert.ok(fs.existsSync(path.join(shared, '.ma-agents.json')), '.ma-agents.json must record the skills');

      // BMAD-family skills must be preserved (additive backfill, not a wipe).
      assert.ok(fs.existsSync(path.join(shared, 'bmad-agent-pm', 'SKILL.md')), 'BMAD skill preserved');

      const manifest = JSON.parse(fs.readFileSync(path.join(shared, '.ma-agents.json'), 'utf-8'));
      assert.ok(Object.keys(manifest.skills).length > 0, 'manifest records standalone skills');
    } finally { cleanup(dir); }
  });

  await test('no-op when a .agents-targeting agent (copilot) WAS selected', async () => {
    const dir = mktemp();
    try {
      seedBmadOnlySharedDir(dir);
      const res = await reconcileAgentsSharedSkills(dir, ['claude-code', 'copilot'], 'project');
      assert.strictEqual(res.reconciled, false, 'standalone loop already targeted the dir');
    } finally { cleanup(dir); }
  });

  await test('no-op when .agents/skills does not exist (BMAD never populated it)', async () => {
    const dir = mktemp();
    try {
      const res = await reconcileAgentsSharedSkills(dir, ['claude-code'], 'project');
      assert.strictEqual(res.reconciled, false);
      assert.ok(!fs.existsSync(path.join(dir, '.agents', 'skills')), 'dir must remain absent');
    } finally { cleanup(dir); }
  });

  await test('idempotent: second pass is a no-op once MANIFEST.yaml exists', async () => {
    const dir = mktemp();
    try {
      seedBmadOnlySharedDir(dir);
      await reconcileAgentsSharedSkills(dir, ['claude-code'], 'project');
      const second = await reconcileAgentsSharedSkills(dir, ['claude-code'], 'project');
      assert.strictEqual(second.reconciled, false, 'second pass must early-return on existing manifest');
    } finally { cleanup(dir); }
  });

  await test('invariant: claude-code-only install leaves .agents/skills with a MANIFEST.yaml (story AC)', async () => {
    const dir = mktemp();
    try {
      const shared = seedBmadOnlySharedDir(dir);
      await reconcileAgentsSharedSkills(dir, ['claude-code'], 'project');
      // Either absent OR carries MANIFEST.yaml — here it exists, so it must carry one.
      const exists = fs.existsSync(shared);
      const hasManifest = fs.existsSync(path.join(shared, 'MANIFEST.yaml'));
      assert.ok(!exists || hasManifest, '.agents/skills must never be BMAD-only without MANIFEST.yaml');
    } finally { cleanup(dir); }
  });

  await test('global scope is a no-op (project-only reconciliation)', async () => {
    const dir = mktemp();
    try {
      seedBmadOnlySharedDir(dir);
      const res = await reconcileAgentsSharedSkills(dir, ['claude-code'], 'global');
      assert.strictEqual(res.reconciled, false);
    } finally { cleanup(dir); }
  });

  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ✗ ${e.name}: ${e.error}`));
    process.exit(1);
  }
})();
