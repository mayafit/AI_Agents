#!/usr/bin/env node
/**
 * Bug B2 — Stale .github/copilot/skills/ directory cleanup on upgrade.
 *
 * Verifies migrateObsoleteToolDirs() for the initial OBSOLETE_TOOL_SKILL_DIRS entry:
 *   copilot pre-F2b path: .github/copilot/skills  →  .github/skills
 *
 * Coverage:
 *   b2-t1  Stale obsolete dir removed when replacement dir has content
 *   b2-t2  Obsolete dir preserved when replacement dir is absent/empty (user may have edits)
 *   b2-t3  No-op when obsolete dir is absent (idempotent — second upgrade)
 *   b2-t4  Running twice with stale dir → clean state → no error (idempotent contract)
 *   b2-t5  OBSOLETE_TOOL_SKILL_DIRS is immutable (frozen registry guard)
 *   b2-t6  Replacement dir content survives (not affected by migration)
 *   b2-t7  Obsolete dir with nested content is removed recursively
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const {
  migrateObsoleteToolDirs,
  OBSOLETE_TOOL_SKILL_DIRS,
  // Story 31.16 — the REAL manifest writers. Fixtures are built through these so
  // no test ever hand-writes the `.ma-agents.json` shape; the record under test
  // is produced by the same code production uses (`performInstall` calls exactly
  // this pair at lib/installer.js:2108-2115).
  ensureManifest,
  writeManifest
} = require('../lib/installer');

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.stack || err.message}`);
    failed++;
    errors.push({ name, err });
  }
}

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-b2-'));
}

function cleanup(dir) {
  try { fs.removeSync(dir); } catch { /* ignore */ }
}

/**
 * Install one skill into `skillsDir` the way ma-agents installs one: a directory
 * named for the skill id holding a SKILL.md (`performInstall` installs to
 * `path.join(installPath, skillId)`, lib/installer.js:1754), plus an entry under
 * `.ma-agents.json::skills` written through the REAL writers `ensureManifest` +
 * `writeManifest` (the exact pair `performInstall` uses at :2108-2115).
 *
 * Nothing here hand-writes the manifest shape — that is the point. The record the
 * sweep reads is produced by production code, so it stays correct by construction
 * if that shape ever changes.
 */
function installSkillAsMaAgents(skillsDir, skillId) {
  fs.ensureDirSync(path.join(skillsDir, skillId));
  fs.writeFileSync(
    path.join(skillsDir, skillId, 'SKILL.md'),
    `---\nname: ${skillId}\ndescription: seeded by the real installer writers\n---\n`,
    'utf-8'
  );
  const manifest = ensureManifest(skillsDir, 'github-copilot', 'project');
  const now = new Date().toISOString();
  manifest.skills[skillId] = {
    version: '1.0.0',
    installedAt: now,
    updatedAt: now,
    installerVersion: '0.0.0-test',
    agentVersion: '0.0.0-test'
  };
  writeManifest(skillsDir, manifest);
}

/**
 * Simulate a pre-F2b project state:
 *   <projectRoot>/.github/copilot/skills/  — stale obsolete directory
 *   <projectRoot>/.github/skills/          — new replacement directory (if withNew=true)
 *
 * Story 31.16 — the obsolete directory is seeded as a directory holding ONLY
 * ma-agents-installed skills, recorded in its own manifest. That is what the b2-*
 * cases below have always meant by "stale obsolete dir": content ma-agents put
 * there and has since migrated elsewhere. It previously held one loose
 * `old-marker.md` that no manifest recorded, which under the pre-31.16 sweep was
 * indistinguishable from a user's hand-authored file — and was destroyed. See the
 * "story defect" note in the Story 31.16 completion record.
 */
function seedProject(projectRoot, { withObsolete = true, withNew = true, newHasContent = true } = {}) {
  fs.ensureDirSync(projectRoot);

  if (withObsolete) {
    const obsoleteDir = path.join(projectRoot, '.github', 'copilot', 'skills');
    fs.ensureDirSync(obsoleteDir);
    installSkillAsMaAgents(obsoleteDir, 'old-marker');
  }

  if (withNew) {
    const newDir = path.join(projectRoot, '.github', 'skills');
    fs.ensureDirSync(newDir);
    if (newHasContent) {
      const skillDir = path.join(newDir, 'code-review');
      fs.ensureDirSync(skillDir);
      fs.writeFileSync(path.join(skillDir, 'SKILL.md'), '# code-review\n');
    }
  }
}

console.log('\n bug B2 — Stale obsolete tool skills directory cleanup\n');

async function runAll() {

  // b2-t1 — Stale obsolete dir removed when replacement has content
  await test('b2-t1 Stale .github/copilot/skills removed when .github/skills has content', async () => {
    const tmp = mktemp();
    try {
      seedProject(tmp, { withObsolete: true, withNew: true, newHasContent: true });

      const results = await migrateObsoleteToolDirs(tmp);

      const obsoletePath = path.join(tmp, '.github', 'copilot', 'skills');
      const newPath = path.join(tmp, '.github', 'skills');

      assert.ok(!fs.existsSync(obsoletePath),
        '.github/copilot/skills should have been removed');
      assert.ok(fs.existsSync(newPath),
        '.github/skills must still exist');
      // One result per registry entry — the registry has grown beyond the
      // single original copilot entry (now also covers the .agents/skills
      // consolidation of .github/.roo/.kilocode), so assert against the
      // registry size rather than a hard-coded 1.
      assert.strictEqual(results.length, OBSOLETE_TOOL_SKILL_DIRS.length,
        'Should return one result per registry entry');
      const copilotResult = results.find(
        r => r.entry.obsolete === '.github/copilot/skills'
      );
      assert.ok(copilotResult,
        'expected a result for the .github/copilot/skills entry');
      assert.strictEqual(copilotResult.action, 'removed',
        'action should be "removed" for the seeded obsolete dir');
      assert.strictEqual(copilotResult.error, null,
        'error should be null on a clean removal');
    } finally {
      cleanup(tmp);
    }
  });

  // b2-t2 — Obsolete dir preserved when replacement is absent (user may have local edits)
  await test('b2-t2 Obsolete dir preserved when replacement dir is absent', async () => {
    const tmp = mktemp();
    try {
      seedProject(tmp, { withObsolete: true, withNew: false, newHasContent: false });

      const results = await migrateObsoleteToolDirs(tmp);

      const obsoletePath = path.join(tmp, '.github', 'copilot', 'skills');
      assert.ok(fs.existsSync(obsoletePath),
        '.github/copilot/skills must NOT be removed when replacement is absent');
      assert.strictEqual(results[0].action, 'preserved',
        'action should be "preserved" when replacement is absent');
    } finally {
      cleanup(tmp);
    }
  });

  // b2-t2b — Obsolete dir preserved when replacement dir exists but is empty
  await test('b2-t2b Obsolete dir preserved when replacement dir is empty', async () => {
    const tmp = mktemp();
    try {
      seedProject(tmp, { withObsolete: true, withNew: true, newHasContent: false });

      const results = await migrateObsoleteToolDirs(tmp);

      const obsoletePath = path.join(tmp, '.github', 'copilot', 'skills');
      assert.ok(fs.existsSync(obsoletePath),
        '.github/copilot/skills must NOT be removed when replacement is empty');
      assert.strictEqual(results[0].action, 'preserved',
        'action should be "preserved" when replacement is empty');
    } finally {
      cleanup(tmp);
    }
  });

  // b2-t3 — No-op when obsolete dir is absent (already clean / second upgrade)
  await test('b2-t3 No-op when obsolete dir is absent (idempotent)', async () => {
    const tmp = mktemp();
    try {
      seedProject(tmp, { withObsolete: false, withNew: true, newHasContent: true });

      const results = await migrateObsoleteToolDirs(tmp);

      assert.strictEqual(results[0].action, 'noop',
        'action should be "noop" when obsolete dir is absent');
      assert.strictEqual(results[0].error, null,
        'no error on a no-op run');
    } finally {
      cleanup(tmp);
    }
  });

  // b2-t4 — Idempotency: two consecutive migrations produce the same end state
  await test('b2-t4 Idempotency: second migration call is a no-op without error', async () => {
    const tmp = mktemp();
    try {
      seedProject(tmp, { withObsolete: true, withNew: true, newHasContent: true });

      const firstResults = await migrateObsoleteToolDirs(tmp);
      assert.strictEqual(firstResults[0].action, 'removed', 'first run should remove');

      // Second run — obsolete dir no longer exists
      const secondResults = await migrateObsoleteToolDirs(tmp);
      assert.strictEqual(secondResults[0].action, 'noop', 'second run should be noop');
      assert.strictEqual(secondResults[0].error, null, 'no error on second run');
    } finally {
      cleanup(tmp);
    }
  });

  // b2-t5 — OBSOLETE_TOOL_SKILL_DIRS is frozen
  await test('b2-t5 OBSOLETE_TOOL_SKILL_DIRS is immutable (frozen)', () => {
    assert.ok(Object.isFrozen(OBSOLETE_TOOL_SKILL_DIRS),
      'OBSOLETE_TOOL_SKILL_DIRS must be frozen to prevent accidental mutation by callers');
    assert.ok(Array.isArray(OBSOLETE_TOOL_SKILL_DIRS),
      'OBSOLETE_TOOL_SKILL_DIRS must be an array');
    assert.ok(OBSOLETE_TOOL_SKILL_DIRS.length >= 1,
      'Registry must have at least one entry (the copilot pre-F2b path)');

    // Verify the required copilot entry is present
    const copilotEntry = OBSOLETE_TOOL_SKILL_DIRS.find(e => e.obsolete === '.github/copilot/skills');
    assert.ok(copilotEntry, 'Registry must include the copilot pre-F2b entry { obsolete: ".github/copilot/skills" }');
    assert.strictEqual(copilotEntry.replacedBy, '.github/skills',
      'copilot entry replacedBy must be .github/skills');
  });

  // b2-t6 — Replacement dir and its content survive migration untouched
  await test('b2-t6 Replacement .github/skills content is intact after migration', async () => {
    const tmp = mktemp();
    try {
      seedProject(tmp, { withObsolete: true, withNew: true, newHasContent: true });
      const skillPath = path.join(tmp, '.github', 'skills', 'code-review', 'SKILL.md');
      assert.ok(fs.existsSync(skillPath), 'Skill file must exist before migration (seed check)');
      const beforeContent = fs.readFileSync(skillPath, 'utf-8');

      await migrateObsoleteToolDirs(tmp);

      const afterContent = fs.readFileSync(skillPath, 'utf-8');
      assert.strictEqual(afterContent, beforeContent,
        'Skill file in replacement dir must be byte-identical after migration');
    } finally {
      cleanup(tmp);
    }
  });

  // b2-t7 — Obsolete dir with nested subdirectories is removed recursively
  await test('b2-t7 Obsolete dir with nested content is removed recursively', async () => {
    const tmp = mktemp();
    try {
      // Create the new replacement dir with content
      const newDir = path.join(tmp, '.github', 'skills');
      fs.ensureDirSync(newDir);
      fs.writeFileSync(path.join(newDir, 'code-review.md'), '# code-review\n', 'utf-8');

      // Create a deeply nested obsolete dir. Story 31.16: the nesting sits INSIDE
      // a manifested skill directory — `some-skill` is ma-agents-installed and
      // recorded, and `nested/deep-file.md` is arbitrary depth underneath it. The
      // recursive removal is what this case proves, and it still proves it.
      const obsoleteDir = path.join(tmp, '.github', 'copilot', 'skills');
      fs.ensureDirSync(obsoleteDir);
      installSkillAsMaAgents(obsoleteDir, 'some-skill');
      const nestedDir = path.join(obsoleteDir, 'some-skill', 'nested');
      fs.ensureDirSync(nestedDir);
      fs.writeFileSync(path.join(nestedDir, 'deep-file.md'), '# deep\n', 'utf-8');

      await migrateObsoleteToolDirs(tmp);

      assert.ok(!fs.existsSync(obsoleteDir),
        'Obsolete dir must be recursively removed even when it contains nested subdirs');
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
