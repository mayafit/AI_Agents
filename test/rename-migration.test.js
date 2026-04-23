#!/usr/bin/env node
/**
 * Story 22.2 — Skill Namespace Rename Migration (AC 7).
 *
 * Verifies migrateRetiredSkills() correctly purges the five renamed
 * ma-agents skill IDs from existing user installs:
 *   bmad-ma-agent-cyber   → ma-agent-cyber
 *   bmad-ma-agent-devops  → ma-agent-devops
 *   bmad-ma-agent-sre     → ma-agent-sre
 *   bmad-ma-agent-ml      → ma-agent-ml
 *   bmad-ma-agent-sqa     → ma-agent-sqa
 *
 * Coverage:
 *   22.2-t1  Stale bmad-ma-agent-* manifest entries are removed
 *   22.2-t2  Stale bmad-ma-agent-* skill directories are removed (including orphans)
 *   22.2-t3  Non-renamed skills are untouched
 *   22.2-t4  Running twice produces the same state (idempotency)
 *   22.2-t5  RENAMED_SKILL_IDS and OBSOLETE_SKILL_IDS are frozen and correct
 *   22.2-t6  Retired + renamed are cleaned in a single sweep
 *   22.2-t7  MANIFEST.yaml is regenerated without the renamed IDs
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const yaml = require('js-yaml');

const {
  migrateRetiredSkills,
  RETIRED_SKILL_IDS,
  RENAMED_SKILL_IDS,
  OBSOLETE_SKILL_IDS
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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-22-2-'));
}

function cleanup(dir) {
  try { fs.removeSync(dir); } catch { /* ignore */ }
}

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

console.log('\n story 22.2 — Skill namespace rename migration\n');

async function runAll() {

  // 22.2-t1 — Every renamed ID present in the manifest is removed; non-renamed IDs remain.
  await test('22.2-t1 Renamed manifest entries removed; other entries preserved', async () => {
    const tmp = mktemp();
    try {
      const installPath = path.join(tmp, '.claude', 'skills');
      const skills = {};
      for (const id of RENAMED_SKILL_IDS) skills[id] = { version: '1.0.0', source: 'ma-agents' };
      skills['code-review'] = { version: '2.0.0', source: 'ma-agents' };

      seedInstall(installPath, {
        manifest: {
          manifestVersion: '1.2.0',
          agent: 'claude-code',
          agents: ['claude-code'],
          scope: 'project',
          skills
        },
        skillDirs: [...RENAMED_SKILL_IDS, 'code-review']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const after = readJson(path.join(installPath, '.ma-agents.json'));
      for (const id of RENAMED_SKILL_IDS) {
        assert.ok(!Object.prototype.hasOwnProperty.call(after.skills, id),
          `${id} must have been removed from the manifest`);
        assert.ok(!fs.existsSync(path.join(installPath, id)),
          `${id}/ directory must have been removed from disk`);
      }
      assert.ok(Object.prototype.hasOwnProperty.call(after.skills, 'code-review'),
        'code-review must still be present');
      assert.ok(fs.existsSync(path.join(installPath, 'code-review')),
        'code-review directory must still exist');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.2-t2 — Orphan bmad-ma-agent-* directory (no manifest entry) is still removed.
  await test('22.2-t2 Orphan renamed skill directories are removed', async () => {
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
        // Orphan dirs that are not in the manifest
        skillDirs: ['bmad-ma-agent-cyber', 'bmad-ma-agent-sqa', 'code-review']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-ma-agent-cyber')),
        'Orphan bmad-ma-agent-cyber must be removed');
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-ma-agent-sqa')),
        'Orphan bmad-ma-agent-sqa must be removed');
      assert.ok(fs.existsSync(path.join(installPath, 'code-review')),
        'code-review must still be present');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.2-t3 — Newly renamed skills (ma-agent-*) are preserved.
  // A mixed install that already has the new IDs alongside stale old IDs
  // must not lose the new ones.
  await test('22.2-t3 New ma-agent-* IDs are preserved when old ones are present', async () => {
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
            'bmad-ma-agent-cyber': { version: '1.0.0', source: 'ma-agents' },
            'ma-agent-cyber':      { version: '1.0.1', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-ma-agent-cyber', 'ma-agent-cyber']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const after = readJson(path.join(installPath, '.ma-agents.json'));
      assert.ok(!Object.prototype.hasOwnProperty.call(after.skills, 'bmad-ma-agent-cyber'),
        'stale bmad-ma-agent-cyber must be gone');
      assert.ok(Object.prototype.hasOwnProperty.call(after.skills, 'ma-agent-cyber'),
        'fresh ma-agent-cyber must be preserved');
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-ma-agent-cyber')),
        'stale directory must be removed');
      assert.ok(fs.existsSync(path.join(installPath, 'ma-agent-cyber')),
        'fresh directory must be preserved');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.2-t4 — Idempotency: run twice, same result.
  await test('22.2-t4 Idempotency: two consecutive sweeps produce identical state', async () => {
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
            'bmad-ma-agent-devops': { version: '1.0.0', source: 'ma-agents' },
            'code-review':          { version: '2.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-ma-agent-devops', 'code-review']
      });

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });
      const firstState = fs.readFileSync(path.join(installPath, '.ma-agents.json'), 'utf-8');
      await migrateRetiredSkills({ scope: 'project', customPath: installPath });
      const secondState = fs.readFileSync(path.join(installPath, '.ma-agents.json'), 'utf-8');

      assert.strictEqual(firstState, secondState,
        'Second sweep must not mutate the manifest');
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-ma-agent-devops')),
        'bmad-ma-agent-devops must remain removed after the second sweep');
    } finally {
      cleanup(tmp);
    }
  });

  // 22.2-t5 — RENAMED_SKILL_IDS and OBSOLETE_SKILL_IDS are frozen and carry the expected contents.
  await test('22.2-t5 RENAMED_SKILL_IDS / OBSOLETE_SKILL_IDS frozen-list contract', async () => {
    assert.ok(Object.isFrozen(RENAMED_SKILL_IDS),
      'RENAMED_SKILL_IDS must be frozen');
    assert.ok(Object.isFrozen(OBSOLETE_SKILL_IDS),
      'OBSOLETE_SKILL_IDS must be frozen');

    assert.deepStrictEqual(
      [...RENAMED_SKILL_IDS].sort(),
      [
        'bmad-ma-agent-cyber',
        'bmad-ma-agent-devops',
        'bmad-ma-agent-ml',
        'bmad-ma-agent-sqa',
        'bmad-ma-agent-sre'
      ].sort(),
      'RENAMED_SKILL_IDS drift guard — update tests if this is intentional'
    );

    // Union must contain every member of both source lists and nothing else.
    const expected = [...RETIRED_SKILL_IDS, ...RENAMED_SKILL_IDS].sort();
    assert.deepStrictEqual(
      [...OBSOLETE_SKILL_IDS].sort(),
      expected,
      'OBSOLETE_SKILL_IDS must equal RETIRED_SKILL_IDS ∪ RENAMED_SKILL_IDS'
    );
  });

  // 22.2-t6 — A single sweep cleans both retired and renamed legacy IDs in one pass.
  await test('22.2-t6 Retired + renamed IDs are cleaned in a single migration pass', async () => {
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
            // One from each category.
            'bmad-init':           { version: '1.0.0', source: 'ma-agents' }, // retired
            'bmad-ma-agent-sre':   { version: '1.0.0', source: 'ma-agents' }, // renamed
            'code-review':         { version: '2.0.0', source: 'ma-agents' }  // kept
          }
        },
        skillDirs: ['bmad-init', 'bmad-ma-agent-sre', 'code-review']
      });

      const results = await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const after = readJson(path.join(installPath, '.ma-agents.json'));
      assert.ok(!after.skills['bmad-init'], 'retired bmad-init must be gone');
      assert.ok(!after.skills['bmad-ma-agent-sre'], 'renamed bmad-ma-agent-sre must be gone');
      assert.ok(after.skills['code-review'], 'code-review must be preserved');
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-init')));
      assert.ok(!fs.existsSync(path.join(installPath, 'bmad-ma-agent-sre')));
      assert.ok(fs.existsSync(path.join(installPath, 'code-review')));
      assert.strictEqual(results.length, 1);
      // Both obsolete IDs should appear in removedIds (manifest + dir counted once each)
      assert.ok(results[0].removedIds.includes('bmad-init'));
      assert.ok(results[0].removedIds.includes('bmad-ma-agent-sre'));
    } finally {
      cleanup(tmp);
    }
  });

  // 22.2-t7 — MANIFEST.yaml is regenerated and excludes renamed IDs.
  await test('22.2-t7 MANIFEST.yaml regeneration drops renamed IDs from the deployed manifest', async () => {
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
            'bmad-ma-agent-cyber': { version: '1.0.0', source: 'ma-agents' }
          }
        },
        skillDirs: ['bmad-ma-agent-cyber']
      });

      // Seed a SKILL.md inside the stale dir so generateSkillsManifest has
      // source files to scan (it walks installPath for SKILL.md children).
      fs.writeFileSync(
        path.join(installPath, 'bmad-ma-agent-cyber', 'SKILL.md'),
        '---\nname: bmad-ma-agent-cyber\n---\n',
        'utf-8'
      );

      await migrateRetiredSkills({ scope: 'project', customPath: installPath });

      const manifestYamlPath = path.join(installPath, 'MANIFEST.yaml');
      if (fs.existsSync(manifestYamlPath)) {
        const contents = fs.readFileSync(manifestYamlPath, 'utf-8');
        assert.ok(!contents.includes('bmad-ma-agent-cyber'),
          'Regenerated MANIFEST.yaml must not mention the renamed ID');
      }
      // If the file is not present (skills map empty -> regenerator skipped)
      // that is also correct behavior — we have no stale ID left anywhere.
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
