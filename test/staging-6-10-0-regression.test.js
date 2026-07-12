#!/usr/bin/env node
/**
 * Tests for Story 30.3: Bump bmad-method 6.9.0 -> 6.10.0 (staging regressions)
 *
 * The Story 30.1 GATE (`_bmad-output/implementation-artifacts/epic-runs/epic-30/
 * 30-1-gate-findings.md`, section 4) identified TWO genuinely NEW behaviors
 * introduced by bmad-method@6.10.0 that touch ma-agents' `--custom-source`
 * staging flow (`lib/bmad.js` `stagePlugin()` / `PLUGIN_STAGE_DIR_NAME`):
 *
 *   (a) `isLocalSourcePath()` (upstream PR #2511) — extracted from an inline
 *       POSIX-only check in `custom-module-manager.js` into a standalone
 *       function that ALSO recognizes `.\`, `..\`, and a Windows-absolute path
 *       (`path.win32.isAbsolute`). Exercised here via the public
 *       `CustomModuleManager.parseSource()` entry point (the actual call site),
 *       against the LITERAL string `lib/bmad.js` produces for `--custom-source`.
 *
 *   (b) `_copyResolvedSkills()` fail-loud guards in `official-modules.js` — NEW
 *       at 6.10.0 (0 occurrences at 6.9.0): throws on an empty marketplace-plugin
 *       resolution (before calling `_copyResolvedSkills`) and throws INSIDE
 *       `_copyResolvedSkills` on two skill directories that flatten to the same
 *       leaf name. ma-agents' staged plugin (`lib/bmad-extension-plugin/`,
 *       rebuilt by `npm run build:plugin`) rides through `--custom-source` into
 *       `installFromResolution()` -> `_copyResolvedSkills()` — the SAME shared
 *       function the registry marketplace-plugin path (e.g. `bmad-loop`) uses.
 *
 * This file does NOT re-implement or fork bmad-method's logic. It drives the
 * REAL installed `bmad-method@6.10.0` classes (`CustomModuleManager`,
 * `PluginResolver`, `OfficialModules`) directly against ma-agents' own staged
 * plugin bundle, fully offline (no network, no git clone, no interactive
 * prompts) — proving the two behaviors are neutral-to-beneficial for ma-agents'
 * actual staging output, not just plausible in the abstract.
 *
 * Requires `npm install` to have resolved `bmad-method@6.10.0` into
 * node_modules, and `npm run build:plugin` to have produced
 * `lib/bmad-extension-plugin/.claude-plugin/marketplace.json`.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const bmad = require('../lib/bmad');

let passed = 0;
let failed = 0;
const errors = [];
const tests = [];

function test(name, fn) {
  tests.push({ name, fn });
}

// Print a section header in run-order (not at registration time) so the header
// actually precedes the results that belong under it.
function group(header) {
  tests.push({ header });
}

async function run() {
  for (const entry of tests) {
    if (entry.header) {
      console.log(entry.header);
      continue;
    }
    const { name, fn } = entry;
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}: ${err.message}`);
      failed++;
      errors.push({ name, err });
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (errors.length > 0) {
    console.log('\nFailures:');
    errors.forEach(({ name, err }) => {
      console.log(`  ${name}:`);
      console.log(`    ${err.stack || err.message}`);
    });
  }
  process.exit(failed > 0 ? 1 : 0);
}

console.log('\nStory 30.3: bmad-method 6.10.0 staging regressions\n');

// Confirm the installed package really is 6.10.0 before trusting any of the
// below — a stale/partial install would make every other assertion here
// meaningless.
const installedBmadVersion = JSON.parse(
  fs.readFileSync(require.resolve('bmad-method/package.json'), 'utf8')
).version;

const { CustomModuleManager } = require('bmad-method/tools/installer/modules/custom-module-manager.js');
const { PluginResolver } = require('bmad-method/tools/installer/modules/plugin-resolver.js');
const { OfficialModules } = require('bmad-method/tools/installer/modules/official-modules.js');

// ---------------------------------------------------------------------------
// Group A — isLocalSourcePath / #2511, via CustomModuleManager.parseSource()
// ---------------------------------------------------------------------------

group('Group A: isLocalSourcePath (upstream #2511) via parseSource()');

test('sanity: installed bmad-method is 6.10.0', () => {
  assert.strictEqual(installedBmadVersion, '6.10.0');
});

test("ma-agents' actual --custom-source arg (./PLUGIN_STAGE_DIR_NAME) resolves to type 'local'", () => {
  const mgr = new CustomModuleManager();
  const arg = `./${bmad.PLUGIN_STAGE_DIR_NAME}`;
  const parsed = mgr.parseSource(arg);
  assert.strictEqual(parsed.type, 'local',
    `expected the staged customSourceArg "${arg}" to be classified 'local'; got ${JSON.stringify(parsed)}`);
  // isValid is false only because the stage directory doesn't exist in this
  // isolated test run — stagePlugin() creates it before bmad-method ever sees
  // the flag in the real flow. What matters here is the TYPE classification.
  assert.ok(parsed.error === null || /does not exist/i.test(parsed.error),
    `unexpected non path-existence error for a well-formed local path: ${parsed.error}`);
});

test('6.10.0 NEW: recognizes a .\\-prefixed Windows-relative path (was POSIX-only at 6.9.0)', () => {
  const mgr = new CustomModuleManager();
  const parsed = mgr.parseSource('.\\' + bmad.PLUGIN_STAGE_DIR_NAME);
  assert.strictEqual(parsed.type, 'local');
});

test('6.10.0 NEW: recognizes a ..\\-prefixed Windows-relative path (was POSIX-only at 6.9.0)', () => {
  const mgr = new CustomModuleManager();
  const parsed = mgr.parseSource('..\\some-sibling-dir');
  assert.strictEqual(parsed.type, 'local');
});

test('6.10.0 NEW: recognizes a Windows-absolute path via path.win32.isAbsolute (was POSIX-only at 6.9.0)', () => {
  const mgr = new CustomModuleManager();
  const parsed = mgr.parseSource('C:\\Users\\someone\\.ma-agents-plugin-stage');
  assert.strictEqual(parsed.type, 'local');
});

test('regression: POSIX local-path forms recognized at 6.9.0 remain recognized at 6.10.0', () => {
  const mgr = new CustomModuleManager();
  for (const input of ['./relative', '../relative', '/absolute/posix', '~/home-relative']) {
    const parsed = mgr.parseSource(input);
    assert.strictEqual(parsed.type, 'local', `expected "${input}" to stay classified 'local' at 6.10.0`);
  }
});

test('regression: a genuine remote Git URL is NOT misclassified as local by the widened 6.10.0 check', () => {
  const mgr = new CustomModuleManager();
  const parsed = mgr.parseSource('https://github.com/bmad-code-org/bmad-builder');
  assert.strictEqual(parsed.type, 'url',
    `the widened local-path detection must not swallow real URLs; got ${JSON.stringify(parsed)}`);
});

// ---------------------------------------------------------------------------
// Group B — _copyResolvedSkills fail-loud guards, against ma-agents' REAL
// generated plugin bundle (lib/bmad-extension-plugin), driven through the
// same PluginResolver + OfficialModules classes bmad-method uses internally.
// ---------------------------------------------------------------------------

group('\nGroup B: _copyResolvedSkills fail-loud (NEW at 6.10.0) against the real staged plugin');

const pluginRepoPath = path.join(projectRoot, 'lib', 'bmad-extension-plugin');
const marketplacePath = path.join(pluginRepoPath, '.claude-plugin', 'marketplace.json');

test("ma-agents' generated plugin bundle exists (npm run build:plugin has been run)", () => {
  assert.ok(fs.existsSync(marketplacePath), `Missing ${marketplacePath} — run "npm run build:plugin" first`);
});

const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
const pluginEntry = marketplace.plugins && marketplace.plugins[0];

let resolvedModule = null;

test('PluginResolver resolves the real ma-skills plugin to a NON-EMPTY skill set (fail-loud #1 precondition satisfied)', async () => {
  assert.ok(pluginEntry, 'marketplace.json must declare at least one plugin');
  const resolver = new PluginResolver();
  const resolved = await resolver.resolve(pluginRepoPath, pluginEntry);
  assert.strictEqual(resolved.length, 1, `expected exactly one resolved module, got ${resolved.length}`);
  resolvedModule = resolved[0];
  assert.ok(Array.isArray(resolvedModule.skillPaths) && resolvedModule.skillPaths.length > 0,
    'resolved.skillPaths must be non-empty — an empty resolution is exactly what fail-loud #1 aborts on upstream');
});

test('resolved skill directories have UNIQUE leaf (basename) names (fail-loud #2 precondition satisfied)', () => {
  assert.ok(resolvedModule, 'previous resolution test must have populated resolvedModule');
  const leaves = resolvedModule.skillPaths.map((p) => path.basename(p));
  assert.strictEqual(new Set(leaves).size, leaves.length,
    'two skill directories share a leaf name — _copyResolvedSkills would throw fail-loud #2 on a real install');
});

test('OfficialModules._copyResolvedSkills completes end-to-end against the real staged plugin (6.10.0 fail-loud path exercised, no throw)', async () => {
  assert.ok(resolvedModule, 'previous resolution test must have populated resolvedModule');
  const om = new OfficialModules();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-copyresolved-'));
  const target = path.join(tmpRoot, 'ma-skills');
  try {
    // This is the EXACT function ma-agents' custom-source install rides through
    // (installFromResolution -> _copyResolvedSkills). No throw here is the
    // regression proof: the 6.10.0 fail-loud guards do not trip on our bundle.
    await om._copyResolvedSkills(resolvedModule, target);
    const entries = fs.readdirSync(target);
    assert.ok(entries.includes('module-help.csv'), 'module-help.csv must be placed at the module root');
    assert.strictEqual(
      entries.length,
      resolvedModule.skillPaths.length + 1,
      `expected one directory per resolved skill plus module-help.csv (${resolvedModule.skillPaths.length + 1}), got ${entries.length}`
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('_copyResolvedSkills THROWS on a duplicate skill leaf name (fail-loud #2 regression, NEW at 6.10.0)', async () => {
  assert.ok(resolvedModule && resolvedModule.skillPaths.length > 0, 'need a real skill path to duplicate');
  const om = new OfficialModules();
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-agents-dup-leaf-'));
  const target = path.join(tmpRoot, 'ma-skills');
  const dupPath = resolvedModule.skillPaths[0];
  try {
    await assert.rejects(
      () => om._copyResolvedSkills({ code: 'dup-test', skillPaths: [dupPath, dupPath] }, target),
      /share the leaf name/,
      'expected _copyResolvedSkills to throw fail-loud #2 on a duplicate leaf name'
    );
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('PluginResolver.resolve() returns an EMPTY array for a plugin declaring no skills (empty-resolution precondition for fail-loud #1)', async () => {
  const resolver = new PluginResolver();
  const resolved = await resolver.resolve(pluginRepoPath, { name: 'no-skills-plugin', skills: [] });
  assert.deepStrictEqual(resolved, []);
});

test('installed official-modules.js still carries the fail-loud #1 message (marketplace-plugin, empty resolution)', () => {
  const officialModulesPath = require.resolve('bmad-method/tools/installer/modules/official-modules.js');
  const src = fs.readFileSync(officialModulesPath, 'utf8');
  assert.ok(src.includes('Aborting to avoid a partial install with no skills'),
    'the 6.10.0 empty-resolution fail-loud message must still be present verbatim');
});

test('installed official-modules.js still shares _copyResolvedSkills between the registry path and the custom-source path (the SHARED path claim)', () => {
  const officialModulesPath = require.resolve('bmad-method/tools/installer/modules/official-modules.js');
  const src = fs.readFileSync(officialModulesPath, 'utf8');
  const callSites = src.match(/this\._copyResolvedSkills\(/g) || [];
  assert.ok(callSites.length >= 2,
    `expected _copyResolvedSkills to be called from both install() and installFromResolution() (>=2 call sites); found ${callSites.length}`);
});

run();
