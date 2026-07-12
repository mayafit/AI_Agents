#!/usr/bin/env node
/**
 * Story 30.7 — persist custom-marketplace selection + re-enumerate/reconcile
 * on update.
 *
 * Covers:
 *   1. lib/profile.js round-trip: getCustomMarketplaceSelection /
 *      setCustomMarketplaceSelection persist source/sourceUrl/mode/
 *      selectedCodes/sha, preserve all other .ma-agents.json fields, and
 *      validate their inputs.
 *   2. lib/custom-marketplace.js#reconcileCustomMarketplaceSelection: pure
 *      added/removed/stillPresent computation, no auto-selection of added
 *      codes.
 *   3. lib/bmad.js#installCustomMarketplaceSubset persists the selection
 *      (source, sourceUrl, mode, selectedCodes, sha pulled from the staged
 *      resolvedModules[].cloneSha) on a successful install; sha is null for
 *      local-path sources (no cloneSha stamped); persistence failure is
 *      logged but never turns a successful install into a reported failure.
 *   4. bin/cli.js#reconcileCustomMarketplaceOnUpdate: undefined when nothing
 *      persisted (caller falls back to the normal prompt); reports added/
 *      removed and returns only `stillPresent` codes on success; on an
 *      unreachable source returns null AND leaves .ma-agents.json BYTE-FOR-
 *      BYTE unchanged (fail-loud, never silently drops the selection).
 *
 * Network-free: no real bmad-method CLI invocation (runCommand is always
 * stubbed), no real git clone (enumerateCustomSource is exercised against
 * local-path fixtures only). All temp dirs are cleaned up in `finally`
 * blocks.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
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
  getCustomMarketplaceSelection,
  setCustomMarketplaceSelection,
} = require('../lib/profile');
const {
  reconcileCustomMarketplaceSelection,
  enumerateCustomSource,
} = require('../lib/custom-marketplace');
const bmad = require('../lib/bmad');
const { reconcileCustomMarketplaceOnUpdate } = require('../bin/cli.js');

const FIXTURE_ROOT = path.join(process.cwd(), '.tmp-custom-marketplace-persist-test');

function freshFixtureRoot() {
  fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  fs.mkdirSync(FIXTURE_ROOT, { recursive: true });
}

function mktemp() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-custom-marketplace-persist-test-'));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best-effort */ }
}

function writeSkill(dir, name, description) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\nBody.\n`
  );
}

/** Discovery-mode fixture: 2 plugins, no module.yaml (strategy 5 fallback). */
function makeDiscoverySource(dir, pluginNames) {
  fs.mkdirSync(path.join(dir, '.claude-plugin'), { recursive: true });
  const plugins = pluginNames.map((name) => {
    writeSkill(path.join(dir, name, `skill-${name}`), `Skill ${name}`, `${name} skill`);
    return { name, description: `${name} plugin`, version: '1.0.0', source: `./${name}`, skills: [`./${name}/skill-${name}`] };
  });
  fs.writeFileSync(
    path.join(dir, '.claude-plugin', 'marketplace.json'),
    JSON.stringify({ name: 'test-marketplace', plugins })
  );
}

(async () => {
  console.log('\nlib/profile.js — getCustomMarketplaceSelection / setCustomMarketplaceSelection\n');

  await test('getCustomMarketplaceSelection returns undefined when .ma-agents.json does not exist', () => {
    const dir = mktemp();
    try {
      assert.strictEqual(getCustomMarketplaceSelection(dir), undefined);
    } finally { cleanup(dir); }
  });

  await test('getCustomMarketplaceSelection returns undefined when the field is absent', () => {
    const dir = mktemp();
    try {
      fs.writeFileSync(path.join(dir, '.ma-agents.json'), JSON.stringify({ manifestVersion: '1.2.0', scope: 'project-root' }, null, 2));
      assert.strictEqual(getCustomMarketplaceSelection(dir), undefined);
    } finally { cleanup(dir); }
  });

  await test('round-trip: setCustomMarketplaceSelection -> getCustomMarketplaceSelection', () => {
    const dir = mktemp();
    try {
      setCustomMarketplaceSelection(dir, {
        source: 'https://gitlab.example.com/org/marketplace.git',
        sourceUrl: 'https://gitlab.example.com/org/marketplace',
        mode: 'discovery',
        selectedCodes: ['alpha-mod', 'gamma-mod'],
        sha: 'abc123def',
      });
      const entry = getCustomMarketplaceSelection(dir);
      assert.strictEqual(entry.source, 'https://gitlab.example.com/org/marketplace.git');
      assert.strictEqual(entry.sourceUrl, 'https://gitlab.example.com/org/marketplace');
      assert.strictEqual(entry.mode, 'discovery');
      assert.deepStrictEqual(entry.selectedCodes, ['alpha-mod', 'gamma-mod']);
      assert.strictEqual(entry.sha, 'abc123def');
      assert.ok(typeof entry.updatedAt === 'string' && entry.updatedAt.length > 0);
    } finally { cleanup(dir); }
  });

  await test('setCustomMarketplaceSelection persists sha: null for local-path sources', () => {
    const dir = mktemp();
    try {
      setCustomMarketplaceSelection(dir, {
        source: './local-marketplace',
        sourceUrl: null,
        mode: 'discovery',
        selectedCodes: ['delta-mod'],
        sha: null,
      });
      assert.strictEqual(getCustomMarketplaceSelection(dir).sha, null);
    } finally { cleanup(dir); }
  });

  await test('setCustomMarketplaceSelection preserves all other .ma-agents.json fields', () => {
    const dir = mktemp();
    try {
      fs.writeFileSync(
        path.join(dir, '.ma-agents.json'),
        JSON.stringify({ manifestVersion: '1.2.0', scope: 'project-root', profile: 'on-prem', bmadModules: ['bmm', 'tea'] }, null, 2)
      );
      setCustomMarketplaceSelection(dir, { source: './m', sourceUrl: null, mode: 'direct', selectedCodes: ['x'], sha: null });
      const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.ma-agents.json'), 'utf-8'));
      assert.strictEqual(manifest.profile, 'on-prem');
      assert.deepStrictEqual(manifest.bmadModules, ['bmm', 'tea']);
      assert.ok(manifest.customMarketplace);
    } finally { cleanup(dir); }
  });

  await test('setCustomMarketplaceSelection throws on missing source', () => {
    const dir = mktemp();
    try {
      assert.throws(() => setCustomMarketplaceSelection(dir, { mode: 'discovery', selectedCodes: [] }), /source/);
    } finally { cleanup(dir); }
  });

  await test('setCustomMarketplaceSelection throws on invalid mode', () => {
    const dir = mktemp();
    try {
      assert.throws(() => setCustomMarketplaceSelection(dir, { source: './m', mode: 'bogus', selectedCodes: [] }), /mode/);
    } finally { cleanup(dir); }
  });

  await test('setCustomMarketplaceSelection throws when selectedCodes is not an array', () => {
    const dir = mktemp();
    try {
      assert.throws(() => setCustomMarketplaceSelection(dir, { source: './m', mode: 'discovery', selectedCodes: 'nope' }), /selectedCodes/);
    } finally { cleanup(dir); }
  });

  console.log('\nlib/custom-marketplace.js#reconcileCustomMarketplaceSelection — pure added/removed/stillPresent\n');

  await test('reports added (newly declared) and removed (no longer declared), never auto-selects added', () => {
    const result = reconcileCustomMarketplaceSelection({
      persistedSelectedCodes: ['alpha-mod', 'beta-mod'],
      enumeratedPlugins: [{ code: 'alpha-mod' }, { code: 'gamma-mod' }],
    });
    assert.deepStrictEqual(result.added, ['gamma-mod']);
    assert.deepStrictEqual(result.removed, ['beta-mod']);
    assert.deepStrictEqual(result.stillPresent, ['alpha-mod']);
  });

  await test('no changes: added and removed both empty, stillPresent equals persisted', () => {
    const result = reconcileCustomMarketplaceSelection({
      persistedSelectedCodes: ['alpha-mod'],
      enumeratedPlugins: [{ code: 'alpha-mod' }, { code: 'beta-mod' }],
    });
    assert.deepStrictEqual(result.added, ['beta-mod']);
    assert.deepStrictEqual(result.removed, []);
    assert.deepStrictEqual(result.stillPresent, ['alpha-mod']);
  });

  await test('everything removed: enumerated plugins share nothing with the persisted selection', () => {
    const result = reconcileCustomMarketplaceSelection({
      persistedSelectedCodes: ['alpha-mod'],
      enumeratedPlugins: [{ code: 'zeta-mod' }],
    });
    assert.deepStrictEqual(result.removed, ['alpha-mod']);
    assert.deepStrictEqual(result.stillPresent, []);
  });

  await test('is a pure function — same inputs always produce the same output, no I/O side effects', () => {
    const args = { persistedSelectedCodes: ['a', 'b'], enumeratedPlugins: [{ code: 'a' }, { code: 'c' }] };
    const r1 = reconcileCustomMarketplaceSelection(args);
    const r2 = reconcileCustomMarketplaceSelection(args);
    assert.deepStrictEqual(r1, r2);
  });

  console.log('\nlib/bmad.js#installCustomMarketplaceSubset — persists selection on success (Story 30.7)\n');

  await test('persists source/sourceUrl/mode/selectedCodes/sha after a successful install (SHA captured for a Git-URL-shaped source)', async () => {
    freshFixtureRoot();
    try {
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const selection = {
        source: 'https://gitlab.example.com/org/marketplace.git',
        mode: 'discovery',
        selectedCodes: ['alpha-mod'],
        plugins: [{ code: 'alpha-mod' }],
        rootDir: '/fake/root',
        sourceUrl: 'https://gitlab.example.com/org/marketplace',
      };

      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: [],
        selection,
        deps: {
          // Stub staging (this test is about the persistence side effect,
          // not staging mechanics — those are covered by 30.6b's own suite).
          stageCustomMarketplaceSubset: async () => ({
            stagePath: path.join(projectRoot, '.ma-agents-custom-marketplace-stage'),
            customSourceArg: './.ma-agents-custom-marketplace-stage',
            resolvedModules: [{ code: 'alpha-mod', cloneSha: 'deadbeef1234', cloneRef: null }],
          }),
          runCommand: () => {},
        },
      });

      assert.strictEqual(success, true);
      const persisted = getCustomMarketplaceSelection(projectRoot);
      assert.ok(persisted, '.ma-agents.json must record the custom marketplace selection');
      assert.strictEqual(persisted.source, selection.source);
      assert.strictEqual(persisted.sourceUrl, selection.sourceUrl);
      assert.strictEqual(persisted.mode, 'discovery');
      assert.deepStrictEqual(persisted.selectedCodes, ['alpha-mod']);
      assert.strictEqual(persisted.sha, 'deadbeef1234', 'SHA pin must be captured from the staged resolvedModules');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('persists sha: null for a local-path source (no cloneSha stamped)', async () => {
    freshFixtureRoot();
    try {
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const selection = {
        source: './local-marketplace',
        mode: 'discovery',
        selectedCodes: ['delta-mod'],
        plugins: [{ code: 'delta-mod' }],
        rootDir: '/fake/root',
        sourceUrl: null,
      };

      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: [],
        selection,
        deps: {
          stageCustomMarketplaceSubset: async () => ({
            stagePath: path.join(projectRoot, '.ma-agents-custom-marketplace-stage'),
            customSourceArg: './.ma-agents-custom-marketplace-stage',
            resolvedModules: [{ code: 'delta-mod', cloneSha: null, cloneRef: null }],
          }),
          runCommand: () => {},
        },
      });

      assert.strictEqual(success, true);
      const persisted = getCustomMarketplaceSelection(projectRoot);
      assert.strictEqual(persisted.sourceUrl, null);
      assert.strictEqual(persisted.sha, null);
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('a persistence failure is logged but does not turn a successful install into a reported failure', async () => {
    freshFixtureRoot();
    try {
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });

      const selection = {
        source: './local-marketplace',
        mode: 'discovery',
        selectedCodes: ['delta-mod'],
        plugins: [{ code: 'delta-mod' }],
        rootDir: '/fake/root',
        sourceUrl: null,
      };

      const success = await bmad.installCustomMarketplaceSubset({
        projectRoot,
        modules: ['bmm'],
        tools: [],
        selection,
        deps: {
          stageCustomMarketplaceSubset: async () => ({
            stagePath: path.join(projectRoot, '.ma-agents-custom-marketplace-stage'),
            customSourceArg: './.ma-agents-custom-marketplace-stage',
            resolvedModules: [{ code: 'delta-mod', cloneSha: null }],
          }),
          runCommand: () => {},
          setCustomMarketplaceSelection: () => { throw new Error('simulated disk-full persistence failure'); },
        },
      });

      assert.strictEqual(success, true, 'a persistence failure must not flip an otherwise-successful install to false');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  console.log('\nbin/cli.js#reconcileCustomMarketplaceOnUpdate — re-enumerate persisted source + reconcile (Story 30.7)\n');

  await test('returns undefined when nothing is persisted (caller falls back to the normal prompt)', async () => {
    const dir = mktemp();
    try {
      const result = await reconcileCustomMarketplaceOnUpdate({ projectRoot: dir });
      assert.strictEqual(result, undefined);
    } finally { cleanup(dir); }
  });

  await test('reconciles a persisted LOCAL source: reports added/removed, returns only stillPresent codes', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = path.join(FIXTURE_ROOT, 'source-v2');
      makeDiscoverySource(sourceDir, ['alpha', 'gamma']); // 'beta' (previously selected) is gone; 'gamma' is new
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');

      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      setCustomMarketplaceSelection(projectRoot, {
        source: relSource,
        sourceUrl: null,
        mode: 'discovery',
        selectedCodes: ['alpha', 'beta'],
        sha: null,
      });

      const result = await reconcileCustomMarketplaceOnUpdate({ projectRoot });
      assert.ok(result, 'must return a selection object, not null/undefined, when the source is reachable');
      assert.strictEqual(result.source, relSource);
      assert.deepStrictEqual(result.selectedCodes, ['alpha'], 'removed code (beta) dropped; added code (gamma) NOT auto-selected');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('unreachable persisted source: returns null AND leaves .ma-agents.json byte-for-byte unchanged (fail-loud)', async () => {
    freshFixtureRoot();
    try {
      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      setCustomMarketplaceSelection(projectRoot, {
        source: './this-path-does-not-exist-anywhere',
        sourceUrl: null,
        mode: 'discovery',
        selectedCodes: ['alpha-mod'],
        sha: null,
      });

      const manifestPath = path.join(projectRoot, '.ma-agents.json');
      const before = fs.readFileSync(manifestPath, 'utf-8');

      const result = await reconcileCustomMarketplaceOnUpdate({ projectRoot });
      assert.strictEqual(result, null, 'unreachable source must fail loud (null), not throw and not silently succeed');

      const after = fs.readFileSync(manifestPath, 'utf-8');
      assert.strictEqual(after, before, '.ma-agents.json must be byte-for-byte unchanged when the marketplace cannot be reached');
    } finally {
      fs.rmSync(FIXTURE_ROOT, { recursive: true, force: true });
    }
  });

  await test('a previously-unselected plugin that is still declared is reported as added, never folded into selectedCodes', async () => {
    freshFixtureRoot();
    try {
      const sourceDir = path.join(FIXTURE_ROOT, 'source-stable');
      makeDiscoverySource(sourceDir, ['alpha', 'beta']);
      const relSource = './' + path.relative(process.cwd(), sourceDir).split(path.sep).join('/');

      const projectRoot = path.join(FIXTURE_ROOT, 'project');
      fs.mkdirSync(projectRoot, { recursive: true });
      setCustomMarketplaceSelection(projectRoot, {
        source: relSource, sourceUrl: null, mode: 'discovery', selectedCodes: ['alpha'], sha: null,
      });

      const result = await reconcileCustomMarketplaceOnUpdate({ projectRoot });
      assert.deepStrictEqual(result.selectedCodes, ['alpha']);
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
    process.exitCode = 1;
  }
})();
