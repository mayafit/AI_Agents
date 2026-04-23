#!/usr/bin/env node
/**
 * Story 22.3 — Legacy Skill Retirement Migration (AC 7).
 *
 * Verifies migrateRetiredSkills() for the four BMAD v6.3.0 retirements:
 *   bmad-init, bmad-agent-qa, bmad-agent-sm, bmad-agent-quick-flow-solo-dev
 *
 * Coverage:
 *   22.3-t1  Removes a retired ID from a manifest with other skills intact
 *   22.3-t2  Removes an orphaned installed skill directory with no manifest entry
 *   22.3-t3  No-op on a clean install (idempotency)
 *   22.3-t4  Running twice produces the same end state (idempotency contract)
 *   22.3-t5  Regenerates MANIFEST.yaml so retired IDs do not appear post-migration
 *   22.3-t6  Tolerates a missing .ma-agents.json (fresh directory, only stale files)
 *   22.3-t7  RETIRED_SKILL_IDS is immutable (frozen list — accidental mutation guard)
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const {
  migrateRetiredSkills,
  RETIRED_SKILL_IDS
} = require('../lib/installer');

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
    errors.push({ name, err });
  }
}

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-22-3-'));
}

function cleanup(dir) {
  try { fs.removeSync(dir); } catch { /* ignore */ }
}

/**
 * Seed a fake install path that looks like an agent's project skill dir:
 *   <dir>/.ma-agents.json   — manifest JSON
 *   <dir>/<skillId>/SKILL.md — deployed skill file
 */
function seedInstall(installPath, { manifest, skillDirs = [] }) {
  fs.ensureDirSync(installPath);
  if (manifest) {
    fs.writeFileSync(
      path.join(installPath, '.ma-agents.json'),
      JSON.stringify(manifest, null, 2) + '\n',
      'utf-8'
    );
  }
  for (const id of skillDirs) {
    const d = path.join(installPath, id);
    fs.ensureDirSync(d);
    fs.writeFileSync(path.join(d, 'SKILL.md'), `# ${id}\n`, 'utf-8');
  }
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

console.log('\n story 22.3 — Legacy skill retirement migration\n');

async function runAll() {

  // 22.3-t1 — Removes a retired ID from the manifest, keeps non-retired IDs
  await test('22.3-t1 Retired manifest entry removed; non-retired entries preserved', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      seedInstall(installPath, {
        manifest: {
          manifestVersion: '1.2.0',
          agent: 'claude-code',
          agents: ['claude-code'],
          scope: 'project',
          skills: {
            'bmad-init': { version: '1.0.0', source: 'ma-agents' },
            'code-review': { version: '2.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-init', 'code-review']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const after = readJson(path.join(installPath, '.ma-agents.json'));
      assert.ok(!Object.prototype.hasOwnProperty.call(after.skills, 'bmad-init'),
        'bmad-init should have been removed from manifest');
      assert.ok(Object.prototype.hasOwnProperty.call(after.skills, 'code-review'),
        'code-review should still be present');
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-init')),
        'bmad-init skill directory should have been removed');
      assert.ok(fs.existsSync(path.join(installPath, 'code-review')),
        'code-review skill directory must be preserved');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t2 — Orphaned skill directory (no manifest entry) is still deleted
  await test('22.3-t2 Orphaned retired skill directory is removed', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      seedInstall(installPath, {
        manifest: {
          manifestVersion: '1.2.0',
          agent: 'claude-code',
          agents: ['claude-code'],
          scope: 'project',
          skills: {
            'code-review': { version: '2.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-agent-qa', 'code-review'] // bmad-agent-qa not in manifest
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-agent-qa')),
        'Orphaned bmad-agent-qa directory should have been removed');
      assert.ok(fs.existsSync(path.join(installPath, 'code-review')),
        'code-review must still be present');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t3 — Clean install is a no-op
  await test('22.3-t3 Clean install: migration is a no-op', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      seedInstall(installPath, {
        manifest: {
          manifestVersion: '1.2.0',
          agent: 'claude-code',
          agents: ['claude-code'],
          scope: 'project',
          skills: {
            'code-review': { version: '2.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['code-review']
      });
      const before = fs.readFileSync(path.join(installPath, '.ma-agents.json'), 'utf-8');

      const results = await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const after = fs.readFileSync(path.join(installPath, '.ma-agents.json'), 'utf-8');
      assert.strictEqual(after, before, 'Manifest should be byte-identical on a clean install');
      assert.strictEqual(results.length, 1, 'Should visit exactly one path');
      assert.strictEqual(results[0].removedIds.length, 0, 'No IDs should have been removed');
      assert.strictEqual(results[0].filesRemoved, 0, 'No directories should have been removed');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t4 — Idempotency: two runs produce the same final state
  await test('22.3-t4 Idempotency: two consecutive runs produce the same state', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      seedInstall(installPath, {
        manifest: {
          manifestVersion: '1.2.0',
          agent: 'claude-code',
          agents: ['claude-code'],
          scope: 'project',
          skills: {
            'bmad-agent-sm': { version: '1.0.0', source: 'ma-agents' },
            'code-review':   { version: '2.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-agent-sm', 'code-review']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });
      const afterFirst = fs.readFileSync(path.join(installPath, '.ma-agents.json'), 'utf-8');
      await migrateRetiredSkills({ scope: 'project', customPath: installPath });
      const afterSecond = fs.readFileSync(path.join(installPath, '.ma-agents.json'), 'utf-8');

      assert.strictEqual(afterFirst, afterSecond,
        'Two consecutive migrations must produce byte-identical manifests');
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-agent-sm')),
        'bmad-agent-sm must not be reinstated on the second run');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t5 — Regenerated MANIFEST.yaml does not mention retired IDs
  await test('22.3-t5 MANIFEST.yaml regenerated without retired IDs', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      // Seed with a retired ID + a real skill (one that exists in repo-level
      // skills/ so generateSkillsManifest can render it).
      seedInstall(installPath, {
        manifest: {
          manifestVersion: '1.2.0',
          agent: 'claude-code',
          agents: ['claude-code'],
          scope: 'project',
          skills: {
            'bmad-init':   { version: '1.0.0', source: 'ma-agents' },
            'code-review': { version: '2.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-init', 'code-review']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const manifestYamlPath = path.join(installPath, 'MANIFEST.yaml');
      assert.ok(fs.existsSync(manifestYamlPath), 'MANIFEST.yaml should have been generated');
      const parsed = yaml.load(fs.readFileSync(manifestYamlPath, 'utf-8'));
      assert.ok(parsed && Array.isArray(parsed.skills), 'MANIFEST.yaml must declare a skills list');
      const ids = parsed.skills.map(s => s.id);
      for (const retired of RETIRED_SKILL_IDS) {
        assert.ok(!ids.includes(retired),
          `Regenerated MANIFEST.yaml must not contain retired ID '${retired}'`);
      }
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t6 — Missing manifest + stale dir still cleaned up
  await test('22.3-t6 Missing .ma-agents.json still cleans orphaned retired dirs', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      fs.ensureDirSync(installPath);
      // No manifest — only a stale retired directory
      const staleDir = path.join(installPath, 'bmad-agent-quick-flow-solo-dev');
      fs.ensureDirSync(staleDir);
      fs.writeFileSync(path.join(staleDir, 'SKILL.md'), '# stale\n', 'utf-8');

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      assert.ok(!fs.existsSync(staleDir),
        'Stale retired skill directory must be removed even without a manifest');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t7 — RETIRED_SKILL_IDS is frozen to prevent accidental mutation
  await test('22.3-t7 RETIRED_SKILL_IDS is immutable', () => {
    assert.ok(Object.isFrozen(RETIRED_SKILL_IDS),
      'RETIRED_SKILL_IDS must be frozen to prevent accidental mutation by callers');
    assert.deepStrictEqual(
      [...RETIRED_SKILL_IDS].sort(),
      ['bmad-agent-qa', 'bmad-agent-quick-flow-solo-dev', 'bmad-agent-sm', 'bmad-init'].sort(),
      'RETIRED_SKILL_IDS contents changed — update tests if this is intentional'
    );
  });

  // 22.3-t8 — Edge case: manifest exists but .skills is null / undefined / non-object.
  // readManifest can parse malformed manifests that still produce a valid JSON object;
  // the migration must tolerate a manifest whose skills field is missing.
  await test('22.3-t8 Malformed manifest with skills:null does not crash', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      fs.ensureDirSync(installPath);
      fs.writeFileSync(
        path.join(installPath, '.ma-agents.json'),
        JSON.stringify({ manifestVersion: '1.2.0', agents: ['claude-code'], skills: null }, null, 2),
        'utf-8'
      );
      // Seed an orphan retired dir too — must still be cleaned up.
      const staleDir = path.join(installPath, 'bmad-init');
      fs.ensureDirSync(staleDir);

      const results = await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      assert.ok(!fs.existsSync(staleDir),
        'Orphan retired directory must be removed even with a null skills manifest');
      assert.strictEqual(results[0].error, null,
        'Per-path error slot should remain null when the only work is a successful orphan cleanup');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t9 — Edge case: corrupted .ma-agents.json (invalid JSON).
  // readManifest swallows the parse error and returns null. migrateRetiredSkills
  // should still handle orphan directories without crashing.
  await test('22.3-t9 Corrupted .ma-agents.json (invalid JSON) is handled gracefully', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      fs.ensureDirSync(installPath);
      fs.writeFileSync(path.join(installPath, '.ma-agents.json'), '{this is not valid json', 'utf-8');
      const staleDir = path.join(installPath, 'bmad-agent-sm');
      fs.ensureDirSync(staleDir);

      const results = await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      assert.ok(!fs.existsSync(staleDir),
        'Orphan dir must be cleaned up even if the manifest JSON is unparseable');
      // Corrupted manifest is left in place — the installer will rewrite it
      // on the next successful install. We do not silently delete user data.
      assert.ok(fs.existsSync(path.join(installPath, '.ma-agents.json')),
        'Corrupted manifest file is preserved, not deleted');
      assert.strictEqual(results[0].error, null,
        'A corrupted manifest should not surface as a per-path error');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.3-t10 — Edge case: customPath resolves to a non-existent directory.
  // migrateRetiredSkills should treat this as "nothing to do" and return a
  // single empty result for that path — not crash with ENOENT.
  await test('22.3-t10 Non-existent customPath returns empty result without crashing', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, 'does', 'not', 'exist', '.claude', 'skills');
      // deliberately NOT creating the dir
      const results = await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].removedIds.length, 0);
      assert.strictEqual(results[0].filesRemoved, 0);
      assert.strictEqual(results[0].manifestMutated, false);
      assert.strictEqual(results[0].error, null);
    } finally {
      cleanup(tmp);
    }
  });

  // Summary
  console.log(`\n  ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    console.error('Failures:');
    for (const e of errors) {
      console.error(`  - ${e.name}: ${e.err.message}`);
    }
    process.exit(1);
  }
}

runAll().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
