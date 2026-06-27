#!/usr/bin/env node
/**
 * Story 27.6 — Verify PluginResolver / module-schema compatibility +
 * per-tool skill-enumeration passthrough on bmad-method v6.8.0 (FR210).
 *
 * This is a VERIFICATION story: ma-agents owns none of the renamed/retired
 * upstream skill bodies (bmad-create-ux-design→bmad-ux, bmad-distillator→
 * bmad-spec, new bmad-prd/bmad-investigate). They reach users via passthrough
 * (extends-module: bmm). The only ma-agents-side propagation is to generated
 * artifacts and ma-agents-OWNED enumerations. These tests pin:
 *
 *   AC1  The committed plugin bundle still resolves cleanly under v6.8.0's
 *        real PluginResolver — Strategy 1 (root module files), no schema break
 *        since the 6.6.0 baseline. The resolver is tool-agnostic, so the same
 *        result feeds both --tools claude-code and --tools cline installs; we
 *        additionally drive stagePlugin() (the exact code path every install
 *        uses) so the smoke covers staging + resolution end to end, offline.
 *
 *   AC2  ma-agents-owned enumerations (marketplace.json skills[], module.yaml,
 *        module-help.csv) carry NO orphaned references to the retired skills,
 *        and hardcode NONE of the passthrough upstream skill bodies. The new
 *        upstream skills are confirmed present at the passthrough SOURCE
 *        (node_modules/bmad-method) so passthrough delivers them.
 *
 *   AC3  With a v6.8.0-shaped .cline/skills/ set, deployClineWorkflows()
 *        (Story 27.4) gives renamed/new skills wrappers and removes wrappers
 *        for retired ones — end-to-end against the real upstream skill names.
 *
 *   AC4  The resolve + stage path runs with no network (Node built-ins only) —
 *        an offline smoke. The FULL egress-blocked gate is Story 27.7.
 *
 * Driven entirely offline against the installed bmad-method@6.8.0 package and
 * the committed bundle — no `npx ma-agents install` and no network.
 */
'use strict';

const assert = require('assert');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const BUNDLE_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension-plugin');
const SRC_EXT_DIR = path.join(PROJECT_ROOT, 'lib', 'bmad-extension');
const MARKETPLACE_JSON = path.join(BUNDLE_DIR, '.claude-plugin', 'marketplace.json');
const SRC_MODULE_YAML = path.join(SRC_EXT_DIR, 'skills', 'module.yaml');
const SRC_MODULE_CSV = path.join(SRC_EXT_DIR, 'skills', 'module-help.csv');
const BMAD_SRC = path.join(PROJECT_ROOT, 'node_modules', 'bmad-method', 'src');

// Retired/renamed-away upstream skills that must NOT appear as orphans in any
// ma-agents-owned enumeration. (They legitimately appear in planning docs,
// story files, and the GDS sync-plan as descriptions of the upstream change —
// those are NOT enumerations and are out of scope here.)
const RETIRED_UPSTREAM = ['bmad-create-ux-design', 'bmad-distillator'];
// Renamed/new upstream skills that v6.8.0 ships and that passthrough delivers.
const NEW_UPSTREAM = ['bmad-ux', 'bmad-spec', 'bmad-prd', 'bmad-investigate'];

const bmad = require('../lib/bmad');
const { deployClineWorkflows, stagePlugin } = bmad;

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
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-27-6-'));
}
function cleanup(dir) { try { fs.removeSync(dir); } catch { /* ignore */ } }

function readMarketplace() {
  return JSON.parse(fs.readFileSync(MARKETPLACE_JSON, 'utf8'));
}

/** Resolve the real v6.8.0 PluginResolver class. Skips the suite if the
 * package layout moved (so the failure is actionable, not cryptic). */
function loadPluginResolver() {
  const p = 'bmad-method/tools/installer/modules/plugin-resolver.js';
  const { PluginResolver } = require(p);
  assert.strictEqual(typeof PluginResolver, 'function',
    `${p} must export a PluginResolver class (v6.8.0 layout)`);
  return PluginResolver;
}

function seedSkill(projectRoot, name, { withWorkflow = false } = {}) {
  const skillDir = path.join(projectRoot, '.cline', 'skills', name);
  fs.ensureDirSync(skillDir);
  fs.writeFileSync(
    path.join(skillDir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: Upstream passthrough skill ${name}\n---\n# ${name}\nBody.\n`,
    'utf8'
  );
  if (withWorkflow) {
    fs.writeFileSync(path.join(skillDir, 'workflow.md'), '# workflow\nsteps\n', 'utf8');
  }
}

function seedStaleWrapper(projectRoot, name) {
  const workflowsDir = path.join(projectRoot, '.clinerules', 'workflows');
  fs.ensureDirSync(workflowsDir);
  const content = [
    `# ${name}`, '', 'Stale description', '',
    '## Step 1: Read and follow the BMAD skill instructions',
    `Read the file \`.cline/skills/${name}/SKILL.md\`. Follow all instructions in the body of that file exactly.`,
    ''
  ].join('\n');
  fs.writeFileSync(path.join(workflowsDir, `${name}.md`), content, 'utf8');
}

console.log('\n=== Story 27.6: PluginResolver compat + enumeration passthrough (v6.8.0) ===\n');

async function runAll() {
  // ─── AC1: PluginResolver / module-schema smoke ──────────────────────────
  console.log('--- AC1: PluginResolver / module-schema smoke (multi-tool, offline) ---');

  await test('AC1-1 bmad-method is pinned to 6.9.0 (the version under verification)', () => {
    // Introduced at v6.8.0 (Story 27.6); re-verified at v6.9.0 (Story 28.1 bump /
    // Story 28.3 passthrough). The PluginResolver layout + enumeration-passthrough
    // contract this suite checks is unchanged at v6.9.0 (Decision P5-6).
    const ver = require('bmad-method/package.json').version;
    assert.strictEqual(ver, '6.9.0',
      `expected bmad-method@6.9.0, found ${ver} — this suite verifies passthrough against the current pin`);
  });

  await test('AC1-2 committed bundle resolves via Strategy 1 under v6.8.0 PluginResolver', async () => {
    const PluginResolver = loadPluginResolver();
    const mkt = readMarketplace();
    const resolver = new PluginResolver();
    const resolved = await resolver.resolve(BUNDLE_DIR, mkt.plugins[0]);

    assert.ok(Array.isArray(resolved) && resolved.length === 1,
      `resolver must return exactly one module, got ${resolved && resolved.length}`);
    // Strategy 1 = root module.yaml + module-help.csv at the common parent of
    // all skills. A fall-through to Strategy 5 (synthesize) would silently mean
    // the resolver could no longer FIND our module files — a schema/layout break.
    assert.strictEqual(resolved[0].strategy, 1,
      `expected Strategy 1 (root module files), got Strategy ${resolved[0].strategy} — ` +
      'a layout/schema break would force a fallback strategy');
    assert.strictEqual(resolved[0].code, 'ma-skills', 'resolved module code must be ma-skills');
    assert.ok(resolved[0].moduleYamlPath && fs.existsSync(resolved[0].moduleYamlPath),
      'resolver must have located module.yaml');
    assert.ok(resolved[0].moduleHelpCsvPath && fs.existsSync(resolved[0].moduleHelpCsvPath),
      'resolver must have located module-help.csv');
  });

  await test('AC1-3 every marketplace-listed skill resolves to an on-disk dir in the bundle', async () => {
    const PluginResolver = loadPluginResolver();
    const mkt = readMarketplace();
    const listed = mkt.plugins[0].skills;
    const resolver = new PluginResolver();
    const resolved = await resolver.resolve(BUNDLE_DIR, mkt.plugins[0]);
    // The resolver filters out non-existent skill paths. If counts diverge, a
    // listed skill is missing from the bundle (drift) — fail loudly.
    assert.strictEqual(resolved[0].skillPaths.length, listed.length,
      `resolver resolved ${resolved[0].skillPaths.length} skill paths but the marketplace ` +
      `lists ${listed.length} — a listed skill is missing on disk`);
  });

  await test('AC1-4 stagePlugin() stages the bundle and yields a resolvable plugin (install code path)', async () => {
    // This drives the EXACT path every install uses (claude-code and cline
    // alike): stagePlugin() copies the committed bundle into the project, and
    // bmad-method's PluginResolver picks it up via --custom-source. We then run
    // the real resolver against the staged copy to prove the staged shape is
    // resolvable — the resolver is tool-agnostic, so this single smoke covers
    // both --tools claude-code and --tools cline.
    const dir = mktemp();
    try {
      const { stagePath, customSourceArg } = stagePlugin(dir);
      assert.ok(fs.existsSync(stagePath), 'stage dir must exist after stagePlugin()');
      assert.strictEqual(customSourceArg, './.ma-agents-plugin-stage',
        'customSourceArg must be the POSIX-relative stage path bmad-method consumes');
      // The staged copy must carry the two load-bearing manifests.
      assert.ok(fs.existsSync(path.join(stagePath, '.claude-plugin', 'marketplace.json')),
        'staged bundle must contain marketplace.json');
      assert.ok(fs.existsSync(path.join(stagePath, 'skills', 'module.yaml')),
        'staged bundle must contain skills/module.yaml');

      const PluginResolver = loadPluginResolver();
      const mkt = JSON.parse(
        fs.readFileSync(path.join(stagePath, '.claude-plugin', 'marketplace.json'), 'utf8'));
      const resolved = await new PluginResolver().resolve(stagePath, mkt.plugins[0]);
      assert.strictEqual(resolved.length, 1, 'staged plugin must resolve to one module');
      assert.strictEqual(resolved[0].strategy, 1, 'staged plugin must resolve via Strategy 1');
    } finally { cleanup(dir); }
  });

  // ─── AC2: Enumeration passthrough audit ─────────────────────────────────
  console.log('\n--- AC2: Enumeration passthrough audit ---');

  await test('AC2-1 marketplace.json skills[] has no orphaned retired-skill references', () => {
    const mkt = readMarketplace();
    const joined = mkt.plugins[0].skills.join('\n');
    for (const retired of RETIRED_UPSTREAM) {
      assert.ok(!joined.includes(retired),
        `marketplace.json skills[] still lists retired upstream skill "${retired}"`);
    }
  });

  await test('AC2-2 module.yaml + module-help.csv carry no retired-skill references', () => {
    const yamlText = fs.readFileSync(SRC_MODULE_YAML, 'utf8');
    const csvText = fs.readFileSync(SRC_MODULE_CSV, 'utf8');
    for (const retired of RETIRED_UPSTREAM) {
      assert.ok(!yamlText.includes(retired),
        `module.yaml references retired upstream skill "${retired}"`);
      assert.ok(!csvText.includes(retired),
        `module-help.csv references retired upstream skill "${retired}"`);
    }
  });

  await test('AC2-3 ma-agents owns NO upstream skill bodies — passthrough is via extends-module: bmm', () => {
    // The passthrough boundary (FR210): ma-agents must not hardcode any upstream
    // skill (renamed, retired, OR new) in its enumerations. Those arrive via the
    // bmm parent module. Hardcoding a "bmad-*" skill here would freeze the set
    // and defeat passthrough.
    const yamlText = fs.readFileSync(SRC_MODULE_YAML, 'utf8');
    assert.ok(/^\s*extends-module:\s*bmm\s*$/m.test(yamlText),
      'module.yaml must declare extends-module: bmm (passthrough parent)');
    const mkt = readMarketplace();
    const allUpstream = [...RETIRED_UPSTREAM, ...NEW_UPSTREAM];
    for (const sk of mkt.plugins[0].skills) {
      const base = path.basename(sk);
      assert.ok(!allUpstream.includes(base),
        `marketplace.json hardcodes upstream passthrough skill "${base}" — must come via bmm`);
    }
  });

  await test('AC2-4 new upstream skills are present at the passthrough SOURCE (bmad-method@6.8.0)', () => {
    // Confirm passthrough actually delivers the new set: each new skill must
    // exist somewhere under bmad-method/src so an install pulls it in via bmm.
    for (const sk of NEW_UPSTREAM) {
      const hits = findDirByName(BMAD_SRC, sk, 6);
      assert.ok(hits.length > 0,
        `new upstream skill "${sk}" not found under bmad-method/src — passthrough cannot deliver it`);
    }
  });

  await test('AC2-5 retired upstream skills are ABSENT at the passthrough source (rename completed upstream)', () => {
    for (const sk of RETIRED_UPSTREAM) {
      const hits = findDirByName(BMAD_SRC, sk, 6);
      assert.strictEqual(hits.length, 0,
        `retired upstream skill "${sk}" still present under bmad-method/src — ` +
        'expected it to be renamed/removed at v6.8.0');
    }
  });

  // ─── AC3: End-to-end Cline reconciliation against the v6.8.0 skill set ───
  console.log('\n--- AC3: End-to-end Cline reconciliation (v6.8.0 skill set) ---');

  await test('AC3-1 renamed/new skills get wrappers; retired ones do NOT (end-to-end)', async () => {
    const dir = mktemp();
    try {
      // v6.8.0-shaped live skill set: the renamed + new upstream skills are
      // deployed under .cline/skills/. bmad-prd is workflow-backed.
      seedSkill(dir, 'bmad-ux');
      seedSkill(dir, 'bmad-spec');
      seedSkill(dir, 'bmad-prd', { withWorkflow: true });
      seedSkill(dir, 'bmad-investigate');
      // Stale wrappers for the now-retired skills linger from a pre-6.8.0 install.
      seedStaleWrapper(dir, 'bmad-create-ux-design');
      seedStaleWrapper(dir, 'bmad-distillator');

      await deployClineWorkflows(dir, ['cline']);

      const wfDir = path.join(dir, '.clinerules', 'workflows');
      // Renamed + new → wrappers present.
      for (const live of NEW_UPSTREAM) {
        assert.ok(fs.existsSync(path.join(wfDir, `${live}.md`)),
          `wrapper for current skill "${live}" must be created`);
      }
      // Retired → wrappers removed.
      for (const retired of RETIRED_UPSTREAM) {
        assert.ok(!fs.existsSync(path.join(wfDir, `${retired}.md`)),
          `stale wrapper for retired skill "${retired}" must be removed`);
      }
      // Workflow-backed skill references workflow.md, not SKILL.md.
      const prd = fs.readFileSync(path.join(wfDir, 'bmad-prd.md'), 'utf8');
      assert.ok(prd.includes('.cline/skills/bmad-prd/workflow.md'),
        'workflow-backed wrapper must reference workflow.md');
    } finally { cleanup(dir); }
  });

  await test('AC3-2 reconciliation is idempotent across two runs (end-to-end)', async () => {
    const dir = mktemp();
    try {
      seedSkill(dir, 'bmad-ux');
      seedSkill(dir, 'bmad-spec');
      seedStaleWrapper(dir, 'bmad-distillator');

      await deployClineWorkflows(dir, ['cline']);
      const wfDir = path.join(dir, '.clinerules', 'workflows');
      const snap1 = snapshotDir(wfDir);
      await deployClineWorkflows(dir, ['cline']);
      const snap2 = snapshotDir(wfDir);
      assert.deepStrictEqual(snap2, snap1, 'second run must be byte-identical');
    } finally { cleanup(dir); }
  });

  // ─── AC4: Offline-path smoke (full gate is 27.7) ────────────────────────
  console.log('\n--- AC4: Offline-path smoke (full egress gate deferred to 27.7) ---');

  await test('AC4-1 resolve + stage run with no network declared (offline smoke)', async () => {
    const prev = process.env.MA_AGENTS_OFFLINE;
    process.env.MA_AGENTS_OFFLINE = '1';
    const dir = mktemp();
    try {
      assert.strictEqual(bmad.isOfflineModeDeclared(), true,
        'offline mode must be honored when MA_AGENTS_OFFLINE=1');
      // Stage + resolve use only the local bundle + node_modules — no fetch.
      const { stagePath } = stagePlugin(dir);
      const PluginResolver = loadPluginResolver();
      const mkt = JSON.parse(
        fs.readFileSync(path.join(stagePath, '.claude-plugin', 'marketplace.json'), 'utf8'));
      const resolved = await new PluginResolver().resolve(stagePath, mkt.plugins[0]);
      assert.strictEqual(resolved[0].strategy, 1,
        'offline resolve must still succeed via Strategy 1 (no regression)');
    } finally {
      if (prev !== undefined) process.env.MA_AGENTS_OFFLINE = prev;
      else delete process.env.MA_AGENTS_OFFLINE;
      cleanup(dir);
    }
  });

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) {
    errors.forEach(e => console.error(`  ${e.name}: ${e.error}`));
    process.exit(1);
  }
}

/**
 * Recursively find directories named `name` under `root`, bounded by `maxDepth`.
 * Returns absolute paths. Used to locate passthrough skills under bmad-method/src
 * without hardcoding upstream's internal phase-folder layout (which moves between
 * versions).
 */
function findDirByName(root, name, maxDepth) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const abs = path.join(dir, e.name);
      if (e.name === name) out.push(abs);
      walk(abs, depth + 1);
    }
  }
  walk(root, 0);
  return out;
}

function snapshotDir(root) {
  const out = {};
  function walk(dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
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
