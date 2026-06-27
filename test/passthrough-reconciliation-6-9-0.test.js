#!/usr/bin/env node
/**
 * Tests for Story 28.3: Passthrough Reconciliation — bmad-forge-idea, the
 * bmad-architecture / bmad-create-architecture shim pair, and the deferred
 * hermes-agent / CodeWhale platforms (FR214, Decision P5-6(d)).
 *
 * v6.9.0 adds the `bmad-forge-idea` core skill and rewrites `bmad-architecture`
 * (keeping `bmad-create-architecture` as a forwarding shim until BMAD v7). These
 * reach ma-agents users purely via passthrough — the ONLY ma-agents-side work is
 * the EXISTING `deployClineWorkflows()` reconcile-and-prune (Story 27.4 / P5-5):
 * no new mechanism. Precondition (Story 28.1 Task 0) confirmed all three ship as
 * `.cline/skills/<name>/SKILL.md`-backed dirs, so each gets a wrapper and the
 * shim does not dangle.
 *
 *   28.3-t1  bmad-forge-idea gets a wrapper (AC1)
 *   28.3-t2  the architecture shim pair both get wrappers; neither dangles (AC2)
 *   28.3-t3  the live wrapper-set enumeration surfaces forge-idea + tolerates the
 *            shim pair; a genuinely retired skill is still pruned (AC3)
 *   28.3-t4  run twice ⇒ byte-identical (idempotent reconcile with the new set)
 *   28.3-t5  lib/agents.js registry has NO hermes-agent / CodeWhale entry (AC4/AC5c)
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const bmad = require('../lib/bmad');
const { deployClineWorkflows } = bmad;
const { getAllAgents } = require('../lib/agents');

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
    console.error(`  ✗ ${name}: ${err.message}`);
    failed++;
    errors.push({ name, error: err.message });
  }
}

function mktemp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-28-3-')); }
function cleanup(dir) { try { fs.removeSync(dir); } catch { /* ignore */ } }

// Seed a `.cline/skills/<name>/SKILL.md` (with realistic frontmatter) so the
// skill is "live" and a wrapper will be (re)generated for it.
function seedSkill(projectRoot, name, description) {
  const skillDir = path.join(projectRoot, '.cline', 'skills', name);
  fs.ensureDirSync(skillDir);
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nBody.\n`,
    'utf8'
  );
}

const workflowsDirOf = (root) => path.join(root, '.clinerules', 'workflows');
const wrapperExists = (root, name) => fs.existsSync(path.join(workflowsDirOf(root), `${name}.md`));

// The v6.9.0 passthrough skill set Cline would receive (the additions under test
// plus a couple of stable neighbors so the set is realistic).
function seedV690SkillSet(root) {
  seedSkill(root, 'bmad-forge-idea', 'Pressure-test an idea (new core skill at v6.9.0)');
  seedSkill(root, 'bmad-architecture', 'Lean-spine architecture (rewritten at v6.9.0)');
  seedSkill(root, 'bmad-create-architecture', 'Forwarding shim retained until BMAD v7');
  seedSkill(root, 'bmad-prd', 'PRD facilitator');
  seedSkill(root, 'bmad-spec', 'Spec kernel');
}

async function run() {
  console.log('\nStory 28.3: Passthrough Reconciliation (bmad-forge-idea, architecture shim, deferred platforms)\n');

  await test('28.3-t1 bmad-forge-idea gets a Cline wrapper after the v6.9.0 bump (AC1)', async () => {
    const root = mktemp();
    try {
      seedV690SkillSet(root);
      await deployClineWorkflows(root, ['cline']);
      assert.ok(wrapperExists(root, 'bmad-forge-idea'),
        '.clinerules/workflows/bmad-forge-idea.md must be generated for the new core skill');
    } finally { cleanup(root); }
  });

  await test('28.3-t2 the bmad-architecture / bmad-create-architecture shim pair both get wrappers; neither dangles (AC2)', async () => {
    const root = mktemp();
    try {
      seedV690SkillSet(root);
      await deployClineWorkflows(root, ['cline']);
      assert.ok(wrapperExists(root, 'bmad-architecture'),
        'bmad-architecture (rewrite) must get a wrapper');
      assert.ok(wrapperExists(root, 'bmad-create-architecture'),
        'bmad-create-architecture (forwarding shim, backed by a SKILL.md dir) must get a wrapper — not dangle');
    } finally { cleanup(root); }
  });

  await test('28.3-t3 live wrapper-set enumeration surfaces forge-idea + tolerates the shim pair; a retired skill is still pruned (AC3)', async () => {
    const root = mktemp();
    try {
      // First install: a pre-6.9.0 set that includes a now-retired skill.
      seedSkill(root, 'bmad-distillator', 'retired upstream — renamed to bmad-spec');
      seedSkill(root, 'bmad-prd', 'PRD facilitator');
      await deployClineWorkflows(root, ['cline']);
      assert.ok(wrapperExists(root, 'bmad-distillator'), 'precondition: stale wrapper exists from the first install');

      // Upgrade to the v6.9.0 set: distillator's backing dir is gone; forge-idea +
      // the architecture pair arrive. Reconcile must add the new and prune the stale.
      fs.removeSync(path.join(root, '.cline', 'skills', 'bmad-distillator'));
      seedV690SkillSet(root);
      await deployClineWorkflows(root, ['cline']);

      assert.ok(wrapperExists(root, 'bmad-forge-idea'), 'new skill surfaces in the live wrapper set');
      assert.ok(wrapperExists(root, 'bmad-architecture'), 'shim pair tolerated (architecture)');
      assert.ok(wrapperExists(root, 'bmad-create-architecture'), 'shim pair tolerated (create-architecture)');
      assert.ok(!wrapperExists(root, 'bmad-distillator'),
        'the retired skill\'s wrapper must be pruned (no dangling /-invocable workflow)');
    } finally { cleanup(root); }
  });

  await test('28.3-t4 reconcile with the v6.9.0 set is idempotent (two runs ⇒ byte-identical)', async () => {
    const root = mktemp();
    try {
      seedV690SkillSet(root);
      await deployClineWorkflows(root, ['cline']);
      const first = fs.readFileSync(path.join(workflowsDirOf(root), 'bmad-forge-idea.md'), 'utf8');
      await deployClineWorkflows(root, ['cline']);
      const second = fs.readFileSync(path.join(workflowsDirOf(root), 'bmad-forge-idea.md'), 'utf8');
      assert.strictEqual(first, second, 'a second reconcile run must be byte-identical');
    } finally { cleanup(root); }
  });

  await test('28.3-t5 lib/agents.js registry has NO hermes-agent / CodeWhale platform entry (AC4/AC5c)', () => {
    // Programmatic assertion against the exported registry (not a source grep —
    // the deferral COMMENT in agents.js intentionally names both platforms).
    const ids = getAllAgents().map(a => String(a.id).toLowerCase());
    const names = getAllAgents().map(a => String(a.name || '').toLowerCase());
    for (const banned of ['hermes', 'codewhale']) {
      assert.ok(!ids.some(id => id.includes(banned)),
        `lib/agents.js must NOT register a platform whose id contains "${banned}" (deferred per FR214/P5-6(d))`);
      assert.ok(!names.some(n => n.includes(banned)),
        `lib/agents.js must NOT register a platform whose name contains "${banned}" (deferred per FR214/P5-6(d))`);
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, error }) => console.log(`  ${name}: ${error}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

run();
