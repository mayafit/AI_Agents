#!/usr/bin/env node
/**
 * Story 30.6b — prune + stage + install-the-subset tests.
 *
 * Covers:
 *   1. Prune correctness (discovery mode): the staged marketplace.json
 *      contains ONLY the selected plugins; unselected plugins' content is
 *      never copied into the stage.
 *   2. FR238 fail-loud pre-flight guard: zero installable modules, a module
 *      with zero skill directories, and a module with a duplicate skill leaf
 *      all throw CustomMarketplaceError BEFORE anything is staged.
 *   3. Direct-mode staging (FR240): the source-root SKILL.md scan + synthetic
 *      marketplace.json construction.
 *   4. install-args shape: buildBmadArgs() threads the staged customSourceArg
 *      through as `--action update --custom-source "./..."`.
 *   5. base-install-failed short-circuit (AC 6): resolveBaseBmadOk() pure
 *      policy — declined/failed base install must never green-light the
 *      custom-marketplace subset install.
 *   6. Cline-wrapper reconcile: installCustomMarketplaceSubset() re-runs
 *      deployClineWorkflows() after a successful install.
 *
 * Network-free, no real bmad-method CLI invocation (runCommand is never
 * reached in these tests — command construction is verified via
 * buildBmadArgs() directly, and installCustomMarketplaceSubset()'s post-stage
 * behavior is verified against a stubbed runCommand-free path by exercising
 * only the staging + guard functions, which is where all the story's new
 * logic lives). All temp dirs are cleaned up in `finally` blocks.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

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
  enumerateCustomSource,
  CustomMarketplaceError,
  assertResolutionNonEmptyAndUniqueLeaves,
  stageCustomMarketplaceSubset,
  CUSTOM_MARKETPLACE_STAGE_DIR_NAME,
} = require('../lib/custom-marketplace');
const bmad = require('../lib/bmad');
const { resolveBaseBmadOk } = require('../bin/cli.js');

const FIXTURE_ROOT = path.join(process.cwd(), '.tmp-custom-marketplace-stage-test');

function freshFixtureRoot() {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
}

function writeSkill(dir, name, description) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\nBody.\n`
  );
}

/** Discovery-mode fixture: 3 plugins, each with one skill dir, no module.yaml
 *  anywhere (so PluginResolver falls to strategy 5 — synthesized fallback,
 *  the simplest reliable fixture to construct). */
function makeDiscoverySource() {
  const dir = path.join(FIXTURE_ROOT, 'source');
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  writeSkill(path.join(dir, 'alpha', 'skill-a'), 'Skill A', 'Alpha skill');
  writeSkill(path.join(dir, 'beta', 'skill-b'), 'Skill B', 'Beta skill');
  writeSkill(path.join(dir, 'gamma', 'skill-c'), 'Skill C', 'Gamma skill');
  fs.writeFileSync(
    path.join(dir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({
      name: 'test-marketplace',
      owner: 'ma-agents-test',
      plugins: [
        { name: 'alpha-mod', description: 'Alpha', version: '1.0.0', source: './alpha', skills: ['./alpha/skill-a'] },
        { name: 'beta-mod', description: 'Beta', version: '1.0.0', source: './beta', skills: ['./beta/skill-b'] },
        { name: 'gamma-mod', description: 'Gamma', version: '1.0.0', source: './gamma', skills: ['./gamma/skill-c'] },
      ],
    })
  );
  return dir;
}

(async () => {
  console.log('\nstageCustomMarketplaceSubset() — prune correctness + local staging (discovery mode)');

  await test('stages ONLY the selected plugins; unselected plugin content is never copied', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = makeDiscoverySource();
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      assert.strictEqual(enumerated.mode, 'discovery');
      assert.strictEqual(enumerated.plugins.length, 3);

      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const result = await stageCustomMarketplaceSubset({
        source: relSource,
        mode: enumerated.mode,
        rootDir: enumerated.rootDir,
        sourceUrl: enumerated.sourceUrl,
        plugins: enumerated.plugins,
        selectedCodes: ['alpha-mod', 'gamma-mod'],
        projectRoot,
      });

      assert.strictEqual(result.customSourceArg, `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`);
      assert.strictEqual(result.resolvedModules.length, 2, 'one resolved module per selected plugin (strategy 5)');

      const stagedMarketplace = JSON.parse(
        fs.readFileSync(path.join(result.stagePath, '.claude-plugin', 'marketplace.json'), 'utf8')
      );
      assert.deepStrictEqual(
        stagedMarketplace.plugins.map((p) => p.name).sort(),
        ['alpha-mod', 'gamma-mod'],
        'pruned marketplace.json must contain ONLY the selected plugins'
      );

      assert.ok(fs.existsSync(path.join(result.stagePath, 'alpha', 'skill-a', 'SKILL.md')), 'selected plugin content must be staged');
      assert.ok(fs.existsSync(path.join(result.stagePath, 'gamma', 'skill-c', 'SKILL.md')), 'selected plugin content must be staged');
      assert.ok(!fs.existsSync(path.join(result.stagePath, 'beta')), 'unselected plugin content must NOT be copied into the stage');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('re-staging (a second call) wipes the stale stage rather than merging', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = makeDiscoverySource();
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      await stageCustomMarketplaceSubset({
        source: relSource, mode: enumerated.mode, rootDir: enumerated.rootDir, sourceUrl: enumerated.sourceUrl,
        plugins: enumerated.plugins, selectedCodes: ['alpha-mod', 'beta-mod', 'gamma-mod'], projectRoot,
      });
      const second = await stageCustomMarketplaceSubset({
        source: relSource, mode: enumerated.mode, rootDir: enumerated.rootDir, sourceUrl: enumerated.sourceUrl,
        plugins: enumerated.plugins, selectedCodes: ['alpha-mod'], projectRoot,
      });
      assert.ok(!fs.existsSync(path.join(second.stagePath, 'beta')), 'stale stage content from the first call must not survive re-staging');
      assert.ok(!fs.existsSync(path.join(second.stagePath, 'gamma')));
      assert.ok(fs.existsSync(path.join(second.stagePath, 'alpha', 'skill-a', 'SKILL.md')));
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('strategy-1 fixture (a REAL module.yaml + module-help.csv at the skills common parent) is also copied into the stage', async () => {
    // The other fixtures all fall through PluginResolver's strategy 5
    // (synthesized fallback — no module.yaml anywhere). Real-world marketplace
    // plugins commonly DO ship a module.yaml, which PluginResolver resolves
    // via strategy 1 (root module files at the skills' common parent) and
    // returns as `moduleYamlPath`/`moduleHelpCsvPath` instead of a synthesized
    // string. This exercises that the staging copy actually reaches those
    // fields (the `if (mod.moduleYamlPath) copyRelativeToRoot(...)` branch).
    freshFixtureRoot();
    try {
      const dir = path.join(FIXTURE_ROOT, 'source');
      fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
      writeSkill(path.join(dir, 'delta', 'skill-d1'), 'Skill D1', 'D1');
      writeSkill(path.join(dir, 'delta', 'skill-d2'), 'Skill D2', 'D2');
      fs.writeFileSync(
        path.join(dir, 'delta', 'module.yaml'),
        'code: delta-mod\nname: Delta Module\ndescription: Delta\nmodule_version: "1.0.0"\n'
      );
      fs.writeFileSync(path.join(dir, 'delta', 'module-help.csv'), 'module,skill,display_name\n');
      fs.writeFileSync(
        path.join(dir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: 'test-marketplace-strategy1',
          plugins: [{ name: 'delta-mod', description: 'Delta', version: '1.0.0', source: './delta', skills: ['./delta/skill-d1', './delta/skill-d2'] }],
        })
      );
      const relSource = './' + path.relative(process.cwd(), dir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const result = await stageCustomMarketplaceSubset({
        source: relSource, mode: enumerated.mode, rootDir: enumerated.rootDir, sourceUrl: enumerated.sourceUrl,
        plugins: enumerated.plugins, selectedCodes: ['delta-mod'], projectRoot,
      });

      assert.strictEqual(result.resolvedModules.length, 1);
      assert.strictEqual(result.resolvedModules[0].strategy, 1, 'fixture must actually exercise PluginResolver strategy 1');
      assert.ok(fs.existsSync(path.join(result.stagePath, 'delta', 'module.yaml')), 'the real module.yaml must be copied into the stage');
      assert.ok(fs.existsSync(path.join(result.stagePath, 'delta', 'module-help.csv')), 'the real module-help.csv must be copied into the stage');
      assert.ok(fs.existsSync(path.join(result.stagePath, 'delta', 'skill-d1', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(result.stagePath, 'delta', 'skill-d2', 'SKILL.md')));
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nstageCustomMarketplaceSubset() — FR240 direct-mode staging');

  await test('direct mode: scans for SKILL.md subdirs and stages them under a synthesized marketplace.json', async () => {
    freshFixtureRoot();
    try {
      const dir = path.join(FIXTURE_ROOT, 'direct-source');
      writeSkill(path.join(dir, 'skill-x'), 'Skill X', 'X');
      writeSkill(path.join(dir, 'skill-y'), 'Skill Y', 'Y');
      const relSource = './' + path.relative(process.cwd(), dir).split(path.sep).join('/');

      const enumerated = await enumerateCustomSource(relSource);
      assert.strictEqual(enumerated.mode, 'direct');
      assert.strictEqual(enumerated.plugins.length, 1);
      const code = enumerated.plugins[0].code;

      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const result = await stageCustomMarketplaceSubset({
        source: relSource, mode: enumerated.mode, rootDir: enumerated.rootDir, sourceUrl: enumerated.sourceUrl,
        plugins: enumerated.plugins, selectedCodes: [code], projectRoot,
      });

      assert.ok(result.resolvedModules.length >= 1);
      assert.ok(fs.existsSync(path.join(result.stagePath, 'skill-x', 'SKILL.md')));
      assert.ok(fs.existsSync(path.join(result.stagePath, 'skill-y', 'SKILL.md')));
      const stagedMarketplace = JSON.parse(
        fs.readFileSync(path.join(result.stagePath, '.claude-plugin', 'marketplace.json'), 'utf8')
      );
      assert.strictEqual(stagedMarketplace.plugins.length, 1);
      assert.deepStrictEqual([...stagedMarketplace.plugins[0].skills].sort(), ['skill-x', 'skill-y']);
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nassertResolutionNonEmptyAndUniqueLeaves() — FR238 fail-loud pre-flight guard');

  await test('throws CustomMarketplaceError on zero resolved modules', () => {
    assert.throws(
      () => assertResolutionNonEmptyAndUniqueLeaves([], { source: 'test-source' }),
      (err) => err instanceof CustomMarketplaceError && /zero installable modules/.test(err.message)
    );
  });

  await test('throws CustomMarketplaceError when a resolved module has zero skill directories', () => {
    assert.throws(
      () => assertResolutionNonEmptyAndUniqueLeaves(
        [{ resolved: [{ code: 'empty-mod', pluginName: 'empty-mod', skillPaths: [] }] }],
        { source: 'test-source' }
      ),
      (err) => err instanceof CustomMarketplaceError && /zero skill directories/.test(err.message)
    );
  });

  await test('throws CustomMarketplaceError on a duplicate skill leaf WITHIN one module', () => {
    assert.throws(
      () => assertResolutionNonEmptyAndUniqueLeaves(
        [{
          resolved: [{
            code: 'dup-mod',
            pluginName: 'dup-mod',
            skillPaths: [path.join('a', 'dup-skill'), path.join('b', 'dup-skill')],
          }],
        }],
        { source: 'test-source' }
      ),
      (err) => err instanceof CustomMarketplaceError && /share the leaf name 'dup-skill'/.test(err.message)
    );
  });

  await test('does NOT throw on the same leaf name reused ACROSS two different modules (matches upstream scope)', () => {
    assert.doesNotThrow(() =>
      assertResolutionNonEmptyAndUniqueLeaves(
        [
          { resolved: [{ code: 'mod-a', pluginName: 'mod-a', skillPaths: [path.join('a', 'shared-name')] }] },
          { resolved: [{ code: 'mod-b', pluginName: 'mod-b', skillPaths: [path.join('b', 'shared-name')] }] },
        ],
        { source: 'test-source' }
      )
    );
  });

  await test('stageCustomMarketplaceSubset() rejects a selection with a dangling skill path before touching disk', async () => {
    freshFixtureRoot();
    try {
      const dir = path.join(FIXTURE_ROOT, 'dangling-source');
      fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
      fs.writeFileSync(
        path.join(dir, '.claude-plugin', 'marketplace.json'),
        JSON.stringify({
          name: 'dangling',
          plugins: [{ name: 'ghost-mod', description: '', version: '1.0.0', source: './ghost', skills: ['./ghost/does-not-exist'] }],
        })
      );
      const relSource = './' + path.relative(process.cwd(), dir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      await assert.rejects(
        () => stageCustomMarketplaceSubset({
          source: relSource, mode: enumerated.mode, rootDir: enumerated.rootDir, sourceUrl: enumerated.sourceUrl,
          plugins: enumerated.plugins, selectedCodes: ['ghost-mod'], projectRoot,
        }),
        (err) => err instanceof CustomMarketplaceError && /zero installable modules/.test(err.message)
      );
      assert.ok(!fs.existsSync(path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME)), 'nothing should be staged when the pre-flight guard rejects the selection');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\ninstall-args shape — buildBmadArgs() threads the staged customSourceArg as an update');

  await test('buildBmadArgs({ action: "update", customSource }) produces the expected --custom-source update command', () => {
    const command = bmad.buildBmadArgs({
      projectRoot: '/tmp/some-project',
      modules: ['bmm', 'bmb'],
      tools: ['claude-code'],
      action: 'update',
      customSource: `./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}`,
    });
    assert.ok(command.includes('--action update'), `expected --action update in: ${command}`);
    assert.ok(command.includes(`"./${CUSTOM_MARKETPLACE_STAGE_DIR_NAME}"`), `expected the ./-relative stage arg quoted in: ${command}`);
    assert.ok(command.includes('--yes'), `expected --yes in: ${command}`);
    assert.ok(command.includes('--modules bmm,bmb'), `expected --modules bmm,bmb in: ${command}`);
  });

  console.log('\nresolveBaseBmadOk() — Story 30.6b AC 6 base-install-failed short-circuit policy');

  await test('not attempted + BMAD was already installed: usable (existing base)', () => {
    assert.strictEqual(resolveBaseBmadOk({ bmadInstalled: true, attempted: false }), true);
  });

  await test('not attempted + BMAD was NOT already installed (declined a fresh install): not usable', () => {
    assert.strictEqual(resolveBaseBmadOk({ bmadInstalled: false, attempted: false }), false);
  });

  await test('attempted + succeeded: usable regardless of prior state', () => {
    assert.strictEqual(resolveBaseBmadOk({ bmadInstalled: false, attempted: true, success: true }), true);
    assert.strictEqual(resolveBaseBmadOk({ bmadInstalled: true, attempted: true, success: true }), true);
  });

  await test('attempted + failed: NOT usable, even if BMAD was already installed before the failed update', () => {
    assert.strictEqual(resolveBaseBmadOk({ bmadInstalled: true, attempted: true, success: false }), false);
    assert.strictEqual(resolveBaseBmadOk({ bmadInstalled: false, attempted: true, success: false }), false);
  });

  console.log('\ninstallCustomMarketplaceSubset() — FR242 Cline-wrapper reconcile + stage cleanup on success');

  await test('on success: reconciles Cline wrappers and cleans up the stage', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = makeDiscoverySource();
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const selection = {
        source: relSource,
        mode: enumerated.mode,
        selectedCodes: ['alpha-mod'],
        plugins: enumerated.plugins,
        rootDir: enumerated.rootDir,
        sourceUrl: enumerated.sourceUrl,
      };

      // Injectable seam (lib/bmad.js#installCustomMarketplaceSubset `deps`
      // param) — stub the bmad-method invocation itself (never spawn a real
      // child process in a unit test) but call through to the REAL
      // deployClineWorkflows so the Cline-reconcile assertion below exercises
      // actual, unstubbed behavior, not a recorded call.
      let runCommandCalls = 0;
      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: ['cline'],
        selection,
        deps: {
          runCommand: () => { runCommandCalls++; },
        },
      });

      assert.strictEqual(success, true);
      assert.strictEqual(runCommandCalls, 1, 'the stubbed bmad-method invocation must be called exactly once');
      assert.ok(!fs.existsSync(path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME)), 'stage must be cleaned up on success');
      // deployClineWorkflows is a no-op when .cline/skills/ doesn't exist in
      // the project (see its own early-return); the assertion that matters
      // here is that installCustomMarketplaceSubset reached that call at all
      // without throwing — covered by `success === true` above. A project
      // WITH .cline/skills content is exercised end-to-end next.
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('on success with real Cline skills present: generates workflow wrappers (FR242, real deployClineWorkflows)', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = makeDiscoverySource();
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      // Simulate a bmad-method invocation that ALSO placed Cline skill
      // content (as a real custom-source install would) by writing it
      // directly — the stubbed runCommand below stands in for bmad-method
      // itself, so this test supplies what bmad-method would have written.
      writeSkill(path.join(projectRoot, '.cline', 'skills', 'alpha-mod'), 'Alpha Mod', 'Alpha');

      const selection = {
        source: relSource,
        mode: enumerated.mode,
        selectedCodes: ['alpha-mod'],
        plugins: enumerated.plugins,
        rootDir: enumerated.rootDir,
        sourceUrl: enumerated.sourceUrl,
      };

      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: ['cline'],
        selection,
        deps: { runCommand: () => {} },
      });

      assert.strictEqual(success, true);
      assert.ok(
        fs.existsSync(path.join(projectRoot, '.clinerules', 'workflows', 'alpha-mod.md')),
        'deployClineWorkflows must have generated a workflow wrapper for the newly-installed custom module'
      );
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('on a failed bmad-method invocation: leaves the stage in place for diagnosis', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = makeDiscoverySource();
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');
      const enumerated = await enumerateCustomSource(relSource);
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const selection = {
        source: relSource,
        mode: enumerated.mode,
        selectedCodes: ['alpha-mod'],
        plugins: enumerated.plugins,
        rootDir: enumerated.rootDir,
        sourceUrl: enumerated.sourceUrl,
      };

      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: [],
        selection,
        deps: {
          runCommand: () => { throw new Error('simulated bmad-method failure'); },
        },
      });

      assert.strictEqual(success, false);
      assert.ok(
        fs.existsSync(path.join(projectRoot, CUSTOM_MARKETPLACE_STAGE_DIR_NAME)),
        'stage must be LEFT IN PLACE on a failed install for operator diagnosis'
      );
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('staging failure (before any bmad-method invocation) returns false without calling runCommand', async () => {
    freshFixtureRoot();
    try {
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      let runCommandCalls = 0;

      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: [],
        selection: {
          source: 'nonexistent',
          mode: 'discovery',
          selectedCodes: ['whatever'],
          plugins: [],
          rootDir: '/does/not/matter',
          sourceUrl: null,
        },
        deps: { runCommand: () => { runCommandCalls++; } },
      });

      assert.strictEqual(success, false);
      assert.strictEqual(runCommandCalls, 0, 'bmad-method must never be invoked when staging itself fails');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, error }) => {
      console.log(`  ${name}:`);
      console.log(`    ${error}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
})();
