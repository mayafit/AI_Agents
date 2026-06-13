#!/usr/bin/env node
/**
 * Story 27.4 — Cline workflow-wrapper reconciliation for renamed/retired
 * upstream skills.
 *
 * Verifies deployClineWorkflows() now reconciles `.clinerules/workflows/`
 * against the live `.cline/skills/` set:
 *
 *   27.4-t1  Stale wrapper (no backing .cline/skills/<name>/ dir) is removed (AC 1)
 *   27.4-t2  Wrapper for a renamed/new skill is created (AC 2)
 *   27.4-t3  User-authored files elsewhere under .clinerules/ are preserved (AC 3)
 *   27.4-t4  User-authored .md in workflows/ (non-wrapper shape) is preserved (AC 3)
 *   27.4-t5  Two consecutive runs are byte-identical / idempotent (AC 4)
 *   27.4-t6  No-op when 'cline' not in tools (guard)
 *   27.4-t7  isGeneratedClineWrapper matcher: shape discrimination (unit)
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const bmad = require('../lib/bmad');
const { deployClineWorkflows, isGeneratedClineWrapper } = bmad;

let passed = 0;
let failed = 0;
const errors = [];

async function test(name, fn) {
  const origLog = console.log;
  console.log = () => {};
  try {
    await fn();
    console.log = origLog;
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log = origLog;
    console.error(`  ✗ ${name}: ${err.stack || err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-cline-recon-'));
}
function cleanup(dir) { try { fs.removeSync(dir); } catch { /* ignore */ } }

/**
 * Seed a `.cline/skills/<name>/SKILL.md` so the skill is "live" and a wrapper
 * will be (re)generated for it.
 */
function seedSkill(projectRoot, name, { withWorkflow = false } = {}) {
  const skillDir = path.join(projectRoot, '.cline', 'skills', name);
  fs.ensureDirSync(skillDir);
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Test skill ${name}\n---\n# ${name}\nBody.\n`,
    'utf8'
  );
  if (withWorkflow) {
    fs.writeFileSync(path.join(skillDir, 'workflow.md'), '# workflow\nsteps\n', 'utf8');
  }
}

/**
 * Write a stale wrapper file into `.clinerules/workflows/` that LOOKS like a
 * ma-agents-generated wrapper (carries the `.cline/skills/<name>/` reference)
 * but has no backing skill dir.
 */
function seedStaleWrapper(projectRoot, name) {
  const workflowsDir = path.join(projectRoot, '.clinerules', 'workflows');
  fs.ensureDirSync(workflowsDir);
  const content = [
    `# ${name}`,
    '',
    'Some stale description',
    '',
    '## Step 1: Read and follow the BMAD skill instructions',
    `Read the file \`.cline/skills/${name}/SKILL.md\`. Follow all instructions in the body of that file exactly.`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(workflowsDir, `${name}.md`), content, 'utf8');
}

console.log('\n cline workflow-wrapper reconciliation tests (Story 27.4)\n');

async function runAll() {
  // 27.4-t1 — Stale wrapper with no backing skill dir is removed (AC 1)
  await test('27.4-t1 Stale wrapper (no backing .cline/skills dir) is removed (AC 1)', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-ux');
      // Retired skill: wrapper present but no backing skill dir.
      seedStaleWrapper(dir, 'bmad-create-ux-design');

      await deployClineWorkflows(dir, ['cline']);

      const stalePath = path.join(dir, '.clinerules', 'workflows', 'bmad-create-ux-design.md');
      assert.ok(!fs.existsSync(stalePath), 'stale wrapper must be removed');
      const livePath = path.join(dir, '.clinerules', 'workflows', 'bmad-ux.md');
      assert.ok(fs.existsSync(livePath), 'live wrapper must remain');
    } finally { cleanup(dir); }
  });

  // 27.4-t2 — Wrapper for a renamed/new skill is created (AC 2)
  await test('27.4-t2 Wrapper for a renamed/new skill is created (AC 2)', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-spec');
      seedSkill(dir, 'bmad-investigate');
      seedSkill(dir, 'bmad-prd', { withWorkflow: true });

      await deployClineWorkflows(dir, ['cline']);

      const wfDir = path.join(dir, '.clinerules', 'workflows');
      for (const n of ['bmad-spec', 'bmad-investigate', 'bmad-prd']) {
        assert.ok(fs.existsSync(path.join(wfDir, `${n}.md`)), `wrapper for ${n} must be created`);
      }
      // The workflow-backed skill should reference workflow.md, not SKILL.md.
      const prd = fs.readFileSync(path.join(wfDir, 'bmad-prd.md'), 'utf8');
      assert.ok(prd.includes('.cline/skills/bmad-prd/workflow.md'),
        'workflow-backed wrapper references workflow.md');
    } finally { cleanup(dir); }
  });

  // 27.4-t3 — User-authored files elsewhere under .clinerules/ preserved (AC 3)
  await test('27.4-t3 User file elsewhere under .clinerules/ is preserved (AC 3)', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-ux');
      // A user-authored top-level .clinerules file (not in workflows/).
      const userTop = path.join(dir, '.clinerules', 'my-rules.md');
      fs.ensureDirSync(path.join(dir, '.clinerules'));
      const userTopContent = '# My personal rules\nKeep these.\n';
      fs.writeFileSync(userTop, userTopContent, 'utf8');
      // A user-authored file in a sibling subdir under .clinerules/.
      const userSub = path.join(dir, '.clinerules', 'notes', 'todo.md');
      fs.ensureDirSync(path.dirname(userSub));
      const userSubContent = '# notes\n- do stuff\n';
      fs.writeFileSync(userSub, userSubContent, 'utf8');

      await deployClineWorkflows(dir, ['cline']);

      assert.ok(fs.existsSync(userTop), 'top-level user file preserved');
      assert.strictEqual(fs.readFileSync(userTop, 'utf8'), userTopContent, 'top-level user file unchanged');
      assert.ok(fs.existsSync(userSub), 'sibling-subdir user file preserved');
      assert.strictEqual(fs.readFileSync(userSub, 'utf8'), userSubContent, 'sibling-subdir user file unchanged');
    } finally { cleanup(dir); }
  });

  // 27.4-t4 — User-authored .md inside workflows/ (non-wrapper shape) preserved (AC 3)
  await test('27.4-t4 Non-wrapper user .md inside workflows/ is preserved (AC 3)', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-ux');
      // A user file that lives directly in workflows/ but does NOT carry the
      // generated-wrapper fingerprint — reconciliation must not delete it.
      const wfDir = path.join(dir, '.clinerules', 'workflows');
      fs.ensureDirSync(wfDir);
      const userWf = path.join(wfDir, 'my-custom-workflow.md');
      const userWfContent = '# My custom workflow\nDo the thing.\n';
      fs.writeFileSync(userWf, userWfContent, 'utf8');
      // Also a user file in a subdir under workflows/.
      const subWf = path.join(wfDir, 'shared', 'helper.md');
      fs.ensureDirSync(path.dirname(subWf));
      fs.writeFileSync(subWf, '# helper\n', 'utf8');

      await deployClineWorkflows(dir, ['cline']);

      assert.ok(fs.existsSync(userWf), 'non-wrapper user .md in workflows/ preserved');
      assert.strictEqual(fs.readFileSync(userWf, 'utf8'), userWfContent, 'user workflow content unchanged');
      assert.ok(fs.existsSync(subWf), 'user .md in workflows/ subdir preserved');
    } finally { cleanup(dir); }
  });

  // 27.4-t5 — Idempotency: two consecutive runs byte-identical (AC 4)
  await test('27.4-t5 Two consecutive runs are byte-identical (AC 4)', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-ux');
      seedSkill(dir, 'bmad-spec', { withWorkflow: true });
      seedStaleWrapper(dir, 'bmad-distillator');

      await deployClineWorkflows(dir, ['cline']);
      const wfDir = path.join(dir, '.clinerules', 'workflows');
      const snapshot1 = snapshotDir(wfDir);

      // Sanity: stale removed on first run.
      assert.ok(!fs.existsSync(path.join(wfDir, 'bmad-distillator.md')),
        'stale wrapper removed on first run');

      await deployClineWorkflows(dir, ['cline']);
      const snapshot2 = snapshotDir(wfDir);

      assert.deepStrictEqual(snapshot2, snapshot1,
        '.clinerules/workflows/ must be byte-identical across two runs');
    } finally { cleanup(dir); }
  });

  // 27.4-t6 — No-op when 'cline' not in tools (guard)
  await test('27.4-t6 No-op when cline not selected', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-ux');
      await deployClineWorkflows(dir, ['claude']);
      assert.ok(!fs.existsSync(path.join(dir, '.clinerules', 'workflows')),
        'workflows dir must not be created when cline is not selected');
    } finally { cleanup(dir); }
  });

  // 27.4-t7 — Matcher discriminates generated wrappers from user files (unit)
  await test('27.4-t7 isGeneratedClineWrapper discriminates by shape (unit)', () => {
    assert.strictEqual(
      isGeneratedClineWrapper('# X\n\nRead the file `.cline/skills/bmad-ux/SKILL.md`.\n'),
      true, 'SKILL.md-referencing wrapper recognized');
    assert.strictEqual(
      isGeneratedClineWrapper('# X\n\nRead `.cline/skills/bmad-prd/workflow.md`.\n'),
      true, 'workflow.md-referencing wrapper recognized');
    assert.strictEqual(
      isGeneratedClineWrapper('# My custom workflow\nDo the thing.\n'),
      false, 'plain user file is not a wrapper');
    assert.strictEqual(isGeneratedClineWrapper(''), false, 'empty string is not a wrapper');
    assert.strictEqual(isGeneratedClineWrapper(null), false, 'null is not a wrapper');
    // Back-slashed path (not our emitted shape) is not matched.
    assert.strictEqual(
      isGeneratedClineWrapper('Read `.cline\\skills\\x\\SKILL.md`'),
      false, 'back-slashed path not treated as wrapper');
  });

  console.log(`\n ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`   ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

/**
 * Build a deterministic name->content map of every file under `root`
 * (recursively) for byte-identical comparison across runs.
 */
function snapshotDir(root) {
  const out = {};
  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) walk(abs, rel);
      else out[rel] = fs.readFileSync(abs, 'utf8');
    }
  }
  if (fs.existsSync(root)) walk(root, '');
  return out;
}

runAll().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
